'use strict';

/*
 * Ready-to-use SVG charts for VIS 1 / VIS 2 / any HTML widget.
 * Rendered from the prepared forecast, no browser libraries needed.
 */

const { localDate, localTime } = require('./time');

const COLORS = {
    total: '#a6ff1e',
    strings: ['#ffb000', '#3fc1ff', '#ff6b9a', '#b48cff', '#5be3b0', '#ff8a3d', '#e0e0e0', '#8fa3ff'],
    clearsky: '#8a94a6',
    band: '#a6ff1e',
    grid: 'rgba(255,255,255,0.10)',
    axis: 'rgba(255,255,255,0.55)',
    now: '#ffc400',
    bar: '#a6ff1e',
    barMuted: 'rgba(166,255,30,0.35)',
};

const TEXT = {
    de: { now: 'Jetzt', total: 'Gesamt', clearsky: 'Klarer Himmel', string: 'String', today: 'Heute', tomorrow: 'Morgen', days: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], noData: 'Keine Daten' },
    en: { now: 'Now', total: 'Total', clearsky: 'Clear sky', string: 'String', today: 'Today', tomorrow: 'Tomorrow', days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], noData: 'No data' },
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

function niceMax(v) {
    if (v <= 0) {
        return 1000;
    }
    const exp = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
        if (m * exp >= v) {
            return m * exp;
        }
    }
    return 10 * exp;
}

function pathFrom(points) {
    return points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
}

/**
 * Daily power curve for one day (default today) with strings and a "now" marker.
 *
 * @param {object} p prepared forecast (lib/compute prepare)
 * @param {number} now epoch ms
 * @param {object} [opt] options
 * @param {string} [opt.lang] 'de' | 'en'
 * @param {string} [opt.day] YYYY-MM-DD, default today
 * @param {string[]} [opt.stringNames] names per string index
 */
function dayChart(p, now, opt = {}) {
    const T = TEXT[opt.lang] || TEXT.de;
    const W = 1000;
    const H = 360;
    const m = { l: 56, r: 16, t: 34, b: 34 };
    const tz = p.tz;
    const day = opt.day || localDate(now, tz);
    const rows = p.values.filter(v => localDate(v.t, tz) === day && typeof v.pv_power === 'number');
    if (!rows.length) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%"><text x="${W / 2}" y="${H / 2}" fill="${COLORS.axis}" font-family="sans-serif" font-size="22" text-anchor="middle">${T.noData}</text></svg>`;
    }

    // x range: one hour before first / after last production, full hours
    const prod = rows.filter(r => r.pv_power > 0 || (r.pv_power_clearsky || 0) > 0);
    const H1 = 3600000;
    const first = prod.length ? prod[0].t : rows[0].t;
    const last = prod.length ? prod[prod.length - 1].t + p.slotMs : rows[rows.length - 1].t + p.slotMs;
    const x0 = Math.floor((first - H1) / H1) * H1;
    const x1 = Math.ceil((last + H1) / H1) * H1;

    const series = rows.filter(r => r.t >= x0 && r.t <= x1);
    let maxW = 0;
    for (const r of series) {
        maxW = Math.max(maxW, r.pv_power, r.pv_power_max || 0, r.pv_power_clearsky || 0);
    }
    const yMax = niceMax(maxW * 1.05);
    const X = t => m.l + ((t + p.slotMs / 2 - x0) / (x1 - x0)) * (W - m.l - m.r);
    const Y = v => H - m.b - (v / yMax) * (H - m.t - m.b);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" font-family="Segoe UI, Roboto, Arial, sans-serif">`;
    svg += `<defs><linearGradient id="pvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLORS.total}" stop-opacity="0.45"/><stop offset="1" stop-color="${COLORS.total}" stop-opacity="0.02"/></linearGradient></defs>`;

    // grid + y labels (kW)
    for (let i = 0; i <= 4; i++) {
        const v = (yMax / 4) * i;
        const y = Y(v);
        svg += `<line x1="${m.l}" y1="${y}" x2="${W - m.r}" y2="${y}" stroke="${COLORS.grid}"/>`;
        svg += `<text x="${m.l - 8}" y="${y + 5}" fill="${COLORS.axis}" font-size="14" text-anchor="end">${fmt(v / 1000, v / 1000 < 10 && yMax < 10000 ? 1 : 0)}</text>`;
    }
    svg += `<text x="${m.l - 8}" y="${m.t - 14}" fill="${COLORS.axis}" font-size="13" text-anchor="end">kW</text>`;

    // x labels every 2 h
    for (let t = x0; t <= x1; t += H1) {
        const hh = Number(localTime(t, tz).slice(0, 2));
        if (hh % 2 === 0) {
            const x = m.l + ((t - x0) / (x1 - x0)) * (W - m.l - m.r);
            svg += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${H - m.b}" stroke="${COLORS.grid}"/>`;
            svg += `<text x="${x}" y="${H - m.b + 22}" fill="${COLORS.axis}" font-size="14" text-anchor="middle">${String(hh).padStart(2, '0')}:00</text>`;
        }
    }

    // variability band
    if (p.hasVariability) {
        const up = series.map(r => [X(r.t), Y(r.pv_power_max || r.pv_power)]);
        const lo = series.map(r => [X(r.t), Y(r.pv_power_min || r.pv_power)]).reverse();
        svg += `<path d="${pathFrom(up.concat(lo))}Z" fill="${COLORS.band}" fill-opacity="0.12"/>`;
    }
    // clear sky
    if (p.hasClearsky) {
        svg += `<path d="${pathFrom(series.map(r => [X(r.t), Y(r.pv_power_clearsky || 0)]))}" fill="none" stroke="${COLORS.clearsky}" stroke-width="2" stroke-dasharray="6 6"/>`;
    }
    // total area + line
    const pts = series.map(r => [X(r.t), Y(r.pv_power)]);
    svg += `<path d="${pathFrom(pts)}L${pts[pts.length - 1][0]},${Y(0)}L${pts[0][0]},${Y(0)}Z" fill="url(#pvg)"/>`;
    svg += `<path d="${pathFrom(pts)}" fill="none" stroke="${COLORS.total}" stroke-width="3" stroke-linejoin="round"/>`;

    // strings
    const legend = [{ c: COLORS.total, n: T.total }];
    if (p.strings.length > 1) {
        p.strings.forEach((s, i) => {
            const sr = s.rows.filter(r => r.t >= x0 && r.t <= x1 && localDate(r.t, tz) === day);
            const c = COLORS.strings[i % COLORS.strings.length];
            svg += `<path d="${pathFrom(sr.map(r => [X(r.t), Y(r.pv_power || 0)]))}" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-opacity="0.9"/>`;
            legend.push({ c, n: (opt.stringNames && opt.stringNames[s.index]) || `${T.string} ${s.index + 1}` });
        });
    }
    if (p.hasClearsky) {
        legend.push({ c: COLORS.clearsky, n: T.clearsky, dash: true });
    }

    // now marker
    if (now >= x0 && now <= x1 && localDate(now, tz) === day) {
        const x = m.l + ((now - x0) / (x1 - x0)) * (W - m.l - m.r);
        const cur = series.find(r => r.t <= now && now < r.t + p.slotMs);
        svg += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${H - m.b}" stroke="${COLORS.now}" stroke-width="2" stroke-dasharray="4 4"/>`;
        if (cur) {
            svg += `<circle cx="${x}" cy="${Y(cur.pv_power)}" r="6" fill="${COLORS.now}" stroke="#1c2430" stroke-width="2"/>`;
        }
        const label = `${T.now} ${localTime(now, tz)}${cur ? ` · ${fmt(cur.pv_power / 1000, 2)} kW` : ''}`;
        const anchor = x > W - 200 ? 'end' : 'start';
        svg += `<text x="${x + (anchor === 'start' ? 8 : -8)}" y="${m.t + 4}" fill="${COLORS.now}" font-size="14" text-anchor="${anchor}">${esc(label)}</text>`;
    }

    // legend (top right)
    let lx = W - m.r;
    for (const l of legend.reverse()) {
        const w = 26 + l.n.length * 7.6;
        lx -= w;
        svg += `<line x1="${lx}" y1="14" x2="${lx + 16}" y2="14" stroke="${l.c}" stroke-width="3"${l.dash ? ' stroke-dasharray="4 3"' : ''}/>`;
        svg += `<text x="${lx + 21}" y="19" fill="${COLORS.axis}" font-size="13">${esc(l.n)}</text>`;
        lx -= 10;
    }

    svg += '</svg>';
    return svg;
}

/**
 * Bar chart of the daily energy forecast (all forecast days).
 *
 * @param {object} p prepared forecast
 * @param {number} now epoch ms
 * @param {object} [opt] options
 * @param {string} [opt.lang] 'de' | 'en'
 */
function daysChart(p, now, opt = {}) {
    const T = TEXT[opt.lang] || TEXT.de;
    const today = localDate(now, p.tz);
    const days = p.daily.filter(d => d.date >= today && typeof d.pv_energy_kwh === 'number');
    const W = 600;
    const H = 245;
    const m = { l: 10, r: 10, t: 30, b: 52 };
    if (!days.length) {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%"><text x="${W / 2}" y="${H / 2}" fill="${COLORS.axis}" font-family="sans-serif" font-size="22" text-anchor="middle">${T.noData}</text></svg>`;
    }
    const maxV = Math.max(...days.map(d => Math.max(d.pv_energy_kwh, d.pv_energy_kwh_max || 0, d.pv_energy_kwh_clearsky || 0)));
    const yMax = niceMax(maxV * 1.1);
    const slot = (W - m.l - m.r) / Math.max(days.length, 2);
    const bw = Math.min(slot * 0.55, 110);
    const Y = v => H - m.b - (v / yMax) * (H - m.t - m.b);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" font-family="Segoe UI, Roboto, Arial, sans-serif">`;
    svg += `<line x1="${m.l}" y1="${Y(0)}" x2="${W - m.r}" y2="${Y(0)}" stroke="${COLORS.grid}"/>`;
    const offset = days.length === 1 ? slot / 2 : 0;
    days.forEach((d, i) => {
        const cx = m.l + offset + slot * i + slot / 2;
        const y = Y(d.pv_energy_kwh);
        if (typeof d.pv_energy_kwh_clearsky === 'number') {
            const yc = Y(d.pv_energy_kwh_clearsky);
            svg += `<rect x="${cx - bw / 2}" y="${yc}" width="${bw}" height="${Y(0) - yc}" rx="8" fill="none" stroke="${COLORS.clearsky}" stroke-dasharray="5 4"/>`;
        }
        svg += `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${Math.max(Y(0) - y, 0)}" rx="8" fill="${i === 0 ? COLORS.bar : COLORS.barMuted}"/>`;
        if (typeof d.pv_energy_kwh_min === 'number' && typeof d.pv_energy_kwh_max === 'number') {
            svg += `<line x1="${cx}" y1="${Y(d.pv_energy_kwh_min)}" x2="${cx}" y2="${Y(d.pv_energy_kwh_max)}" stroke="#ffffff" stroke-opacity="0.7" stroke-width="2"/>`;
        }
        const many = days.length > 3;
        const top = Math.min(y, typeof d.pv_energy_kwh_max === 'number' ? Y(d.pv_energy_kwh_max) : y);
        svg += `<text x="${cx}" y="${top - 8}" fill="#ffffff" font-size="${many ? 16 : 20}" font-weight="600" text-anchor="middle">${fmt(d.pv_energy_kwh, 1)}${many ? '' : ' kWh'}</text>`;
        const dt = new Date(`${d.date}T12:00:00Z`);
        const label = i === 0 ? T.today : i === 1 ? T.tomorrow : `${T.days[dt.getUTCDay()]} ${d.date.slice(8, 10)}.${d.date.slice(5, 7)}.`;
        svg += `<text x="${cx}" y="${H - m.b + 24}" fill="#ffffff" font-size="${days.length > 3 ? 13 : 16}" text-anchor="middle">${esc(label)}</text>`;
        if (typeof d.temp_min === 'number' && typeof d.temp_max === 'number') {
            svg += `<text x="${cx}" y="${H - m.b + 44}" fill="${COLORS.axis}" font-size="${days.length > 3 ? 12 : 14}" text-anchor="middle">${fmt(d.temp_min, 0)}° / ${fmt(d.temp_max, 0)}°</text>`;
        }
    });
    svg += '</svg>';
    return svg;
}

module.exports = { dayChart, daysChart };
