/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { https } from 'follow-redirects';
import { createWriteStream, promises } from 'fs';
import { dirname } from 'path';
import { OutgoingHttpHeaders } from 'http';

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
            const outStream = createWriteStream(path);
            outStream.on('close', () => resolve());
            outStream.on('error', reject);

            res.on('error', reject);
            res.pipe(outStream);
        });

        request.on('error', reject);
    });
}