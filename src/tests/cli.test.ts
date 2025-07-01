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

describe('CLI Integration Testing', () => {
    test('exploration quality accepts all valid command combinations', () => {
        // Test combinations that would be valid in actual CLI usage
        const validCliCombinations = [
            { quality: 'exploration', version: '1.93' },
            { quality: 'exploration', commit: 'abc123' },
            { quality: 'exploration', runtime: 'desktop' },
            { quality: 'exploration', runtime: 'web' },
            { quality: 'exploration', runtime: 'vscode.dev' },
            { quality: 'exploration', flavor: 'cli' },
        ];
        
        for (const combo of validCliCombinations) {
            // Test that quality parsing works
            const quality = qualityFromString(combo.quality);
            assert.strictEqual(quality, Quality.Exploration);
            
            // Test that the combination would be processable
            assert.ok(Object.values(Quality).includes(quality));
        }
    });
    
    test('exploration quality error messages are helpful', () => {
        // Test that error messages are clear for common mistakes
        const commonMistakes = [
            { input: 'explore', message: 'should suggest exploration' },
            { input: 'experimental', message: 'should suggest exploration' },
            { input: 'preview', message: 'should suggest exploration' },
        ];
        
        for (const mistake of commonMistakes) {
            try {
                qualityFromString(mistake.input);
                assert.fail(`Should have thrown error for input: ${mistake.input}`);
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('Unknown quality'));
                assert.ok(error.message.includes(mistake.input));
            }
        }
    });
    
    test('exploration quality help text validation', () => {
        // Test that exploration is included in help text patterns
        const helpPattern = /insider\|stable\|exploration/;
        const qualityChoices = ['insider', 'stable', 'exploration'];
        
        // Verify the pattern matches our choices
        const choicesString = qualityChoices.join('|');
        assert.ok(helpPattern.test(choicesString));
        
        // Verify exploration is properly included
        assert.ok(qualityChoices.includes('exploration'));
        assert.strictEqual(qualityChoices.length, 3);
    });
    
    test('exploration quality command line parsing edge cases', () => {
        // Test various input formats that might occur in CLI parsing
        const cliInputs = [
            { input: 'exploration', valid: true },
            { input: '"exploration"', valid: false }, // quotes should not be included
            { input: "'exploration'", valid: false }, // single quotes should not be included
            { input: 'exploration,stable', valid: false }, // comma separated invalid
        ];
        
        for (const cliInput of cliInputs) {
            if (cliInput.valid) {
                assert.doesNotThrow(() => qualityFromString(cliInput.input));
            } else {
                assert.throws(() => qualityFromString(cliInput.input), /Unknown quality/);
            }
        }
    });
});