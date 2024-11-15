/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { https } from 'follow-redirects';
import { createWriteStream, promises } from 'fs';
import { dirname } from 'path';
import { OutgoingHttpHeaders } from 'http';
import chalk from 'chalk';
import ProgressBar from 'progress';

export function jsonGet<T>(url: string, headers?: OutgoingHttpHeaders): Promise<T> {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, res => {
            if (res.statusCode !== 200) {
                reject(`Failed to get response from update server (code: ${res.statusCode}, message: ${res.statusMessage})`);
                return;
            }

            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', err => reject(err));
        });
    });
}

export async function fileGet(url: string, path: string): Promise<void> {

    // Ensure parent folder exists
    await promises.mkdir(dirname(path), { recursive: true });

    // Download
    return new Promise((resolve, reject) => {
        const request = https.get(url, res => {
            const totalSize = parseInt(res.headers['content-length']!, 10);

            const bar = new ProgressBar(`${chalk.gray('[fetch]')} [:bar] :percent of ${(totalSize / 1024 / 1024).toFixed(2)} MB (:rate MB/s)`, {
                complete: '=',
                incomplete: ' ',
                width: 30,
                total: totalSize / (1024 * 1024),
                clear: true
            });

            const outStream = createWriteStream(path);
            outStream.on('close', () => resolve());
            outStream.on('error', reject);

            res.on('data', chunk => {
                bar.tick(chunk.length / (1024 * 1024));
            });

            res.on('error', reject);
            res.pipe(outStream);
        });

        request.on('error', reject);
    });
}