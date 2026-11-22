'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { LANGS, DEFS, CHANNELS, FIXED, REFRESH_NAME, channelName, stringChannelName } = require('../lib/states');

const complete = name => typeof name === 'object' && LANGS.every(l => typeof name[l] === 'string' && name[l].length > 0);

test('all static names are translated into 11 languages', () => {
    assert.strictEqual(LANGS.length, 11);
    for (const [k, d] of Object.entries(DEFS)) {
        assert.ok(complete(d.name), `DEFS.${k}`);
    }
    for (const [k, n] of Object.entries(CHANNELS)) {
        assert.ok(complete(n), `CHANNELS.${k}`);
    }
    for (const [k, d] of Object.entries(FIXED)) {
        assert.ok(complete(d.name), `FIXED.${k}`);
        assert.notStrictEqual(d.type, 'mixed', `FIXED.${k}`);
    }
    assert.ok(complete(REFRESH_NAME));
});

test('day and string channel names are built for all languages', () => {
    for (let n = 0; n < 8; n++) {
        assert.ok(complete(channelName(`days.${n}`)), `days.${n}`);
        assert.ok(complete(channelName(`strings.${n}`)), `strings.${n}`);
    }
    assert.strictEqual(channelName('days.3').de, 'In 3 Tagen');
    assert.strictEqual(channelName('days.6').ru, 'Через 6 дней');
    assert.strictEqual(channelName('days.2').uk, 'Через 2 дні');
    const s = stringChannelName(1, { orientation: 270, slope: 13, power_kw: 6.7 });
    assert.ok(complete(s));
    assert.strictEqual(s.en, 'String 2: azimuth 270°, tilt 13°, 6.7 kWp');
});
