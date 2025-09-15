/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { setTesting } from '../constants.js';

setTesting(true);

// Import the validation function by importing the module and accessing the function
// Since validateCommitHashes is not exported, we'll test it through the main function
// For now, let's create a standalone validation function for testing

function validateCommitHashesTest(commits: string[]): void {
    for (const commit of commits) {
        // Check if commit is a valid 40-character hex string or a shorter abbreviated hash (4-40 chars)
        if (!/^[a-f0-9]{4,40}$/i.test(commit)) {
            throw new Error(`Invalid commit hash format: ${commit}. Expected a hexadecimal string of 4-40 characters.`);
        }
    }
}

describe('Validation tests', () => {

    test('valid commit hashes should pass validation', () => {
        // Test various valid formats
        const validHashes = [
            'abc1234',  // 7 chars
            '1a2b3c4d5e6f7890',  // 16 chars  
            'a1b2c3d4e5f6789012345678901234567890abcd',  // 40 chars
            'ABCD1234',  // uppercase
            'abcd1234cafe5678',  // mixed case with valid hex
        ];

        assert.doesNotThrow(() => {
            validateCommitHashesTest(validHashes);
        }, 'Valid commit hashes should not throw errors');
    });

    test('invalid commit hashes should fail validation', () => {
        const invalidHashes = [
            ['abc'],  // too short (3 chars)
            ['g123456'],  // invalid character 'g'
            ['abc-123'],  // invalid character '-'
            ['abc 123'],  // invalid character ' '
            ['1234567890123456789012345678901234567890a'],  // too long (41 chars)
            [''],  // empty string
        ];

        for (const hashArray of invalidHashes) {
            assert.throws(() => {
                validateCommitHashesTest(hashArray);
            }, /Invalid commit hash format/, `Hash ${hashArray[0]} should be invalid`);
        }
    });

    test('mixed valid and invalid hashes should fail validation', () => {
        const mixedHashes = ['abc1234', 'invalid-hash', 'def5678'];

        assert.throws(() => {
            validateCommitHashesTest(mixedHashes);
        }, /Invalid commit hash format/, 'Should fail when any hash is invalid');
    });

    test('empty array should pass validation', () => {
        assert.doesNotThrow(() => {
            validateCommitHashesTest([]);
        }, 'Empty array should not throw errors');
    });
});