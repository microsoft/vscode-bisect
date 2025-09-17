/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import chalk from 'chalk';
import { spawnSync } from 'node:child_process';
import { mkdirSync, promises, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { BUILD_FOLDER, Flavor, LOGGER, Platform, platform, Quality, USER_DATA_FOLDER } from './constants.js';

export async function exists(path: string): Promise<boolean> {
    try {
        await promises.stat(path);

        return true;
    } catch (error) {
        return false;
    }
}

export function getBuildPath(commit: string, quality: Quality, flavor: Flavor): string {
    let uniqueFolderName: string;
    if (platform === Platform.WindowsX64 || platform === Platform.WindowsArm) {
        uniqueFolderName = commit.substring(0, 6); // keep the folder path small for windows max path length restrictions
    } else {
        uniqueFolderName = commit;
    }

    const prefixes: string[] = [];
    if (quality === Quality.Stable) {
        prefixes.push('stable');
    } else if (quality === Quality.Exploration) {
        prefixes.push('exploration');
    }

    if (flavor !== Flavor.Default) {
        prefixes.push(flavor);
    }

    if (prefixes.length > 0) {
        uniqueFolderName = `${prefixes.join('-')}-${uniqueFolderName}`;
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

export function cleanUserDataDir(): void {
    try {
        LOGGER.log(`${chalk.gray('[build]')} cleaning user data directory...`);
        rmSync(USER_DATA_FOLDER, { recursive: true });
    } catch (error) {
        // Ignore errors if directory doesn't exist
    }
}