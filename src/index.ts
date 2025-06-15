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
        quality?: 'insider' | 'stable';
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
        .option('-c, --commit <commit|latest>', 'commit hash of a published build to test or "latest" released build (supercedes -g and -b)')
        .option('-v, --version <major.minor>', 'version of a published build to test, for example 1.93 (supercedes -g, -b and -c)')
        .option('-q, --quality <insider|stable>', 'quality of a published build to test, defaults to "insider"')
        .option('-g, --good <commit|version>', 'commit hash or version of a published build that does not reproduce the issue')
        .option('-b, --bad <commit|version>', 'commit hash or version of a published build that reproduces the issue')
        .option('--releasedOnly', 'only bisect over released builds to support older builds')
        .option('--reset', 'deletes the cache folder (use only for troubleshooting)')
        .addOption(new Option('-p, --perf [path]', 'runs a performance test and optionally writes the result to the provided path').hideHelp())
        .addOption(new Option('-t, --token <token>', `a GitHub token of scopes 'repo', 'workflow', 'user:email', 'read:user' to enable additional performance tests targetting web`).hideHelp())
        .option('--verbose', 'logs verbose output to the console when errors occur');

    program.addHelpText('after', `
Note: if no commit is specified, vscode-bisect will automatically bisect the last 200 builds. Use '--releasedOnly' to only consider released builds and thus allow for older builds to be tested.

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

    let badCommitOrVersion = opts.bad;
    let goodCommitOrVersion = opts.good;
    if (!opts.commit && !opts.version) {
        if (!badCommitOrVersion) {
            const response = await prompts([
                {
                    type: 'text',
                    name: 'bad',
                    initial: '',
                    message: 'Commit or version of released build that reproduces the issue (leave empty to pick the latest build)',
                }
            ]);

            if (typeof response.bad === 'undefined') {
                process.exit();
            } else if (response.bad) {
                badCommitOrVersion = response.bad;
            }
        }

        if (!goodCommitOrVersion) {
            const response = await prompts([
                {
                    type: 'text',
                    name: 'good',
                    initial: '',
                    message: 'Commit or version of released build that does not reproduce the issue (leave empty to pick the oldest build)',
                }
            ]);

            if (typeof response.good === 'undefined') {
                process.exit();
            } else if (response.good) {
                goodCommitOrVersion = response.good;
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

        let quality: 'insider' | 'stable' = 'insider';
        if (opts.quality) {
            quality = opts.quality;
        }

        let commit: string | undefined;
        if (opts.version) {
            if (!/^\d+\.\d+$/.test(opts.version)) {
                throw new Error(`Invalid version format. Please provide a version in the format of ${chalk.green('major.minor')}, for example ${chalk.green('1.93')}.`);
            }

            const build = await builds.fetchBuildByVersion(runtime, quality, opts.version);
            commit = build.commit;
        } else if (opts.commit) {
            if (opts.commit === 'latest') {
                const allBuilds = await builds.fetchBuilds(runtime, quality, undefined, undefined, opts.releasedOnly);
                commit = allBuilds[0].commit;
            } else {
                commit = opts.commit;
            }
        }

        // Commit provided: launch only that commit
        if (commit) {
            await bisecter.tryBuild({ commit, runtime, quality }, { isBisecting: false, forceReDownload: false });
        }

        // No commit provided: bisect commit ranges
        else {
            await bisecter.start(runtime, quality, goodCommitOrVersion, badCommitOrVersion, opts.releasedOnly);
        }
    } catch (error) {
        console.log(`${chalk.red('\n[error]')} ${error}`);
        logTroubleshoot();
        process.exit(1);
    }
}