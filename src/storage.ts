/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @author bpasero

import { promises } from 'node:fs';
import { STORAGE_FILE } from './constants.js';

class Storage {

    private readonly whenReady = this.init();

    private async init(): Promise<{ [key: string]: object }> {
        try {
            return JSON.parse((await promises.readFile(STORAGE_FILE)).toString());
        } catch (error) {
            return {};
        }
    }

    async store<T extends object>(key: string, value: T): Promise<void> {
        const storage = await this.whenReady;

        // Add to in-memory
        storage[key] = value;

        // Persist on disk
        await promises.writeFile(STORAGE_FILE, JSON.stringify(storage));
    }

    async getValue<T extends object>(key: string): Promise<T | undefined> {
        const storage = await this.whenReady;

        return storage[key] as T | undefined;
    }
}

export const storage = new Storage();