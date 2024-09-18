/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import chalk from 'chalk';
import { program, Option } from 'commander';
import { rmSync, truncateSync } from 'fs';
import prompts from 'prompts';
import { bisecter } from './bisect';
import { git } from './git';
import { BUILD_FOLDER, CONFIG, LOGGER, logTroubleshoot, ROOT, Runtime } from './constants';
import { launcher } from './launcher';
import { builds } from './builds';
import { resolve } from 'path';
import { exists } from './files';

module.exports = async function (argv: string[]): Promise<void> {

    interface Opts {
        runtime?: 'web' | 'desktop' | 'vscode.dev';
        good?: string;
        bad?: string;
        commit?: string;
        version?: string;
        releasedOnly?: boolean;
        verbose?: boolean;
        reset?: boolean;
        perf?: boolean | string;
        token?: string;
    }

    program.addHelpText('beforeAll', `Version: ${require('../package.json').version}\n`);

    program
        .addOption(new Option('-r, --runtime <runtime>', 'whether to bisect with a local web, online vscode.dev or local desktop (default) version').choices(['desktop', 'web', 'vscode.dev']))
        .option('-g, --good <commit>', 'commit hash of a released insiders build that does not reproduce the issue')
        .option('-b, --bad <commit>', 'commit hash of a released insiders build that reproduces the issue')
        .option('-c, --commit <commit|latest>', 'commit hash of a specific insiders build to test or "latest" released build (supercedes -g and -b)')
        .option('--version <major.minor.patch>', 'version of a specific insiders build to test, for example 1.93.1 (supercedes -g, -b and -c)')
        .option('--releasedOnly', 'only bisect over released insiders builds to support older builds')
        .option('--reset', 'deletes the cache folder (use only for troubleshooting)')
        .option('-p, --perf [path]', 'runs a performance test and optionally writes the result to the provided path')
        .option('-t, --token <token>', `a GitHub token of scopes 'repo', 'workflow', 'user:email', 'read:user' to enable additional performance tests targetting web`)
        .option('-v, --verbose', 'logs verbose output to the console when errors occur');

    program.addHelpText('after', `
Note: if no commit is specified, vscode-bisect will automatically bisect the last 200 insider builds. Use '--releasedOnly' to only consider released builds and thus allow for older builds to be tested.

Builds are stored and cached on disk in ${BUILD_FOLDER}
    `);

    const opts: Opts = program.parse(argv).opts();

    if (opts.verbose) {
        LOGGER.verbose = true;
    }

    if (opts.reset) {
        try {
            console.log(`${chalk.gray('[build]')} deleting cache directory ${chalk.green(ROOT)}`);
            rmSync(ROOT, { recursive: true });
        } catch (error) { }
    }

    if (opts.perf) {
        if (typeof opts.perf === 'string') {
            CONFIG.performance = resolve(opts.perf);
            if (await exists(CONFIG.performance)) {
                truncateSync(CONFIG.performance);
            }
        } else {
            CONFIG.performance = true;
        }

        if (opts.token && opts.runtime === 'vscode.dev') {
            CONFIG.token = opts.token;
        }

        if (opts.runtime !== 'vscode.dev') {
            await git.whenReady;
        }
    }

    let badCommit = opts.bad;
    let goodCommit = opts.good;
    if (!opts.commit && !opts.version) {
        if (!badCommit) {
            const response = await prompts([
                {
                    type: 'text',
                    name: 'bad',
                    initial: '',
                    message: 'Commit of released insiders build that reproduces the issue (leave empty to pick the latest build)',
                }
            ]);

            if (typeof response.bad === 'undefined') {
                process.exit();
            } else if (response.bad) {
                badCommit = response.bad;
            }
        }

        if (!goodCommit) {
            const response = await prompts([
                {
                    type: 'text',
                    name: 'good',
                    initial: '',
                    message: 'Commit of released insiders build that does not reproduce the issue (leave empty to pick the oldest build)',
                }
            ]);

            if (typeof response.good === 'undefined') {
                process.exit();
            } else if (response.good) {
                goodCommit = response.good;
            }
        }
    }

    try {
        let runtime: Runtime;
        if (opts.runtime === 'web') {
            runtime = Runtime.WebLocal;
        } else if (opts.runtime === 'vscode.dev') {
            runtime = Runtime.WebRemote;
        } else {
            runtime = Runtime.DesktopLocal;
        }

        let commit: string | undefined;
        if (opts.version) {
            const build = await builds.fetchBuildByVersion(runtime, opts.version);
            commit = build.commit;
        } else if (opts.commit) {
            if (opts.commit === 'latest') {
                const allBuilds = await builds.fetchBuilds(runtime, undefined, undefined, opts.releasedOnly);
                commit = allBuilds[0].commit;
            } else {
                commit = opts.commit;
            }
        }

        // Commit provided: launch only that commit
        if (commit) {
            await launcher.launch({ commit, runtime });
        }

        // No commit provided: bisect commit ranges
        else {
            await bisecter.start(runtime, goodCommit, badCommit, opts.releasedOnly);
        }
    } catch (error) {
        console.log(`${chalk.red('\n[error]')} ${error}`);
        logTroubleshoot();
        process.exit(1);
    }
}