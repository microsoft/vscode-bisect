/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @author bpasero

import chalk from 'chalk';
import { mkdirSync } from 'node:fs';
import simpleGit from 'simple-git';
import { GIT_FOLDER, GIT_REPO, GIT_VSCODE_FOLDER, LOGGER } from './constants.js';
import { exists } from './files.js';

class Git {

    static {
        mkdirSync(GIT_FOLDER, { recursive: true });
    }

    private _whenReady: Promise<void> | undefined = undefined;
    get whenReady(): Promise<void> {
        if (!this._whenReady) {
            this._whenReady = this.init();
        }

        return this._whenReady;
    }

    private async init(): Promise<void> {

        // Bring up to date otherwise
        if (await exists(GIT_VSCODE_FOLDER)) {
            LOGGER.log(`${chalk.gray('[git]')} pulling latest changes into ${chalk.green(GIT_FOLDER)}...`);

            const git = simpleGit.default({ baseDir: GIT_VSCODE_FOLDER });
            await git.checkout('main');
            await git.pull();
        }

        // Clone repo if it does not exist
        else {
            LOGGER.log(`${chalk.gray('[git]')} cloning VS Code into ${chalk.green(GIT_VSCODE_FOLDER)} (this is only done once and can take a while)...`);

            const git = simpleGit.default();
            await git.clone(GIT_REPO, GIT_VSCODE_FOLDER);
        }
    }
}

export const git = new Git();