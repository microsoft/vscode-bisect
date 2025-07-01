/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Quality, qualityFromString } from '../constants.js';

describe('Quality functions', () => {
    test('qualityFromString handles all quality values correctly', () => {
        // Test valid quality strings
        assert.strictEqual(qualityFromString('stable'), Quality.Stable);
        assert.strictEqual(qualityFromString('insider'), Quality.Insider);
        assert.strictEqual(qualityFromString('exploration'), Quality.Exploration);
        
        // Test default fallback for undefined
        assert.strictEqual(qualityFromString(undefined), Quality.Insider);
        
        // Test invalid string throws error
        assert.throws(() => qualityFromString('invalid'), /Unknown quality: invalid/);
    });
    
    test('Quality enum values are correct', () => {
        assert.strictEqual(Quality.Stable, 'stable');
        assert.strictEqual(Quality.Insider, 'insider');
        assert.strictEqual(Quality.Exploration, 'exploration');
    });
});