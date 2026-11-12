'use strict';

const { parseTs, localDate, localTime, isoLocal } = require('./time');

const DEFAULT_SLOT_MS = 15 * 60 * 1000;

/** Fields from the weather / irradiance groups that are exposed for the current slot. */
const WEATHER_FIELDS = [
    'temp',
    'weather_code',
    'wind_speed',
    'relative_humidity',
    'precipitation_mm',
    'snow_water_equivalent',
    'ghi',
    'dhi',
    'bni',
];

const r1 = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
const r2 = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const r3 = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

/**
 * Parse a pvnode forecast payload into time series with epoch timestamps.
 *
 * @param {object} payload forecast response body
 */
function prepare(payload) {
    const tz = payload.timezone || 'UTC';
    const values = (payload.values || [])
        .map(v => ({ ...v, t: parseTs(v.timestamp, tz) }))
        .filter(v => Number.isFinite(v.t))
        .sort((a, b) => a.t - b.t);

    let slotMs = DEFAULT_SLOT_MS;
    if (values.length > 1) {
        const d = values[1].t - values[0].t;
        if (d > 0 && d <= 3600000) {
            slotMs = d;
        }
    }

    const strings = new Map();
    for (const row of payload.strings || []) {
        const idx = Number(row.string_index);
        if (!Number.isInteger(idx)) {
            continue;
        }
        let s = strings.get(idx);
        if (!s) {
            s = { index: idx, id: row.string_id || null, rows: [] };
            strings.set(idx, s);
        }
        const t = parseTs(row.timestamp, tz);
        if (Number.isFinite(t)) {
            s.rows.push({ ...row, t });
        }
    }
    for (const s of strings.values()) {
        s.rows.sort((a, b) => a.t - b.t);
    }

    const hasVariability = values.some(v => typeof v.pv_power_min === 'number');
    const hasClearsky = values.some(v => typeof v.pv_power_clearsky === 'number');
    const hasPower = values.some(v => typeof v.pv_power === 'number');

    return {
        tz,
        slotMs,
        values,
        strings: [...strings.values()].sort((a, b) => a.index - b.index),
        daily: payload.daily || [],
        hasVariability,
        hasClearsky,
        hasPower,
    };
}

/**
 * Energy in kWh of a series between from and to (ms). Each row is the mean power
 * of the slot starting at its timestamp; partial slots are prorated.
 *
 * @param {Array} rows rows with t and the power field
 * @param {number} from epoch ms
 * @param {number} to epoch ms
 * @param {number} slotMs slot length
 * @param {string} [field] power field, default pv_power
 */
function energy(rows, from, to, slotMs, field = 'pv_power') {
    let wh = 0;
    let any = false;
    for (const r of rows) {
        const p = r[field];
        if (typeof p !== 'number') {
            continue;
        }
        const a = Math.max(r.t, from);
        const b = Math.min(r.t + slotMs, to);
        if (b > a) {
            wh += (p * (b - a)) / 3600000;
            any = true;
        }
    }
    return any ? wh / 1000 : null;
}

function currentRow(rows, now, slotMs) {
    for (const r of rows) {
        if (r.t <= now && now < r.t + slotMs) {
            return r;
        }
    }
    return null;
}

function dayBounds(rows, day, tz) {
    const dayRows = rows.filter(r => localDate(r.t, tz) === day);
    return dayRows;
}

function peak(rows, field = 'pv_power') {
    let best = null;
    for (const r of rows) {
        if (typeof r[field] === 'number' && (best === null || r[field] > best[field])) {
            best = r;
        }
    }
    return best && best[field] > 0 ? best : null;
}

/**
 * Compute all state values for "now" from a prepared forecast.
 * Returns a flat object { relativeStateId: value }.
 *
 * @param {ReturnType<typeof prepare>} p prepared forecast
 * @param {number} now epoch ms
 */
function computeStates(p, now) {
    const { tz, slotMs, values } = p;
    const out = {};
    const today = localDate(now, tz);
    // "tomorrow" = first date in the series after today (robust against DST days)
    const dates = [...new Set(values.map(v => localDate(v.t, tz)))].sort();
    const nextDay = dates.find(d => d > today) || localDate(now + 24 * 3600000, tz);

    // ---- now ----
    const cur = currentRow(values, now, slotMs);
    out['now.power'] = cur && p.hasPower ? r1(cur.pv_power) : null;
    if (p.hasVariability) {
        out['now.power_min'] = cur ? r1(cur.pv_power_min) : null;
        out['now.power_max'] = cur ? r1(cur.pv_power_max) : null;
    }
    if (p.hasClearsky) {
        out['now.power_clearsky'] = cur ? r1(cur.pv_power_clearsky) : null;
    }
    out['now.energy_next_hour'] = p.hasPower ? r3(energy(values, now, now + 3600000, slotMs)) : null;
    out['now.slot_start'] = cur ? isoLocal(cur.t, tz) : null;

    // ---- weather of current slot ----
    if (cur) {
        for (const f of WEATHER_FIELDS) {
            if (f in cur) {
                out[`weather.${f}`] = typeof cur[f] === 'number' ? r1(cur[f]) : cur[f];
            }
        }
    }

    // ---- today / tomorrow ----
    const dailyByDate = new Map(p.daily.map(d => [d.date, d]));
    const fillDay = (prefix, day, withRemaining) => {
        const rows = dayBounds(values, day, tz);
        const d = dailyByDate.get(day);
        out[`${prefix}.date`] = day;
        const calc = rows.length ? energy(rows, -Infinity, Infinity, slotMs) : null;
        out[`${prefix}.energy`] = r2(d && typeof d.pv_energy_kwh === 'number' ? d.pv_energy_kwh : calc);
        if (p.hasVariability) {
            out[`${prefix}.energy_min`] = r2(
                d ? d.pv_energy_kwh_min : energy(rows, -Infinity, Infinity, slotMs, 'pv_power_min'),
            );
            out[`${prefix}.energy_max`] = r2(
                d ? d.pv_energy_kwh_max : energy(rows, -Infinity, Infinity, slotMs, 'pv_power_max'),
            );
        }
        const pk = peak(rows);
        out[`${prefix}.peak_power`] = pk ? r1(pk.pv_power) : null;
        out[`${prefix}.peak_time`] = pk ? localTime(pk.t, tz) : null;
        if (withRemaining) {
            const rem = rows.length ? energy(rows, now, Infinity, slotMs) : null;
            out[`${prefix}.remaining`] = r2(rem === null && rows.length ? 0 : rem);
            const done = rows.length ? energy(rows, -Infinity, now, slotMs) : null;
            out[`${prefix}.expected_so_far`] = r2(done === null && rows.length ? 0 : done);
            if (p.hasVariability) {
                out[`${prefix}.remaining_min`] = r2(energy(rows, now, Infinity, slotMs, 'pv_power_min') ?? 0);
                out[`${prefix}.remaining_max`] = r2(energy(rows, now, Infinity, slotMs, 'pv_power_max') ?? 0);
            }
        }
    };
    fillDay('today', today, true);
    fillDay('tomorrow', nextDay, false);

    // ---- days.N (0 = today) ----
    const futureDaily = p.daily.filter(d => d.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
    out._dayCount = futureDaily.length;
    futureDaily.forEach((d, i) => {
        const pre = `days.${i}`;
        out[`${pre}.date`] = d.date;
        out[`${pre}.energy`] = r2(d.pv_energy_kwh);
        if (p.hasVariability) {
            out[`${pre}.energy_min`] = r2(d.pv_energy_kwh_min);
            out[`${pre}.energy_max`] = r2(d.pv_energy_kwh_max);
        }
        if ('pv_energy_kwh_clearsky' in d) {
            out[`${pre}.energy_clearsky`] = r2(d.pv_energy_kwh_clearsky);
        }
        if ('temp_min' in d) {
            out[`${pre}.temp_min`] = r1(d.temp_min);
        }
        if ('temp_max' in d) {
            out[`${pre}.temp_max`] = r1(d.temp_max);
        }
        if ('weather_code' in d) {
            out[`${pre}.weather_code`] = d.weather_code;
        }
    });

    // ---- strings ----
    for (const s of p.strings) {
        const pre = `strings.${s.index}`;
        const c = currentRow(s.rows, now, slotMs);
        out[`${pre}.power`] = c ? r1(c.pv_power) : null;
        if (p.hasVariability) {
            out[`${pre}.power_min`] = c ? r1(c.pv_power_min) : null;
            out[`${pre}.power_max`] = c ? r1(c.pv_power_max) : null;
        }
        out[`${pre}.gti`] = c ? r1(c.gti) : null;
        const tRows = dayBounds(s.rows, today, tz);
        const mRows = dayBounds(s.rows, nextDay, tz);
        out[`${pre}.today_energy`] = r2(tRows.length ? energy(tRows, -Infinity, Infinity, slotMs) : null);
        out[`${pre}.today_remaining`] = r2(tRows.length ? (energy(tRows, now, Infinity, slotMs) ?? 0) : null);
        out[`${pre}.tomorrow_energy`] = r2(mRows.length ? energy(mRows, -Infinity, Infinity, slotMs) : null);
    }

    return out;
}

/**
 * Compact JSON series for charts: [{t, pv, pv_min, pv_max, clearsky, s0, s1, ...}]
 * t = epoch ms, power in W.
 *
 * @param {ReturnType<typeof prepare>} p prepared forecast
 * @param {(row: object) => boolean} [filter] row filter
 */
function chartSeries(p, filter) {
    const byT = new Map();
    for (const s of p.strings) {
        for (const r of s.rows) {
            let m = byT.get(r.t);
            if (!m) {
                m = {};
                byT.set(r.t, m);
            }
            m[`s${s.index}`] = r1(r.pv_power);
        }
    }
    const out = [];
    for (const v of p.values) {
        if (filter && !filter(v)) {
            continue;
        }
        const e = { t: v.t };
        if (typeof v.pv_power === 'number') {
            e.pv = r1(v.pv_power);
        }
        if (p.hasVariability) {
            e.pv_min = r1(v.pv_power_min);
            e.pv_max = r1(v.pv_power_max);
        }
        if (p.hasClearsky) {
            e.clearsky = r1(v.pv_power_clearsky);
        }
        Object.assign(e, byT.get(v.t) || {});
        out.push(e);
    }
    return out;
}

module.exports = { prepare, computeStates, chartSeries, energy, WEATHER_FIELDS };
