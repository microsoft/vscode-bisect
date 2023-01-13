/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import chalk from 'chalk';
import { program, Option } from 'commander';
import { rmSync } from 'fs';
import prompts from 'prompts';
import { bisecter } from './bisect';
import { git } from './git';
import { BUILD_FOLDER, CONFIG, LOGGER, ROOT, Runtime } from './constants';
import { launcher } from './launcher';
import { builds } from './builds';

module.exports = async function (argv: string[]): Promise<void> {

    interface Opts {
        runtime?: 'web' | 'desktop' | 'vscode.dev';
        good?: string;
        bad?: string;
        commit?: string;
        verbose?: boolean;
        reset?: boolean;
        perf?: boolean;
        verifyMainBranch: boolean;
    }

    program
        .addOption(new Option('-r, --runtime <runtime>', 'whether to bisect with a local web, online vscode.dev or local desktop (default) version').choices(['desktop', 'web', 'vscode.dev']))
        .option('-g, --good <commit>', 'commit hash of a released insiders build that does not reproduce the issue')
        .option('-b, --bad <commit>', 'commit hash of a released insiders build that reproduces the issue')
        .option('-c, --commit <commit|latest>', 'commit hash of a specific insiders build to test or "latest" (supercedes -g and -b)')
        .option('--verify-main-branch', 'ensure only commits from "main" branch are tested (very slow on first run!)')
        .option('-r, --reset', 'deletes the cache folder (use only for troubleshooting)')
        .option('-p, --perf', 'runs a performance test (implies desktop runtime)')
        .option('-v, --verbose', 'logs verbose output to the console when errors occur');

    program.addHelpText('after', `
Note: if no commit is specified, vscode-bisect will automatically bisect the last 200 released insider builds.

Builds are stored and cached on disk in ${BUILD_FOLDER}
    `);

    const opts: Opts = program.parse(argv).opts();

    if (opts.verbose) {
        LOGGER.verbose = true;
    }

    if (opts.perf) {
        opts.runtime = 'desktop';
        CONFIG.performance = true;

        await git.whenReady;
    }

    if (opts.verifyMainBranch) {
        CONFIG.enableGitBranchChecks = true;
    }

    if (opts.reset) {
        try {
            rmSync(ROOT, { recursive: true });
        } catch (error) { }
    }

    let badCommit = opts.bad;
    let goodCommit = opts.good;
    if (!opts.commit) {
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
        if (opts.commit) {
            if (opts.commit === 'latest') {
                const allBuilds = await builds.fetchBuilds(runtime);
                opts.commit = allBuilds[0].commit;
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
            await bisecter.start(runtime, goodCommit, badCommit);
        }
    } catch (error) {
        console.log(`${chalk.red('[error]')} ${error}`);
        console.log(`You can run ${chalk.green('vscode-bisect --verbose')} for more detailed output and ${chalk.green('vscode-bisect --reset')} for a fresh start without caches.`);
        process.exit(1);
    }
}