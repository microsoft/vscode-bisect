/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { qualityFromString, Quality } from '../constants.js';

describe('Quality tests', () => {
    test('qualityFromString handles all valid qualities', () => {
        assert.strictEqual(qualityFromString('stable'), Quality.Stable);
        assert.strictEqual(qualityFromString('insider'), Quality.Insider);
        assert.strictEqual(qualityFromString('exploration'), Quality.Exploration);
    });

    test('qualityFromString throws error for unknown quality', () => {
        assert.throws(() => qualityFromString('unknown'), /Unknown quality: unknown/);
    });

    test('Quality enum has all expected values', () => {
        assert.strictEqual(Quality.Stable, 'stable');
        assert.strictEqual(Quality.Insider, 'insider');
        assert.strictEqual(Quality.Exploration, 'exploration');
    });
});