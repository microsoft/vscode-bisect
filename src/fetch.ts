/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @author bpasero

import followRedirects from 'follow-redirects';
import { createWriteStream, promises } from 'node:fs';
import { dirname } from 'node:path';
import { OutgoingHttpHeaders } from 'node:http';
import chalk from 'chalk';
import ProgressBar from 'progress';
import EasyDl from 'easydl';
import { LOGGER } from './constants.js';

const https = followRedirects.https;

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

    try {
        const res = new EasyDl(url, path, { reportInterval: 250 });

        const metadata = await res.metadata();
        const totalSize = parseInt(metadata.headers?.['content-length']!, 10);

        const bar = new ProgressBar(`${chalk.gray('[fetch]')} [:bar] :percent of ${(totalSize / 1024 / 1024).toFixed(2)} MB (:rate MB/s)`, {
            complete: '▰',
            incomplete: '▱',
            width: 30,
            total: totalSize / (1024 * 1024),
            clear: true
        });

        let totalDownloaded = 0;
        res.on('progress', report => {
            const downloadIncrement = report.total.bytes! - totalDownloaded;
            totalDownloaded = report.total.bytes!;
            bar.tick(downloadIncrement / (1024 * 1024));
        });

        res.on('error', err => LOGGER.trace(`${chalk.gray('[fetch]')} download error: ${err}`));

        const result = await res.wait();
        if (!result) {
            throw new Error('Unknown error');
        }
    } catch (error) {
        throw new Error(`Failed to download file from update server: ${error}`);
    }
}