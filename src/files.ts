/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawnSync } from 'child_process';
import { mkdirSync, promises, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { BUILD_FOLDER, Platform, platform } from './constants';
import { unzipSync } from 'fflate';

export async function exists(path: string): Promise<boolean> {
    try {
        await promises.stat(path);

        return true;
    } catch (error) {
        return false;
    }
}

export function getBuildPath(commit: string, quality: string): string {
    let uniqueFolderName = quality === 'insider' ? commit : `s-${commit}`; // for stable builds, prefix with s-

    if (platform === Platform.WindowsX64 || platform === Platform.WindowsArm) {
        return join(BUILD_FOLDER, uniqueFolderName.substring(0, 6)); // keep the folder path small for windows max path length restrictions
    }

    return join(BUILD_FOLDER, uniqueFolderName);
}

export async function unzip(source: string, destination: string): Promise<void> {

    // *.zip: macOS, Windows
    if (source.endsWith('.zip')) {

        // Windows
        if (platform === Platform.WindowsX64 || platform === Platform.WindowsArm) {
            const unzipped = unzipSync(readFileSync(source));
            for (const entry of Object.keys(unzipped)) {
                if (entry.endsWith('/')) {
                    mkdirSync(join(destination, entry), { recursive: true });
                } else {
                    writeFileSync(join(destination, entry), unzipped[entry]);
                }
            }
        }

        // macOS
        else {
            spawnSync('unzip', [source, '-d', destination]);
        }
    }

    // *.tar.gz: Linux
    else {
        if (!await exists(destination)) {
            await promises.mkdir(destination); // tar does not create extractDir by default
        }

        spawnSync('tar', ['-xzf', source, '-C', destination]);
    }
}

export async function computeSHA256(path: string): Promise<string> {
    const fileBuffer = await promises.readFile(path);

    return createHash('sha256').update(fileBuffer).digest('hex');
}
