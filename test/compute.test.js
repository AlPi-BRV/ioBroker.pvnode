'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { parseTs, localDate } = require('../lib/time');
const { prepare, computeStates, chartSeries } = require('../lib/compute');

const fixture = name => require(path.join(__dirname, 'fixtures', name));
const TZ = 'Europe/Berlin';

test('parseTs converts naive site-local timestamps (winter, summer, DST)', () => {
    assert.strictEqual(parseTs('2026-11-12T12:00:00', TZ), Date.parse('2026-11-12T11:00:00Z'));
    assert.strictEqual(parseTs('2026-07-01T12:00:00', TZ), Date.parse('2026-07-01T10:00:00Z'));
    assert.strictEqual(parseTs('2026-03-29T03:00:00', TZ), Date.parse('2026-03-29T01:00:00Z'));
    assert.strictEqual(parseTs('2026-11-12T12:00:00Z', TZ), Date.parse('2026-11-12T12:00:00Z'));
    assert.strictEqual(parseTs('2026-11-12T12:00:00+01:00', TZ), Date.parse('2026-11-12T11:00:00Z'));
});

test('energy from 15-min series matches pvnode daily values', () => {
    const p = prepare(fixture('forecast_all.json'));
    const now = parseTs('2026-11-12T06:00:00', TZ);
    const s = computeStates(p, now);
    assert.strictEqual(s['today.date'], '2026-11-12');
    assert.strictEqual(s['today.energy'], 10.58);
    assert.strictEqual(s['tomorrow.energy'], 9.33);
    // before sunrise: remaining == whole day
    assert.ok(Math.abs(s['today.remaining'] - 10.58) < 0.01, `remaining ${s['today.remaining']}`);
    assert.strictEqual(s['today.expected_so_far'], 0);
});

test('current slot, remaining and peak at midday', () => {
    const p = prepare(fixture('forecast_all.json'));
    const now = parseTs('2026-11-12T12:07:30', TZ);
    const s = computeStates(p, now);
    const slot = p.values.find(v => v.timestamp === '2026-11-12T12:00:00');
    assert.strictEqual(s['now.power'], Math.round(slot.pv_power * 10) / 10);
    assert.strictEqual(s['today.peak_time'], '12:45');
    assert.ok(s['today.remaining'] > 0 && s['today.remaining'] < 10.58);
    assert.ok(Math.abs(s['today.remaining'] + s['today.expected_so_far'] - 10.58) < 0.02);
    assert.strictEqual(typeof s['weather.temp'], 'number');
    assert.strictEqual(typeof s['weather.ghi'], 'number');
    assert.strictEqual(typeof s['now.power_clearsky'], 'number');
    assert.strictEqual(s['now.power_min'], undefined, 'no variability on free plan');
});

test('strings sum up to the total', () => {
    const p = prepare(fixture('forecast_all.json'));
    const s = computeStates(p, parseTs('2026-11-12T12:00:00', TZ));
    assert.strictEqual(p.strings.length, 2);
    const sum = s['strings.0.today_energy'] + s['strings.1.today_energy'];
    assert.ok(Math.abs(sum - 10.58) < 0.02, `sum ${sum}`);
    assert.strictEqual(s._dayCount, 2);
    assert.strictEqual(s['days.0.date'], '2026-11-12');
    assert.strictEqual(s['days.1.energy'], 9.33);
});

test('after midnight "today" moves to the next day', () => {
    const p = prepare(fixture('forecast_all.json'));
    const s = computeStates(p, parseTs('2026-11-13T00:10:00', TZ));
    assert.strictEqual(s['today.date'], '2026-11-13');
    assert.strictEqual(s['today.energy'], 9.33);
    assert.strictEqual(s._dayCount, 1);
    assert.strictEqual(s['days.0.date'], '2026-11-13');
});

test('variability band (paid plans) produces min/max states', () => {
    const p = prepare(fixture('forecast_variability.json'));
    assert.ok(p.hasVariability);
    const s = computeStates(p, parseTs('2026-11-12T12:07:00', TZ));
    assert.ok(s['now.power_min'] < s['now.power'] && s['now.power'] < s['now.power_max']);
    assert.strictEqual(s['today.energy_min'], 7.41);
    assert.ok(s['today.remaining_min'] < s['today.remaining_max']);
    assert.ok(typeof s['strings.0.power_max'] === 'number');
});

test('chart series contains totals and strings', () => {
    const p = prepare(fixture('forecast_all.json'));
    const today = localDate(parseTs('2026-11-12T12:00:00', TZ), TZ);
    const series = chartSeries(p, v => localDate(v.t, TZ) === today);
    assert.strictEqual(series.length, 96);
    assert.ok('pv' in series[50] && 's0' in series[50] && 's1' in series[50] && 'clearsky' in series[50]);
});
