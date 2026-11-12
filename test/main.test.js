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
    assert.ok(a.objects.get('strings.0').common.name.includes('O 90°'));
    assert.strictEqual(v('strings.1.string_id'), 'str_ea5be30e');
    assert.ok(typeof v('today.remaining') === 'number');
    assert.ok(a.objects.has('weather.temp'));
    assert.ok(!a.objects.has('now.power_min'));
    assert.ok(JSON.parse(v('json.today')).length === 96);

    const poll = a.timers.find(t => t.type === 'timeout' && t.ms > 3600000);
    assert.ok(poll, 'poll scheduled from next_poll_at');
    assert.ok(Math.abs(poll.ms - (3 * 3600000 + 30000)) < 5000, `delay ${poll.ms}`);

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
    assert.ok(poll && Math.abs(poll.ms - 5 * 3600000) < 60000, `delay ${poll && poll.ms}`);
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
