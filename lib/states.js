'use strict';

/**
 * State definitions, looked up by the last segment of the state id.
 * Names are given in English and German.
 */
const DEFS = {
    power: { name: { en: 'PV power forecast', de: 'PV-Leistung Prognose' }, unit: 'W', role: 'value.power' },
    power_min: {
        name: { en: 'PV power forecast (lower band)', de: 'PV-Leistung Prognose (unteres Band)' },
        unit: 'W',
        role: 'value.power',
    },
    power_max: {
        name: { en: 'PV power forecast (upper band)', de: 'PV-Leistung Prognose (oberes Band)' },
        unit: 'W',
        role: 'value.power',
    },
    power_clearsky: {
        name: { en: 'PV power at clear sky', de: 'PV-Leistung bei klarem Himmel' },
        unit: 'W',
        role: 'value.power',
    },
    energy_next_hour: {
        name: { en: 'Expected energy next hour', de: 'Erwartete Energie nächste Stunde' },
        unit: 'kWh',
        role: 'value.energy',
    },
    slot_start: {
        name: { en: 'Start of current forecast slot', de: 'Beginn des aktuellen Prognose-Intervalls' },
        type: 'string',
        role: 'text',
    },

    date: { name: { en: 'Date', de: 'Datum' }, type: 'string', role: 'text' },
    energy: { name: { en: 'Energy forecast', de: 'Energie Prognose' }, unit: 'kWh', role: 'value.energy' },
    energy_min: {
        name: { en: 'Energy forecast (lower band)', de: 'Energie Prognose (unteres Band)' },
        unit: 'kWh',
        role: 'value.energy',
    },
    energy_max: {
        name: { en: 'Energy forecast (upper band)', de: 'Energie Prognose (oberes Band)' },
        unit: 'kWh',
        role: 'value.energy',
    },
    energy_clearsky: {
        name: { en: 'Energy at clear sky', de: 'Energie bei klarem Himmel' },
        unit: 'kWh',
        role: 'value.energy',
    },
    remaining: { name: { en: 'Remaining energy today', de: 'Restertrag heute' }, unit: 'kWh', role: 'value.energy' },
    remaining_min: {
        name: { en: 'Remaining energy today (lower band)', de: 'Restertrag heute (unteres Band)' },
        unit: 'kWh',
        role: 'value.energy',
    },
    remaining_max: {
        name: { en: 'Remaining energy today (upper band)', de: 'Restertrag heute (oberes Band)' },
        unit: 'kWh',
        role: 'value.energy',
    },
    expected_so_far: {
        name: { en: 'Expected energy until now', de: 'Erwarteter Ertrag bis jetzt' },
        unit: 'kWh',
        role: 'value.energy',
    },
    peak_power: { name: { en: 'Peak power', de: 'Spitzenleistung' }, unit: 'W', role: 'value.power' },
    peak_time: { name: { en: 'Time of peak power', de: 'Uhrzeit der Spitzenleistung' }, type: 'string', role: 'text' },
    temp_min: {
        name: { en: 'Minimum temperature', de: 'Tiefsttemperatur' },
        unit: '°C',
        role: 'value.temperature.min',
    },
    temp_max: {
        name: { en: 'Maximum temperature', de: 'Höchsttemperatur' },
        unit: '°C',
        role: 'value.temperature.max',
    },
    weather_code: { name: { en: 'Weather code (WMO)', de: 'Wettercode (WMO)' }, role: 'value' },

    temp: { name: { en: 'Temperature', de: 'Temperatur' }, unit: '°C', role: 'value.temperature' },
    wind_speed: { name: { en: 'Wind speed', de: 'Windgeschwindigkeit' }, role: 'value.speed.wind' },
    relative_humidity: {
        name: { en: 'Relative humidity', de: 'Relative Luftfeuchtigkeit' },
        unit: '%',
        role: 'value.humidity',
    },
    precipitation_mm: { name: { en: 'Precipitation', de: 'Niederschlag' }, unit: 'mm', role: 'value.precipitation' },
    snow_water_equivalent: { name: { en: 'Snow water equivalent', de: 'Schnee-Wasser-Äquivalent' }, role: 'value' },
    ghi: {
        name: { en: 'Global horizontal irradiance', de: 'Globalstrahlung horizontal' },
        unit: 'W/m²',
        role: 'value',
    },
    dhi: {
        name: { en: 'Diffuse horizontal irradiance', de: 'Diffusstrahlung horizontal' },
        unit: 'W/m²',
        role: 'value',
    },
    bni: { name: { en: 'Beam normal irradiance', de: 'Direktnormalstrahlung' }, unit: 'W/m²', role: 'value' },
    gti: { name: { en: 'Irradiance on module plane', de: 'Einstrahlung auf Modulebene' }, unit: 'W/m²', role: 'value' },

    today_energy: {
        name: { en: 'Energy forecast today', de: 'Energie Prognose heute' },
        unit: 'kWh',
        role: 'value.energy',
    },
    today_remaining: {
        name: { en: 'Remaining energy today', de: 'Restertrag heute' },
        unit: 'kWh',
        role: 'value.energy',
    },
    tomorrow_energy: {
        name: { en: 'Energy forecast tomorrow', de: 'Energie Prognose morgen' },
        unit: 'kWh',
        role: 'value.energy',
    },

    string_id: { name: { en: 'String ID', de: 'String-ID' }, type: 'string', role: 'text' },
    orientation: { name: { en: 'Orientation (azimuth)', de: 'Ausrichtung (Azimut)' }, unit: '°', role: 'value' },
    slope: { name: { en: 'Tilt', de: 'Neigung' }, unit: '°', role: 'value' },
    power_kw: { name: { en: 'Installed power', de: 'Installierte Leistung' }, unit: 'kWp', role: 'value' },
};

const CHANNELS = {
    now: { en: 'Current forecast values', de: 'Aktuelle Prognosewerte' },
    today: { en: 'Today', de: 'Heute' },
    tomorrow: { en: 'Tomorrow', de: 'Morgen' },
    days: { en: 'Daily forecast (0 = today)', de: 'Tagesprognose (0 = heute)' },
    strings: { en: 'Strings / module areas', de: 'Strings / Modulflächen' },
    weather: { en: 'Weather and irradiance (current slot)', de: 'Wetter und Einstrahlung (aktuelles Intervall)' },
    json: { en: 'JSON data for charts', de: 'JSON-Daten für Diagramme' },
    html: { en: 'Ready-made SVG charts for VIS', de: 'Fertige SVG-Diagramme für VIS' },
    site: { en: 'Site', de: 'Standort' },
    control: { en: 'Control', de: 'Steuerung' },
};

/**
 * Common definition for a relative state id.
 *
 * @param {string} id relative id, e.g. "today.energy"
 */
function commonFor(id) {
    const last = id.split('.').pop();
    const d = DEFS[last] || { name: last, role: 'value' };
    const common = {
        name: d.name,
        type: d.type || 'number',
        role: d.role,
        read: true,
        write: false,
    };
    if (d.unit) {
        common.unit = d.unit;
    }
    return common;
}

module.exports = { DEFS, CHANNELS, commonFor };
