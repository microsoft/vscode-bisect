/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Quality, qualityFromString, setTesting } from '../constants.js';

setTesting(true);

describe('Quality enum', () => {

    test('insider has correct string value', () => {
        assert.strictEqual(Quality.Insider, 'insider');
    });

    test('stable has correct string value', () => {
        assert.strictEqual(Quality.Stable, 'stable');
    });

    test('exploration has correct string value', () => {
        assert.strictEqual(Quality.Exploration, 'exploration');
    });
});

describe('qualityFromString', () => {

    test('parses insider', () => {
        assert.strictEqual(qualityFromString('insider'), Quality.Insider);
    });

    test('parses stable', () => {
        assert.strictEqual(qualityFromString('stable'), Quality.Stable);
    });

    test('parses exploration', () => {
        assert.strictEqual(qualityFromString('exploration'), Quality.Exploration);
    });

    test('defaults to insider for undefined', () => {
        assert.strictEqual(qualityFromString(undefined), Quality.Insider);
    });

    test('throws for unknown quality string', () => {
        assert.throws(
            () => qualityFromString('nightly'),
            /Unknown quality: nightly/
        );
    });
});
