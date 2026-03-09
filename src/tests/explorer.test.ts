/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { computeNextIndex, ExploreResponse } from '../explorer.js';

describe('Explorer', () => {

    describe('computeNextIndex', () => {

        test('next moves forward within bounds', () => {
            assert.strictEqual(computeNextIndex(0, 10, ExploreResponse.Next), 1);
            assert.strictEqual(computeNextIndex(5, 10, ExploreResponse.Next), 6);
        });

        test('next returns undefined at last build', () => {
            assert.strictEqual(computeNextIndex(9, 10, ExploreResponse.Next), undefined);
        });

        test('previous moves backward within bounds', () => {
            assert.strictEqual(computeNextIndex(5, 10, ExploreResponse.Previous), 4);
            assert.strictEqual(computeNextIndex(1, 10, ExploreResponse.Previous), 0);
        });

        test('previous returns undefined at first build', () => {
            assert.strictEqual(computeNextIndex(0, 10, ExploreResponse.Previous), undefined);
        });

        test('jump to valid index', () => {
            assert.strictEqual(computeNextIndex(0, 10, ExploreResponse.Jump, 5), 5);
            assert.strictEqual(computeNextIndex(3, 10, ExploreResponse.Jump, 0), 0);
            assert.strictEqual(computeNextIndex(3, 10, ExploreResponse.Jump, 9), 9);
        });

        test('jump to invalid index returns undefined', () => {
            assert.strictEqual(computeNextIndex(0, 10, ExploreResponse.Jump, -1), undefined);
            assert.strictEqual(computeNextIndex(0, 10, ExploreResponse.Jump, 10), undefined);
            assert.strictEqual(computeNextIndex(0, 10, ExploreResponse.Jump, undefined), undefined);
        });

        test('quit returns undefined', () => {
            assert.strictEqual(computeNextIndex(0, 10, ExploreResponse.Quit), undefined);
        });
    });
});
