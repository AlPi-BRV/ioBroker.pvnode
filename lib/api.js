'use strict';

const BASE_URL = 'https://api.pvnode.com';
const TIMEOUT_MS = 30000;

class PvnodeError extends Error {
    /**
     * @param {string} message error message
     * @param {number} status HTTP status (0 = network error)
     * @param {string} detail detail text from the API
     * @param {object} quota parsed quota headers
     */
    constructor(message, status, detail, quota) {
        super(message);
        this.name = 'PvnodeError';
        this.status = status;
        this.detail = detail || '';
        this.quota = quota || null;
    }
}

/**
 * Parse the RequestLimit-* headers. Limit/Remaining may be "unmetered".
 *
 * @param {Headers} headers fetch response headers
 */
function parseQuota(headers) {
    const limit = headers.get('requestlimit-limit');
    if (limit === null) {
        return null;
    }
    const num = v => (v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
    return {
        limit: num(limit),
        used: num(headers.get('requestlimit-used')),
        remaining: num(headers.get('requestlimit-remaining')),
        reset: headers.get('requestlimit-reset'),
    };
}

class PvnodeApi {
    /**
     * @param {string} apiKey pvnode API key
     * @param {string} userAgent User-Agent header value
     */
    constructor(apiKey, userAgent) {
        this.apiKey = apiKey;
        this.userAgent = userAgent;
    }

    async _get(path) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        let res;
        try {
            res = await fetch(BASE_URL + path, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'User-Agent': this.userAgent,
                    Accept: 'application/json',
                },
                signal: ctrl.signal,
            });
        } catch (err) {
            throw new PvnodeError(`Network error: ${err.name === 'AbortError' ? 'timeout' : err.message}`, 0, '', null);
        } finally {
            clearTimeout(timer);
        }
        const quota = parseQuota(res.headers);
        const text = await res.text();
        let body = null;
        try {
            body = text ? JSON.parse(text) : null;
        } catch {
            body = null;
        }
        if (!res.ok) {
            const detail = body && typeof body.detail === 'string' ? body.detail : text.slice(0, 300);
            throw new PvnodeError(`HTTP ${res.status}: ${detail}`, res.status, detail, quota);
        }
        if (body === null) {
            throw new PvnodeError('Invalid JSON response', res.status, text.slice(0, 300), quota);
        }
        return { body, quota };
    }

    /** List sites. Does not consume forecast quota; validates the key (401 = invalid). */
    async getSites() {
        const { body } = await this._get('/v2/sites/');
        return Array.isArray(body) ? body : [];
    }

    /**
     * Get forecast for a saved site.
     *
     * @param {string} siteId site id
     * @param {string[]} include include groups
     * @param {number} [forecastDays] 0/undefined = plan maximum
     */
    async getForecast(siteId, include, forecastDays) {
        const params = new URLSearchParams();
        for (const g of include) {
            params.append('include', g);
        }
        if (forecastDays && forecastDays > 0) {
            params.set('forecast_days', String(forecastDays));
        }
        return this._get(`/v2/forecast/${encodeURIComponent(siteId)}?${params.toString()}`);
    }
}

module.exports = { PvnodeApi, PvnodeError, parseQuota };
