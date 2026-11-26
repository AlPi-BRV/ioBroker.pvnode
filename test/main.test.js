'use strict';

/*
 * Smoke test of main.js with a stubbed @iobroker/adapter-core and a mocked fetch.
 * Runs without an ioBroker installation.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

// ---------------------------------------------------------------- adapter-core stub
class FakeAdapter {
    constructor(options) {
        this.name = options.name;
        this.namespace = `${options.name}.0`;
        this.config = { ...(options.config || {}) };
        this.objects = options.objects || new Map();
        this.states = options.states || new Map();
        this.sysConfig = options.sysConfig || { common: { language: 'de' } };
        this.handlers = {};
        this.timers = [];
        this.logs = [];
        this.pack = { version: '0.1.0' };
        const l = lvl => msg => this.logs.push(`${lvl}: ${msg}`);
        this.log = { info: l('info'), warn: l('warn'), error: l('error'), debug: l('debug') };
    }
    on(ev, fn) {
        this.handlers[ev] = fn;
    }
    async setObjectNotExistsAsync(id, obj) {
        if (!this.objects.has(id)) {
            this.objects.set(id, obj);
        }
    }
    async extendObjectAsync(id, obj) {
        const o = this.objects.get(id) || {};
        this.objects.set(id, { ...o, ...obj, common: { ...(o.common || {}), ...(obj.common || {}) } });
    }
    async getForeignObjectAsync() {
        return this.sysConfig;
    }
    async getForeignObjectsAsync(pattern) {
        const prefix = pattern.replace(`${this.namespace}.`, '').replace(/\*$/, '');
        const res = {};
        for (const [k, o] of this.objects) {
            if (k.startsWith(prefix)) {
                res[`${this.namespace}.${k}`] = { ...o, _id: `${this.namespace}.${k}` };
            }
        }
        return res;
    }
    async getObjectAsync(id) {
        return this.objects.get(id) || null;
    }
    async delObjectAsync(id, opt) {
        for (const k of [...this.objects.keys()]) {
            if (k === id || (opt && opt.recursive && k.startsWith(`${id}.`))) {
                this.objects.delete(k);
                this.states.delete(k);
            }
        }
    }
    async setStateAsync(id, val, ack) {
        if (!this.objects.has(id) && !id.startsWith('info.')) {
            throw new Error(`setState on missing object ${id}`);
        }
        const st = val !== null && typeof val === 'object' ? val : { val, ack };
        this.states.set(id, st);
    }
    setState(id, val, ack) {
        this.setStateAsync(id, val, ack);
    }
    async getStateAsync(id) {
        return this.states.get(id) || null;
    }
    subscribeStates() {}
    setTimeout(fn, ms) {
        const t = { fn, ms, type: 'timeout' };
        this.timers.push(t);
        return t;
    }
    clearTimeout(t) {
        this.timers = this.timers.filter(x => x !== t);
    }
    setInterval(fn, ms) {
        const t = { fn, ms, type: 'interval' };
        this.timers.push(t);
        return t;
    }
    clearInterval(t) {
        this.clearTimeout(t);
    }
    sendTo(from, cmd, result, cb) {
        this.sent = { from, cmd, result, cb };
    }
}
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
    if (request === '@iobroker/adapter-core') {
        return 'stub:adapter-core';
    }
    return origResolve.call(this, request, ...rest);
};
require.cache['stub:adapter-core'] = {
    id: 'stub:adapter-core',
    filename: 'stub:adapter-core',
    loaded: true,
    exports: { Adapter: FakeAdapter },
};

const createAdapter = require('../main.js');
const { LANGS } = require('../lib/states');
const freePayload = require('./fixtures/forecast_all.json');
const plusPayload = require('./fixtures/forecast_variability.json');

// ---------------------------------------------------------------- fetch mock
const SITE = {
    id: 'site_test',
    name: 'BRV',
    timezone: 'Europe/Berlin',
    strings: [
        { id: 'str_ffbc4605', slope: 13, orientation: 90, power_kw: 6.7 },
        { id: 'str_ea5be30e', slope: 13, orientation: 270, power_kw: 6.7 },
    ],
};

function mockFetch(handler) {
    const calls = [];
    global.fetch = async (url, opts) => {
        calls.push({ url, opts });
        const r = handler(url, calls.length);
        const headers = new Headers(r.headers || {});
        return {
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            headers,
            text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
        };
    };
    return calls;
}

const quota = (used, limit = '250') => ({
    'RequestLimit-Limit': limit,
    'RequestLimit-Used': String(used),
    'RequestLimit-Remaining': String(Number(limit) - used),
    'RequestLimit-Reset': '2026-12-01T00:00:00Z',
});

/** shift fixture so that "today" is the real current day */
function shiftToToday(payload) {
    const p = JSON.parse(JSON.stringify(payload));
    const fixtureDay = p.daily[0].date;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(Date.now() + 86400000));
    const nextFixtureDay = p.daily[1].date;
    const map = s => s.replace(fixtureDay, today).replace(nextFixtureDay, tomorrow);
    p.daily.forEach(d => (d.date = map(d.date)));
    p.values.forEach(v => (v.timestamp = map(v.timestamp)));
    p.strings.forEach(v => (v.timestamp = map(v.timestamp)));
    p.next_poll_at = new Date(Date.now() + 3 * 3600000).toISOString();
    return p;
}

const baseConfig = {
    apiKey: 'sk_live_test',
    siteId: '',
    forecastDays: 0,
    includeWeather: true,
    includeIrradiance: false,
    includeClearsky: false,
    useVariability: true,
};

test('free plan: probes variability once, falls back, writes states and schedules next poll', async () => {
    const payload = shiftToToday(freePayload);
    const calls = mockFetch(url => {
        if (url.includes('/v2/sites/')) {
            return { status: 200, body: [SITE] };
        }
        if (url.includes('include=variability')) {
            return { status: 403, body: { detail: 'Your current plan does not include the forecast variability band (include=variability).' } };
        }
        return { status: 200, body: payload, headers: quota(33) };
    });
    const a = createAdapter({ config: baseConfig });
    await a.handlers.ready();

    const urls = calls.map(c => c.url);
    assert.strictEqual(urls.length, 3, urls.join('\n'));
    assert.ok(urls[1].includes('include=variability'));
    assert.ok(!urls[2].includes('variability'));
    assert.ok(urls[2].includes('include=weather'));
    assert.ok(!urls[2].includes('include=clearsky'));
    assert.match(calls[0].opts.headers['User-Agent'], /^ioBroker\.pvnode\/0\.1\.0/);
    assert.strictEqual(calls[0].opts.headers.Authorization, 'Bearer sk_live_test');

    const v = id => (a.states.get(id) || {}).val;
    assert.strictEqual(v('info.connection'), true);
    assert.strictEqual(v('info.requestsRemaining'), 217);
    assert.strictEqual(v('info.variability'), false);
    assert.strictEqual(v('today.energy'), 10.58);
    assert.strictEqual(v('tomorrow.energy'), 9.33);
    assert.strictEqual(v('site.name'), 'BRV');
    assert.strictEqual(v('site.power_kw'), 13.4);
    assert.strictEqual(a.objects.get('strings.0').common.name.en, 'String 1: azimuth 90°, tilt 13°, 6.7 kWp');
    assert.strictEqual(a.objects.get('strings.0').common.name.de, 'String 1: Azimut 90°, Neigung 13°, 6.7 kWp');
    assert.strictEqual(v('strings.1.string_id'), 'str_ea5be30e');
    assert.ok(typeof v('today.remaining') === 'number');
    assert.ok(a.objects.has('weather.temp'));
    assert.ok(!a.objects.has('now.power_min'));
    assert.ok(JSON.parse(v('json.today')).length === 96);

    const poll = a.timers.find(t => t.type === 'timeout' && t.ms > 3600000);
    assert.ok(poll, 'poll scheduled from next_poll_at');
    // next_poll_at + 30 s grace + random 0..90 s per instance
    assert.ok(poll.ms > 3 * 3600000 + 25000 && poll.ms < 3 * 3600000 + 125000, `delay ${poll.ms}`);

    // ---- restart: cache is used, no forecast request ----
    const calls2 = mockFetch(url => (url.includes('/v2/sites/') ? { status: 200, body: [SITE] } : { status: 500, body: 'x' }));
    const b = createAdapter({ config: baseConfig, objects: a.objects, states: a.states });
    await b.handlers.ready();
    assert.strictEqual(calls2.filter(c => c.url.includes('/forecast/')).length, 0, 'no forecast call after restart');
    assert.strictEqual((b.states.get('today.energy') || {}).val, 10.58);
});

test('plus plan: variability band is used', async () => {
    const payload = shiftToToday(plusPayload);
    const calls = mockFetch(url => (url.includes('/v2/sites/') ? { status: 200, body: [SITE] } : { status: 200, body: payload, headers: quota(5, '3000') }));
    const a = createAdapter({ config: baseConfig });
    await a.handlers.ready();
    assert.strictEqual(calls.length, 2);
    const v = id => (a.states.get(id) || {}).val;
    assert.strictEqual(v('info.variability'), true);
    assert.strictEqual(v('today.energy_min'), 7.41);
    assert.strictEqual(v('info.requestsLimit'), 3000);
    assert.ok(a.objects.has('strings.0.power_max'));
});

test('all objects have names in 11 languages and valid types', async () => {
    const payload = shiftToToday(plusPayload);
    mockFetch(url => (url.includes('/v2/sites/') ? { status: 200, body: [SITE] } : { status: 200, body: payload, headers: quota(5, '3000') }));
    const a = createAdapter({ config: { ...baseConfig, includeIrradiance: true, includeClearsky: true } });
    await a.handlers.ready();
    const missing = [];
    for (const [id, obj] of a.objects) {
        const name = obj.common && obj.common.name;
        if (typeof name !== 'object' || LANGS.some(l => typeof name[l] !== 'string' || !name[l])) {
            missing.push(id);
        }
        if (obj.type === 'state') {
            assert.ok(['number', 'string', 'boolean'].includes(obj.common.type), `${id}: type ${obj.common.type}`);
        }
    }
    assert.deepStrictEqual(missing, []);
    assert.ok(a.objects.size > 60, `only ${a.objects.size} objects`);
    assert.strictEqual(a.objects.get('days.1').common.name.es, 'Mañana');
    assert.strictEqual(a.objects.get('weather.ghi').common.role, 'value.radiation');
    assert.strictEqual(a.objects.get('now.slot_start').common.role, 'date');
});

test('unmetered plan: request limit and remaining are -1', async () => {
    const payload = shiftToToday(plusPayload);
    mockFetch(url =>
        url.includes('/v2/sites/')
            ? { status: 200, body: [SITE] }
            : {
                  status: 200,
                  body: payload,
                  headers: { ...quota(5), 'RequestLimit-Limit': 'unmetered', 'RequestLimit-Remaining': 'unmetered' },
              },
    );
    const a = createAdapter({ config: baseConfig });
    await a.handlers.ready();
    assert.strictEqual(a.states.get('info.requestsLimit').val, -1);
    assert.strictEqual(a.states.get('info.requestsRemaining').val, -1);
    assert.strictEqual(a.states.get('info.requestsUsed').val, 5);
    assert.strictEqual(a.objects.get('info.requestsLimit').common.type, 'number');
});

test('update from 0.2.2: existing objects get new names and types', async () => {
    const objects = new Map([
        ['days', { type: 'channel', common: { name: { en: 'Daily forecast (0 = today)', de: 'Tagesprognose (0 = heute)' } }, native: {} }],
        ['days.0', { type: 'channel', common: { name: { en: 'Today', de: 'Heute' } }, native: {} }],
        ['info.requestsLimit', { type: 'state', common: { name: { en: 'Monthly request limit', de: 'Monatliches Anfragelimit' }, type: 'mixed', role: 'value' }, native: {} }],
        ['control.refresh', { type: 'state', common: { name: { en: 'Refresh', de: 'Abrufen' }, type: 'boolean', role: 'button' }, native: {} }],
    ]);
    const states = new Map([['info.requestsLimit', { val: 'unmetered', ack: true }]]);
    mockFetch(() => ({ status: 401, body: { detail: 'Invalid API key' } }));
    const a = createAdapter({ config: baseConfig, objects, states });
    await a.handlers.ready();
    assert.strictEqual(a.objects.get('days').common.name.fr, "Prévision journalière (0 = aujourd'hui)");
    assert.strictEqual(a.objects.get('info.requestsLimit').common.type, 'number');
    assert.strictEqual(a.objects.get('info.requestsLimit').common.name.pl, 'Miesięczny limit zapytań (-1 = bez limitu)');
    assert.strictEqual(a.objects.get('control.refresh').common.name['zh-cn'], '立即刷新预测（消耗一次请求）');
    assert.strictEqual(a.states.get('info.requestsLimit').val, -1);
});

test('objects with custom settings are not deleted', async () => {
    const payload = shiftToToday(freePayload);
    mockFetch(url => (url.includes('/v2/sites/') ? { status: 200, body: [SITE] } : { status: 200, body: payload, headers: quota(33) }));
    const objects = new Map([
        ['weather.ghi', { type: 'state', common: { name: 'x', custom: { 'history.0': { enabled: true } } }, native: {} }],
        ['days.5', { type: 'channel', common: { name: 'x' }, native: {} }],
        ['days.5.energy', { type: 'state', common: { name: 'x', custom: { 'influxdb.0': { enabled: true } } }, native: {} }],
        ['days.6', { type: 'channel', common: { name: 'x' }, native: {} }],
        ['days.6.energy', { type: 'state', common: { name: 'x' }, native: {} }],
    ]);
    const a = createAdapter({ config: { ...baseConfig, useVariability: false }, objects });
    await a.handlers.ready();
    assert.ok(a.objects.has('weather.ghi'), 'ghi with history kept');
    assert.ok(a.objects.has('days.5.energy'), 'days.5 with influxdb kept');
    assert.ok(!a.objects.has('days.6'), 'days.6 deleted');
    assert.strictEqual(a.logs.filter(l => l.startsWith('warn') && l.includes('custom settings')).length, 2);
});

test('SVG numbers follow the system decimal separator', async () => {
    const { fmt } = require('../lib/svg');
    assert.strictEqual(fmt(12.84, 1, false), '12.8');
    assert.strictEqual(fmt(12.84, 1, true), '12,8');
    assert.strictEqual(fmt(2.5, 0, false), '3');
    const payload = shiftToToday(freePayload);
    for (const [sysConfig, re] of [
        [{ common: { language: 'en', isFloatComma: false } }, /\d\.\d kWh/],
        [{ common: { language: 'en', isFloatComma: true } }, /\d,\d kWh/],
        [{ common: { language: 'de' } }, /\d,\d kWh/],
    ]) {
        mockFetch(url => (url.includes('/v2/sites/') ? { status: 200, body: [SITE] } : { status: 200, body: payload, headers: quota(33) }));
        const a = createAdapter({ config: baseConfig, sysConfig });
        await a.handlers.ready();
        const svg = a.states.get('html.days').val;
        assert.match(svg, re, JSON.stringify(sysConfig));
    }
});

test('compute loop uses setTimeout chain, no setInterval', async () => {
    const payload = shiftToToday(freePayload);
    mockFetch(url => (url.includes('/v2/sites/') ? { status: 200, body: [SITE] } : { status: 200, body: payload, headers: quota(33) }));
    const a = createAdapter({ config: baseConfig });
    await a.handlers.ready();
    const align = a.timers.find(t => t.type === 'timeout' && t.ms <= 5 * 60000 + 2000);
    assert.ok(align, 'align timer');
    align.fn();
    await new Promise(r => setImmediate(r));
    await new Promise(r => setImmediate(r));
    assert.strictEqual(a.timers.filter(t => t.type === 'interval').length, 0);
    const next = a.timers.filter(t => t.type === 'timeout' && t !== align && t.ms <= 5 * 60000 + 2000);
    assert.ok(next.length >= 1, 'next compute scheduled');
});

test('invalid key: stops without forecast request', async () => {
    const calls = mockFetch(() => ({ status: 401, body: { detail: 'Invalid API key' } }));
    const a = createAdapter({ config: baseConfig });
    await a.handlers.ready();
    assert.strictEqual(calls.length, 1);
    assert.ok(a.logs.some(l => l.startsWith('error') && l.includes('invalid')));
    assert.strictEqual(a.timers.filter(t => t.type === 'timeout').length, 0);
});

test('429: pauses until RequestLimit-Reset', async () => {
    const reset = new Date(Date.now() + 5 * 3600000).toISOString();
    mockFetch(url =>
        url.includes('/v2/sites/')
            ? { status: 200, body: [SITE] }
            : { status: 429, body: { detail: 'limit' }, headers: { ...quota(250), 'RequestLimit-Reset': reset } },
    );
    const a = createAdapter({ config: { ...baseConfig, useVariability: false } });
    await a.handlers.ready();
    const poll = a.timers.find(t => t.type === 'timeout' && t.ms > 3600000);
    assert.ok(poll && poll.ms > 5 * 3600000 && poll.ms < 5 * 3600000 + 150000, `delay ${poll && poll.ms}`);
    assert.strictEqual(a.states.get('info.requestsRemaining').val, 0);
});

test('network error: backs off and keeps running', async () => {
    mockFetch(url => (url.includes('/v2/sites/') ? { status: 200, body: [SITE] } : { status: 503, body: 'unavailable' }));
    const a = createAdapter({ config: { ...baseConfig, useVariability: false } });
    await a.handlers.ready();
    const poll = a.timers.find(t => t.type === 'timeout' && t.ms === 5 * 60000);
    assert.ok(poll, 'retry in 5 min');
    assert.strictEqual(a.states.get('info.stale').val, true);
});

test('getSites message for the admin site picker', async () => {
    mockFetch(() => ({ status: 200, body: [SITE] }));
    const a = createAdapter({ config: baseConfig });
    await a.handlers.message({ command: 'getSites', message: { apiKey: 'k' }, from: 'admin', callback: 1 });
    assert.deepStrictEqual(a.sent.result, [{ label: 'BRV (site_test)', value: 'site_test' }]);
});

test('multiple sites without selection: error, no polling', async () => {
    const calls = mockFetch(() => ({ status: 200, body: [SITE, { ...SITE, id: 'site_2', name: 'Zweit' }] }));
    const a = createAdapter({ config: baseConfig });
    await a.handlers.ready();
    assert.strictEqual(calls.length, 1);
    assert.ok(a.logs.some(l => l.includes('Several sites')));
});

test.after(() => {
    Module._resolveFilename = origResolve;
    // keep path referenced for linters
    void path;
});
