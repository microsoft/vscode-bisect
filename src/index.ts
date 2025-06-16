/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import chalk from 'chalk';
import { program, Option } from 'commander';
import { rmSync, truncateSync } from 'node:fs';
import prompts from 'prompts';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { bisecter } from './bisect.js';
import { git } from './git.js';
import { BUILD_FOLDER, CONFIG, Flavor, flavorFromString, LOGGER, logTroubleshoot, Quality, qualityFromString, ROOT, Runtime, runtimeFromString } from './constants.js';
import { builds, IBuildKind } from './builds.js';
import { exists } from './files.js';

const require = createRequire(import.meta.url);

export default async function main(argv: string[]): Promise<void> {

    interface Opts {
        runtime?: 'web' | 'desktop' | 'vscode.dev';
        commit?: string;
        version?: string;
        quality?: 'insider' | 'stable';
        flavor?: string;
        good?: string;
        bad?: string;
        releasedOnly?: boolean;
        verbose?: boolean;
        reset?: boolean;
        perf?: boolean | string;
        token?: string;
    }

    program.addHelpText('beforeAll', `Version: ${chalk.green(require('../package.json').version)}\n`);

    program
        .addOption(new Option('-r, --runtime <runtime>', 'whether to bisect with a local web, online vscode.dev or local desktop (default) version').choices(['desktop', 'web', 'vscode.dev']))
        .option('-c, --commit <commit|latest>', 'commit hash of a published build to test or "latest" released build (supercedes -g and -b)')
        .option('-v, --version <major.minor>', 'version of a published build to test, for example 1.93 (supercedes -g, -b and -c)')
        .option('-q, --quality <insider|stable>', 'quality of a published build to test, defaults to "insider"')
        .option('-f, --flavor <universal|cli>', 'flavor of a published build to test (only applies when testing desktop builds)')
        .option('-g, --good <commit|version>', 'commit hash or version of a published build that does not reproduce the issue')
        .option('-b, --bad <commit|version>', 'commit hash or version of a published build that reproduces the issue')
        .option('--releasedOnly', 'only bisect over released builds to support older builds')
        .option('--reset', 'deletes the cache folder (use only for troubleshooting)')
        .addOption(new Option('-p, --perf [path]', 'runs a performance test and optionally writes the result to the provided path').hideHelp())
        .addOption(new Option('-t, --token <token>', `a GitHub token of scopes 'repo', 'workflow', 'user:email', 'read:user' to enable additional performance tests targetting web`).hideHelp())
        .option('--verbose', 'logs verbose output to the console when errors occur');

    program.addHelpText('after', `
${chalk.bold('Note:')} if no commit is specified, the last 200 builds will be bisected. Use ${chalk.green('\'--releasedOnly\'')} to only consider released builds for testing older builds.

${chalk.bold('Storage:')} ${chalk.green(BUILD_FOLDER)}
    `);

    const opts: Opts = program.parse(argv).opts();

    if (opts.verbose) {
        LOGGER.verbose = true;
    }

    if (opts.reset) {
        try {
            LOGGER.log(`${chalk.gray('[build]')} deleting cache directory ${chalk.green(ROOT)}`);
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
        const runtime = runtimeFromString(opts.runtime);
        const quality = qualityFromString(opts.quality);
        const flavor = flavorFromString(opts.flavor);
        if (flavor !== Flavor.Default && runtime !== Runtime.DesktopLocal) {
            throw new Error(`Flavor ${chalk.green(flavor)} is only supported for desktop builds.`);
        }

        const buildKind: IBuildKind = { runtime, quality, flavor };

        let commit: string | undefined;
        if (opts.version) {
            if (!/^\d+\.\d+$/.test(opts.version)) {
                throw new Error(`Invalid version format. Please provide a version in the format of ${chalk.green('major.minor')}, for example ${chalk.green('1.93')}.`);
            }

            const build = await builds.fetchBuildByVersion(buildKind, opts.version);
            commit = build.commit;
        } else if (opts.commit) {
            if (opts.commit === 'latest') {
                const allBuilds = await builds.fetchBuilds(buildKind, undefined, undefined, opts.releasedOnly);
                commit = allBuilds[0].commit;
            } else {
                commit = opts.commit;
            }
        }

        // Commit provided: launch only that commit
        if (commit) {
            await bisecter.tryBuild({ commit, runtime, quality, flavor }, { isBisecting: false, forceReDownload: false });
        }

        // No commit provided: bisect commit ranges
        else {
            await bisecter.start(buildKind, goodCommitOrVersion, badCommitOrVersion, opts.releasedOnly);
        }
    } catch (error) {
        LOGGER.log(`${chalk.red('\n[error]')} ${error}`);
        logTroubleshoot();
        process.exit(1);
    }
}