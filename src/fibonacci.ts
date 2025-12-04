/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Calculates the nth Fibonacci number.
 * The Fibonacci sequence: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, ...
 * 
 * @param n - The index in the Fibonacci sequence (0-based)
 * @returns The nth Fibonacci number
 * @throws Error if n is negative
 */
export function fibonacci(n: number): number {
    if (n < 0) {
        throw new Error('Fibonacci is not defined for negative numbers');
    }

    if (!Number.isInteger(n)) {
        throw new Error('Fibonacci is only defined for integer values');
    }

    if (n === 0) {
        return 0;
    }

    if (n === 1) {
        return 1;
    }

    let prev = 0;
    let curr = 1;

    for (let i = 2; i <= n; i++) {
        const next = prev + curr;
        prev = curr;
        curr = next;
    }

    return curr;
}

/**
 * Generates an array of Fibonacci numbers from index 0 to n (inclusive).
 * Uses an efficient O(n) iterative approach.
 * 
 * @param n - The highest index to include in the sequence (0-based)
 * @returns An array of Fibonacci numbers from index 0 to n (inclusive)
 * @throws Error if n is negative or not an integer
 */
export function fibonacciSequence(n: number): number[] {
    if (n < 0) {
        throw new Error('Cannot generate a sequence for negative numbers');
    }

    if (!Number.isInteger(n)) {
        throw new Error('Fibonacci sequence is only defined for integer values');
    }

    if (n === 0) {
        return [0];
    }

    const sequence: number[] = [0, 1];

    for (let i = 2; i <= n; i++) {
        sequence.push(sequence[i - 1] + sequence[i - 2]);
    }

    return sequence;
}
