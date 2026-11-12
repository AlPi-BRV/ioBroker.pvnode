'use strict';

/**
 * Time helpers. pvnode returns site-local timestamps without offset
 * ("2026-11-12T12:00:00") when timezone=local. We convert them to epoch ms
 * using the site's IANA timezone, independent of the ioBroker host timezone.
 */

const dtfCache = new Map();
const fmtCache = new Map();

function cachedFormat(key, locale, opts) {
    let f = fmtCache.get(key);
    if (!f) {
        f = new Intl.DateTimeFormat(locale, opts);
        fmtCache.set(key, f);
    }
    return f;
}

function getDtf(tz) {
    let dtf = dtfCache.get(tz);
    if (!dtf) {
        dtf = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
        dtfCache.set(tz, dtf);
    }
    return dtf;
}

/**
 * Offset of a timezone at a given instant in ms (local - UTC).
 *
 * @param {number} ms epoch ms
 * @param {string} tz IANA timezone
 */
function tzOffsetMs(ms, tz) {
    const parts = {};
    for (const p of getDtf(tz).formatToParts(new Date(ms))) {
        parts[p.type] = p.value;
    }
    const asUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
    );
    return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * Parse a pvnode timestamp to epoch ms.
 *
 * @param {string} s timestamp, with or without offset
 * @param {string} tz site timezone used for naive timestamps
 */
function parseTs(s, tz) {
    if (typeof s !== 'string') {
        return NaN;
    }
    if (/(Z|[+-]\d\d:?\d\d)$/.test(s)) {
        return Date.parse(s);
    }
    const guess = Date.parse(`${s}Z`);
    if (!tz || Number.isNaN(guess)) {
        return guess;
    }
    const off1 = tzOffsetMs(guess, tz);
    let t = guess - off1;
    const off2 = tzOffsetMs(t, tz);
    if (off2 !== off1) {
        t = guess - off2;
    }
    return t;
}

/**
 * Local date string YYYY-MM-DD of an instant in a timezone.
 *
 * @param {number} ms epoch ms
 * @param {string} tz IANA timezone
 */
function localDate(ms, tz) {
    return cachedFormat(`d|${tz}`, 'en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(ms));
}

/**
 * Local time HH:MM of an instant in a timezone.
 *
 * @param {number} ms epoch ms
 * @param {string} tz IANA timezone
 */
function localTime(ms, tz) {
    return cachedFormat(`t|${tz}`, 'de-DE', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(new Date(ms));
}

/**
 * ISO string with the timezone's offset, e.g. 2026-11-12T12:00:00+01:00
 *
 * @param {number} ms epoch ms
 * @param {string} tz IANA timezone
 */
function isoLocal(ms, tz) {
    const off = tzOffsetMs(ms, tz);
    const d = new Date(ms + off);
    const sign = off >= 0 ? '+' : '-';
    const abs = Math.abs(off) / 60000;
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${d.toISOString().slice(0, 19)}${sign}${hh}:${mm}`;
}

module.exports = { tzOffsetMs, parseTs, localDate, localTime, isoLocal };
