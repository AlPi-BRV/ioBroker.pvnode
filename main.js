'use strict';

/*
 * ioBroker.pvnode
 * PV production forecast from pvnode.com (API v2).
 *
 * Polling follows pvnode's integration guidelines:
 * - poll at next_poll_at (+30 s), clamped to 1 min .. 24 h, fallback 1 h
 * - plan features are detected from `available`, never from plan names
 * - variability (paid) is probed once; a 403 for it is not counted
 * - the last payload is persisted and reused after a restart
 * - current power / remaining energy / peak are computed locally every 5 minutes
 */

const utils = require('@iobroker/adapter-core');
const { PvnodeApi, PvnodeError } = require('./lib/api');
const { prepare, computeStates, chartSeries, WEATHER_FIELDS } = require('./lib/compute');
const { CHANNELS, commonFor } = require('./lib/states');
const { localDate, isoLocal } = require('./lib/time');
const { dayChart, daysChart } = require('./lib/svg');

const GRACE_MS = 30 * 1000;
const MIN_DELAY_MS = 60 * 1000;
const MAX_DELAY_MS = 24 * 3600 * 1000;
const FALLBACK_DELAY_MS = 3600 * 1000;
const COMPUTE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_DAYS = 8;
const MAX_STRINGS = 8;

const OPTIONAL_GROUPS = ['weather', 'irradiance', 'clearsky'];

function compass(deg) {
    const names = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    if (typeof deg !== 'number') {
        return '?';
    }
    return names[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

class Pvnode extends utils.Adapter {
    constructor(options = {}) {
        super({ ...options, name: 'pvnode' });
        this.pollTimer = null;
        this.computeTimer = null;
        this.computeAlignTimer = null;
        this.api = null;
        this.siteId = '';
        this.prepared = null;
        this.payload = null;
        this.available = null;
        this.variabilityAllowed = undefined;
        this.errorCount = 0;
        this.polling = false;
        this.stopped = false;
        this.created = new Set();
        this.lang = 'de';
        this.stringNames = [];

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    get userAgent() {
        const v = (this.pack && this.pack.version) || this.version || '0.0.0';
        return `ioBroker.pvnode/${v} ioBroker/js-controller`;
    }

    // ------------------------------------------------------------------ lifecycle

    async onReady() {
        await this.setStateAsync('info.connection', false, true);
        await this.createBaseObjects();
        try {
            const sys = await this.getForeignObjectAsync('system.config');
            this.lang = sys && sys.common && sys.common.language === 'de' ? 'de' : 'en';
        } catch {
            this.lang = 'de';
        }

        const apiKey = String(this.config.apiKey || '').trim();
        if (!apiKey) {
            this.log.error('No pvnode API key configured. Please enter it in the adapter settings.');
            return;
        }
        this.api = new PvnodeApi(apiKey, this.userAgent);
        this.siteId = String(this.config.siteId || '').trim();

        // Validate key and load site metadata (does not cost forecast quota)
        try {
            const sites = await this.api.getSites();
            if (!this.siteId) {
                if (sites.length === 1) {
                    this.siteId = sites[0].id;
                    this.log.info(`No site selected, using the only site "${sites[0].name}" (${this.siteId})`);
                } else if (sites.length === 0) {
                    this.log.error('Your pvnode account has no site. Create one at https://pvnode.com/sites/new');
                    return;
                } else {
                    this.log.error(
                        `Several sites found, please select one in the settings: ${sites
                            .map(s => `${s.name} (${s.id})`)
                            .join(', ')}`,
                    );
                    return;
                }
            }
            const site = sites.find(s => s.id === this.siteId);
            if (!site) {
                this.log.error(`Site ${this.siteId} not found in your pvnode account. Please check the settings.`);
                return;
            }
            await this.writeSiteInfo(site);
        } catch (err) {
            if (err instanceof PvnodeError && err.status === 401) {
                this.log.error('pvnode API key is invalid or revoked. Please enter a valid key in the settings.');
                return;
            }
            this.log.warn(`Could not load site list (${err.message}), continuing with configured site id`);
            if (!this.siteId) {
                return;
            }
        }

        await this.cleanupOptionalWeather();
        this.subscribeStates('control.refresh');

        // Restore cached forecast
        const restored = await this.restoreCache();
        if (restored && restored.nextPollAt && restored.nextPollAt > Date.now()) {
            this.log.info(`Using cached forecast, next poll at ${new Date(restored.nextPollAt).toISOString()}`);
            this.schedulePoll(restored.nextPollAt - Date.now() + GRACE_MS);
        } else {
            await this.poll();
        }
        this.startComputeTimer();
    }

    onUnload(callback) {
        try {
            this.stopped = true;
            if (this.pollTimer) {
                this.clearTimeout(this.pollTimer);
            }
            if (this.computeAlignTimer) {
                this.clearTimeout(this.computeAlignTimer);
            }
            if (this.computeTimer) {
                this.clearInterval(this.computeTimer);
            }
        } finally {
            callback();
        }
    }

    async onStateChange(id, state) {
        if (!state || state.ack) {
            return;
        }
        if (id === `${this.namespace}.control.refresh` && state.val) {
            this.log.info('Manual refresh requested (costs one forecast request)');
            await this.setStateAsync('control.refresh', false, true);
            await this.poll(true);
        }
    }

    async onMessage(obj) {
        if (!obj || !obj.command) {
            return;
        }
        if (obj.command === 'getSites') {
            const msg = obj.message || {};
            const key = String(msg.apiKey || this.config.apiKey || '').trim();
            let result = [];
            if (key) {
                try {
                    const api = new PvnodeApi(key, this.userAgent);
                    const sites = await api.getSites();
                    result = sites.map(s => ({ label: `${s.name} (${s.id})`, value: s.id }));
                } catch (err) {
                    result = [{ label: `Error: ${err.message}`, value: '' }];
                }
            }
            if (obj.callback) {
                this.sendTo(obj.from, obj.command, result, obj.callback);
            }
        }
    }

    // ------------------------------------------------------------------ polling

    schedulePoll(delayMs) {
        if (this.stopped) {
            return;
        }
        const delay = Math.min(Math.max(delayMs, MIN_DELAY_MS), MAX_DELAY_MS);
        if (this.pollTimer) {
            this.clearTimeout(this.pollTimer);
        }
        this.pollTimer = this.setTimeout(() => {
            this.pollTimer = null;
            this.poll().catch(e => this.log.error(`Poll failed: ${e.message}`));
        }, delay);
        this.setState('info.nextPoll', new Date(Date.now() + delay).toISOString(), true);
        this.log.debug(`Next poll in ${Math.round(delay / 60000)} min`);
    }

    buildInclude() {
        const inc = ['default', 'strings'];
        const avail = this.available;
        for (const g of OPTIONAL_GROUPS) {
            const wanted =
                (g === 'weather' && this.config.includeWeather) ||
                (g === 'irradiance' && this.config.includeIrradiance) ||
                (g === 'clearsky' && this.config.includeClearsky);
            if (wanted && (!avail || avail.includes(g))) {
                inc.push(g);
            }
        }
        if (this.config.useVariability !== false && this.variabilityAllowed !== false) {
            // undefined = fresh install -> probe once (a 403 is not counted)
            inc.push('variability');
        }
        return inc;
    }

    async poll(manual = false) {
        if (this.polling || !this.api || !this.siteId) {
            return;
        }
        this.polling = true;
        try {
            let include = this.buildInclude();
            let result;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    result = await this.api.getForecast(this.siteId, include, Number(this.config.forecastDays) || 0);
                    break;
                } catch (err) {
                    if (attempt === 0 && err instanceof PvnodeError && err.status === 403) {
                        const detail = err.detail.toLowerCase();
                        const dropped = include.filter(g => g !== 'default' && g !== 'strings' && detail.includes(g));
                        if (dropped.length) {
                            if (dropped.includes('variability')) {
                                this.variabilityAllowed = false;
                                this.log.info(
                                    'Variability band is not part of your pvnode plan, continuing without it',
                                );
                            } else {
                                this.log.info(`Plan does not allow ${dropped.join(', ')}, continuing without`);
                                this.available = (this.available || []).filter(g => !dropped.includes(g));
                            }
                            include = include.filter(g => !dropped.includes(g));
                            continue;
                        }
                    }
                    throw err;
                }
            }

            const { body, quota } = result;
            await this.writeQuota(quota);
            this.available = Array.isArray(body.available) ? body.available : this.available;
            if (this.available) {
                this.variabilityAllowed = this.available.includes('variability');
            }
            this.errorCount = 0;
            await this.applyPayload(body, false);
            await this.saveCache(body);
            await this.setStateAsync('info.connection', true, true);
            await this.setStateAsync('info.stale', false, true);
            await this.setStateAsync('info.lastError', '', true);

            const next = body.next_poll_at ? Date.parse(body.next_poll_at) : NaN;
            this.schedulePoll(Number.isFinite(next) ? next - Date.now() + GRACE_MS : FALLBACK_DELAY_MS);
            if (manual) {
                this.log.info('Manual refresh done');
            }
        } catch (err) {
            await this.handlePollError(err);
        } finally {
            this.polling = false;
        }
    }

    async handlePollError(err) {
        const status = err instanceof PvnodeError ? err.status : 0;
        const detail = err instanceof PvnodeError ? err.detail.toLowerCase() : '';
        await this.setStateAsync('info.lastError', String(err.message).slice(0, 500), true);
        if (err instanceof PvnodeError && err.quota) {
            await this.writeQuota(err.quota);
        }

        if (status === 401) {
            await this.setStateAsync('info.connection', false, true);
            this.log.error(
                'pvnode API key is invalid or revoked. Please enter a new key in the settings. Polling stopped.',
            );
            return;
        }
        if (status === 404) {
            await this.setStateAsync('info.connection', false, true);
            this.log.error(`pvnode site ${this.siteId} not found (deleted?). Please reconfigure. Polling stopped.`);
            return;
        }
        if (status === 403) {
            await this.setStateAsync('info.connection', false, true);
            if (detail.includes('inactive') || detail.includes('site limit')) {
                this.log.error(`pvnode site is inactive (plan downgrade?): ${err.detail}. Polling stopped.`);
            } else {
                this.log.error(`Your pvnode plan does not allow this request: ${err.detail}. Polling stopped.`);
            }
            return;
        }
        if (status === 429) {
            const reset = err.quota && err.quota.reset ? Date.parse(err.quota.reset) : NaN;
            const until = Number.isFinite(reset) ? reset : Date.now() + MAX_DELAY_MS;
            this.log.warn(`pvnode monthly request limit reached. Pausing until ${new Date(until).toISOString()}`);
            await this.setStateAsync('info.stale', true, true);
            this.schedulePoll(Math.min(until - Date.now() + GRACE_MS, MAX_DELAY_MS));
            return;
        }

        // transient (network, 5xx): keep last forecast, mark stale, back off
        this.errorCount++;
        const delay = Math.min(5 * 60000 * 2 ** (this.errorCount - 1), FALLBACK_DELAY_MS);
        this.log.warn(`pvnode request failed (${err.message}), retry in ${Math.round(delay / 60000)} min`);
        await this.setStateAsync('info.stale', true, true);
        if (!this.payload) {
            await this.setStateAsync('info.connection', false, true);
        }
        this.schedulePoll(delay);
    }

    // ------------------------------------------------------------------ cache

    async saveCache(body) {
        const cache = { siteId: this.siteId, savedAt: Date.now(), available: this.available, payload: body };
        await this.setStateAsync('info.cache', JSON.stringify(cache), true);
    }

    async restoreCache() {
        try {
            const st = await this.getStateAsync('info.cache');
            if (!st || !st.val) {
                return null;
            }
            const cache = JSON.parse(String(st.val));
            if (!cache || cache.siteId !== this.siteId || !cache.payload) {
                return null;
            }
            this.available = Array.isArray(cache.available) ? cache.available : null;
            if (this.available) {
                this.variabilityAllowed = this.available.includes('variability');
            }
            await this.applyPayload(cache.payload, true);
            const next = cache.payload.next_poll_at ? Date.parse(cache.payload.next_poll_at) : NaN;
            // if the user changed the requested groups, the cache is not usable for scheduling
            const wanted = this.buildInclude().filter(g => g !== 'variability');
            const included = cache.payload.included || [];
            const complete = included.includes('all') || wanted.every(g => included.includes(g));
            await this.setStateAsync('info.connection', true, true);
            return { nextPollAt: complete && Number.isFinite(next) ? next : null };
        } catch (err) {
            this.log.debug(`Cache not usable: ${err.message}`);
            return null;
        }
    }

    // ------------------------------------------------------------------ data

    async applyPayload(body, fromCache) {
        this.payload = body;
        this.prepared = prepare(body);
        const tz = this.prepared.tz;
        await this.setStateAsync('info.computedAt', body.computed_at || null, true);
        await this.setStateAsync('info.availableGroups', (body.available || []).join(','), true);
        await this.setStateAsync('info.variability', !!this.prepared.hasVariability, true);
        await this.setStateAsync('info.forecastDays', (body.daily || []).length, true);
        if (!fromCache) {
            await this.setStateAsync('info.lastUpdate', new Date().toISOString(), true);
        }

        // charts are only rebuilt when a new payload arrives
        const now = Date.now();
        const today = localDate(now, tz);
        await this.ensureState('json.forecast', {
            type: 'string',
            role: 'json',
            name: { en: 'Full forecast series', de: 'Komplette Prognosekurve' },
        });
        await this.ensureState('json.today', {
            type: 'string',
            role: 'json',
            name: { en: 'Forecast series today', de: 'Prognosekurve heute' },
        });
        await this.ensureState('json.daily', {
            type: 'string',
            role: 'json',
            name: { en: 'Daily forecast', de: 'Tagesprognose' },
        });
        await this.setStateAsync('json.forecast', JSON.stringify(chartSeries(this.prepared)), true);
        await this.setStateAsync(
            'json.today',
            JSON.stringify(chartSeries(this.prepared, v => localDate(v.t, tz) === today)),
            true,
        );
        await this.setStateAsync('json.daily', JSON.stringify(body.daily || []), true);

        await this.updateComputed();
        if (!fromCache) {
            this.log.debug(`Forecast applied (computed_at ${body.computed_at}, ${isoLocal(now, tz)})`);
        }
    }

    async updateComputed() {
        if (!this.prepared) {
            return;
        }
        const states = computeStates(this.prepared, Date.now());
        const dayCount = states._dayCount || 0;
        delete states._dayCount;

        for (const [id, val] of Object.entries(states)) {
            await this.ensureState(id);
            await this.setStateAsync(id, { val, ack: true });
        }
        await this.removeSurplus('days', dayCount, MAX_DAYS);
        if (this.config.createSvg !== false) {
            await this.updateCharts();
        }
        if (this.prepared.strings.length) {
            await this.removeSurplus('strings', Math.max(...this.prepared.strings.map(s => s.index)) + 1, MAX_STRINGS);
        }
    }

    async updateCharts() {
        const now = Date.now();
        const p = this.prepared;
        const opt = { lang: this.lang, stringNames: this.stringNames };
        const tomorrow = p.values.map(v => localDate(v.t, p.tz)).find(d => d > localDate(now, p.tz));
        const charts = {
            'html.today': () => dayChart(p, now, opt),
            'html.tomorrow': () => (tomorrow ? dayChart(p, now, { ...opt, day: tomorrow }) : ''),
            'html.days': () => daysChart(p, now, opt),
        };
        for (const [id, fn] of Object.entries(charts)) {
            await this.ensureState(id, { type: 'string', role: 'html', name: this.chartName(id) });
            await this.setStateAsync(id, fn(), true);
        }
    }

    chartName(id) {
        return {
            'html.today': { en: 'SVG chart: power curve today', de: 'SVG-Diagramm: Leistungskurve heute' },
            'html.tomorrow': { en: 'SVG chart: power curve tomorrow', de: 'SVG-Diagramm: Leistungskurve morgen' },
            'html.days': { en: 'SVG chart: daily energy', de: 'SVG-Diagramm: Tagesertrag' },
        }[id];
    }

    startComputeTimer() {
        const now = Date.now();
        const toNext = COMPUTE_INTERVAL_MS - (now % COMPUTE_INTERVAL_MS) + 2000;
        this.computeAlignTimer = this.setTimeout(() => {
            this.computeAlignTimer = null;
            this.updateComputed().catch(e => this.log.warn(`Compute failed: ${e.message}`));
            this.computeTimer = this.setInterval(() => {
                this.updateComputed().catch(e => this.log.warn(`Compute failed: ${e.message}`));
            }, COMPUTE_INTERVAL_MS);
        }, toNext);
    }

    // ------------------------------------------------------------------ objects

    async createBaseObjects() {
        for (const [ch, name] of Object.entries(CHANNELS)) {
            await this.setObjectNotExistsAsync(ch, { type: 'channel', common: { name }, native: {} });
        }
        const info = {
            'info.connection': {
                type: 'boolean',
                role: 'indicator.connected',
                name: { en: 'Connected to pvnode', de: 'Verbunden mit pvnode' },
            },
            'info.stale': {
                type: 'boolean',
                role: 'indicator',
                name: {
                    en: 'Forecast is outdated (last request failed)',
                    de: 'Prognose veraltet (letzte Abfrage fehlgeschlagen)',
                },
            },
            'info.lastError': { type: 'string', role: 'text', name: { en: 'Last error', de: 'Letzter Fehler' } },
            'info.lastUpdate': {
                type: 'string',
                role: 'date',
                name: { en: 'Last successful request', de: 'Letzte erfolgreiche Abfrage' },
            },
            'info.computedAt': {
                type: 'string',
                role: 'text',
                name: { en: 'Forecast computed at (pvnode)', de: 'Prognose berechnet um (pvnode)' },
            },
            'info.nextPoll': { type: 'string', role: 'date', name: { en: 'Next request', de: 'Nächste Abfrage' } },
            'info.requestsLimit': {
                type: 'mixed',
                role: 'value',
                name: { en: 'Monthly request limit', de: 'Monatliches Anfragelimit' },
            },
            'info.requestsUsed': {
                type: 'number',
                role: 'value',
                name: { en: 'Requests used this month', de: 'Anfragen diesen Monat verbraucht' },
            },
            'info.requestsRemaining': {
                type: 'mixed',
                role: 'value',
                name: { en: 'Requests remaining this month', de: 'Verbleibende Anfragen diesen Monat' },
            },
            'info.requestsReset': {
                type: 'string',
                role: 'date',
                name: { en: 'Request counter reset', de: 'Zurücksetzung des Anfragezählers' },
            },
            'info.availableGroups': {
                type: 'string',
                role: 'text',
                name: { en: 'Data groups allowed by plan', de: 'Vom Plan erlaubte Datengruppen' },
            },
            'info.variability': {
                type: 'boolean',
                role: 'indicator',
                name: { en: 'Variability band available', de: 'Schwankungsband verfügbar' },
            },
            'info.forecastDays': {
                type: 'number',
                role: 'value',
                name: { en: 'Number of forecast days', de: 'Anzahl Prognosetage' },
            },
            'info.cache': {
                type: 'string',
                role: 'json',
                name: { en: 'Cached forecast (internal)', de: 'Zwischengespeicherte Prognose (intern)' },
            },
            'site.name': { type: 'string', role: 'text', name: { en: 'Site name', de: 'Name des Standorts' } },
            'site.id': { type: 'string', role: 'text', name: { en: 'Site ID', de: 'Standort-ID' } },
            'site.power_kw': {
                type: 'number',
                role: 'value',
                unit: 'kWp',
                name: { en: 'Installed power', de: 'Installierte Leistung' },
            },
        };
        for (const [id, c] of Object.entries(info)) {
            await this.ensureState(id, c);
        }
        await this.setObjectNotExistsAsync('control.refresh', {
            type: 'state',
            common: {
                name: {
                    en: 'Refresh forecast now (costs one request)',
                    de: 'Prognose jetzt abrufen (kostet eine Anfrage)',
                },
                type: 'boolean',
                role: 'button',
                read: false,
                write: true,
                def: false,
            },
            native: {},
        });
    }

    async ensureState(id, override) {
        if (this.created.has(id)) {
            return;
        }
        const parts = id.split('.');
        // intermediate channels (e.g. days.0, strings.1)
        for (let i = 2; i < parts.length; i++) {
            const ch = parts.slice(0, i).join('.');
            if (!this.created.has(ch)) {
                await this.setObjectNotExistsAsync(ch, {
                    type: 'channel',
                    common: { name: this.channelName(ch) },
                    native: {},
                });
                this.created.add(ch);
            }
        }
        const common = { ...commonFor(id), ...(override || {}) };
        common.read = true;
        common.write = false;
        await this.extendObjectAsync(id, { type: 'state', common, native: {} });
        this.created.add(id);
    }

    channelName(ch) {
        const [root, idx] = ch.split('.');
        if (root === 'days') {
            const n = Number(idx);
            if (n === 0) {
                return { en: 'Today', de: 'Heute' };
            }
            if (n === 1) {
                return { en: 'Tomorrow', de: 'Morgen' };
            }
            return { en: `In ${n} days`, de: `In ${n} Tagen` };
        }
        if (root === 'strings') {
            return { en: `String ${Number(idx) + 1}`, de: `String ${Number(idx) + 1}` };
        }
        return ch;
    }

    async removeSurplus(root, count, max) {
        for (let i = count; i < max; i++) {
            const id = `${root}.${i}`;
            const obj = await this.getObjectAsync(id);
            if (obj) {
                await this.delObjectAsync(id, { recursive: true });
                for (const k of [...this.created]) {
                    if (k === id || k.startsWith(`${id}.`)) {
                        this.created.delete(k);
                    }
                }
            }
        }
    }

    async cleanupOptionalWeather() {
        const wanted = new Set();
        if (this.config.includeWeather) {
            [
                'temp',
                'weather_code',
                'wind_speed',
                'relative_humidity',
                'precipitation_mm',
                'snow_water_equivalent',
            ].forEach(f => wanted.add(f));
        }
        if (this.config.includeIrradiance) {
            ['ghi', 'dhi', 'bni'].forEach(f => wanted.add(f));
        }
        for (const f of WEATHER_FIELDS) {
            if (!wanted.has(f)) {
                const obj = await this.getObjectAsync(`weather.${f}`);
                if (obj) {
                    await this.delObjectAsync(`weather.${f}`);
                }
            }
        }
        if (!this.config.includeClearsky) {
            for (const id of ['now.power_clearsky']) {
                if (await this.getObjectAsync(id)) {
                    await this.delObjectAsync(id);
                }
            }
            for (let i = 0; i < MAX_DAYS; i++) {
                if (await this.getObjectAsync(`days.${i}.energy_clearsky`)) {
                    await this.delObjectAsync(`days.${i}.energy_clearsky`);
                }
            }
        }
    }

    async writeSiteInfo(site) {
        await this.setStateAsync('site.name', site.name || '', true);
        await this.setStateAsync('site.id', site.id || '', true);
        const strings = Array.isArray(site.strings) ? site.strings : [];
        const total = strings.reduce((a, s) => a + (Number(s.power_kw) || 0), 0);
        await this.setStateAsync('site.power_kw', Math.round(total * 100) / 100, true);
        const dirDe = { N: 'Nord', NO: 'Nordost', O: 'Ost', SO: 'Südost', S: 'Süd', SW: 'Südwest', W: 'West', NW: 'Nordwest' };
        const dirEn = { N: 'North', NO: 'Northeast', O: 'East', SO: 'Southeast', S: 'South', SW: 'Southwest', W: 'West', NW: 'Northwest' };
        this.stringNames = strings.map(st => {
            const c = compass(st.orientation);
            return `${(this.lang === 'de' ? dirDe : dirEn)[c] || c} ${Number(st.power_kw).toLocaleString(this.lang === 'de' ? 'de-DE' : 'en-US')} kWp`;
        });
        for (let i = 0; i < strings.length && i < MAX_STRINGS; i++) {
            const s = strings[i];
            const ch = `strings.${i}`;
            await this.extendObjectAsync(ch, {
                type: 'channel',
                common: {
                    name: `String ${i + 1}: ${compass(s.orientation)} ${s.orientation}°, ${s.slope}° Neigung, ${s.power_kw} kWp`,
                },
                native: { string_id: s.id },
            });
            this.created.add(ch);
            await this.ensureState(`${ch}.string_id`);
            await this.setStateAsync(`${ch}.string_id`, s.id || '', true);
            for (const k of ['orientation', 'slope', 'power_kw']) {
                await this.ensureState(`${ch}.${k}`);
                await this.setStateAsync(`${ch}.${k}`, typeof s[k] === 'number' ? s[k] : null, true);
            }
        }
    }

    async writeQuota(q) {
        if (!q) {
            return;
        }
        await this.setStateAsync('info.requestsLimit', q.limit ?? null, true);
        await this.setStateAsync('info.requestsUsed', typeof q.used === 'number' ? q.used : null, true);
        await this.setStateAsync('info.requestsRemaining', q.remaining ?? null, true);
        await this.setStateAsync('info.requestsReset', q.reset || null, true);
    }
}

if (require.main !== module) {
    module.exports = options => new Pvnode(options);
} else {
    new Pvnode();
}
