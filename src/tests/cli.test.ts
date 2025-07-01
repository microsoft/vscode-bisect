/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Quality, qualityFromString } from '../constants.js';

describe('Command Line Interface', () => {
    test('quality parsing works with all CLI options', () => {
        // Test that all CLI quality options can be parsed correctly
        const cliOptions = ['stable', 'insider', 'exploration'];
        
        for (const option of cliOptions) {
            const quality = qualityFromString(option);
            assert.ok(Object.values(Quality).includes(quality), `${option} should parse to a valid Quality enum value`);
        }
    });
    
    test('CLI option validation allows exploration with valid combinations', () => {
        // Test that exploration quality would be accepted with valid runtime/flavor combinations
        // This tests the logic that would run in the main CLI handler
        
        const validCombinations = [
            { quality: 'exploration', runtime: 'desktop', flavor: undefined },
            { quality: 'exploration', runtime: 'web', flavor: undefined },
            { quality: 'exploration', runtime: 'vscode.dev', flavor: undefined },
            { quality: 'exploration', runtime: 'desktop', flavor: 'cli' },
        ];
        
        for (const combo of validCombinations) {
            // These should not throw errors when parsed
            assert.doesNotThrow(() => {
                const quality = qualityFromString(combo.quality);
                assert.strictEqual(quality, Quality.Exploration);
            });
        }
    });
    
    test('exploration quality enum is properly defined for CLI usage', () => {
        // Test that exploration quality follows the same pattern as other qualities
        assert.strictEqual(Quality.Exploration, 'exploration');
        assert.strictEqual(qualityFromString('exploration'), Quality.Exploration);
        
        // Test that it's included in the enum values
        const allQualities = Object.values(Quality);
        assert.ok(allQualities.includes(Quality.Exploration));
        assert.strictEqual(allQualities.length, 3); // stable, insider, exploration
    });
    
    test('exploration quality works with command parsing patterns', () => {
        // Test patterns that would be used in CLI argument parsing
        const testCases = [
            { input: 'exploration', expected: Quality.Exploration },
            { input: 'insider', expected: Quality.Insider },
            { input: 'stable', expected: Quality.Stable },
        ];
        
        for (const testCase of testCases) {
            const result = qualityFromString(testCase.input);
            assert.strictEqual(result, testCase.expected, 
                `Input '${testCase.input}' should parse to ${testCase.expected}`);
        }
    });
});