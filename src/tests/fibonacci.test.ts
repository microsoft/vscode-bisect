/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { fibonacci, fibonacciSequence } from '../fibonacci.js';

describe('Fibonacci tests', () => {

    describe('fibonacci function', () => {

        test('returns 0 for n=0', () => {
            assert.strictEqual(fibonacci(0), 0);
        });

        test('returns 1 for n=1', () => {
            assert.strictEqual(fibonacci(1), 1);
        });

        test('returns 1 for n=2', () => {
            assert.strictEqual(fibonacci(2), 1);
        });

        test('returns correct values for small indices', () => {
            assert.strictEqual(fibonacci(3), 2);
            assert.strictEqual(fibonacci(4), 3);
            assert.strictEqual(fibonacci(5), 5);
            assert.strictEqual(fibonacci(6), 8);
            assert.strictEqual(fibonacci(7), 13);
        });

        test('returns correct value for larger index', () => {
            assert.strictEqual(fibonacci(10), 55);
            assert.strictEqual(fibonacci(20), 6765);
        });

        test('throws error for negative numbers', () => {
            assert.throws(
                () => fibonacci(-1),
                { message: 'Fibonacci is not defined for negative numbers' }
            );
        });

        test('throws error for non-integer values', () => {
            assert.throws(
                () => fibonacci(3.5),
                { message: 'Fibonacci is only defined for integer values' }
            );
        });
    });

    describe('fibonacciSequence function', () => {

        test('returns [0] for n=0', () => {
            assert.deepStrictEqual(fibonacciSequence(0), [0]);
        });

        test('returns [0, 1] for n=1', () => {
            assert.deepStrictEqual(fibonacciSequence(1), [0, 1]);
        });

        test('returns correct sequence for n=5', () => {
            assert.deepStrictEqual(fibonacciSequence(5), [0, 1, 1, 2, 3, 5]);
        });

        test('returns correct sequence for n=10', () => {
            assert.deepStrictEqual(fibonacciSequence(10), [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55]);
        });

        test('throws error for negative numbers', () => {
            assert.throws(
                () => fibonacciSequence(-1),
                { message: 'Cannot generate a sequence for negative numbers' }
            );
        });

        test('throws error for non-integer values', () => {
            assert.throws(
                () => fibonacciSequence(2.5),
                { message: 'Fibonacci sequence is only defined for integer values' }
            );
        });
    });
});
