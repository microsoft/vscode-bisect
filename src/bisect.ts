/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import prompts from 'prompts';
import chalk from 'chalk';
import open from 'open';
import { rmSync } from 'node:fs';
import { builds, IBuild, IBuildKind } from './builds.js';
import { logTroubleshoot, USER_DATA_FOLDER, LOGGER, Runtime, Flavor } from './constants.js';
import { launcher } from './launcher.js';
import { cleanUserDataDir } from './files.js';

export enum BisectResponse {
    Good = 1,
    Bad,
    Quit
}

interface IBisectState {
    currentChunk: number;
    currentIndex: number;
}

class Bisecter {

    async start({ runtime, quality, flavor }: IBuildKind, goodCommitOrVersion?: string, badCommitOrVersion?: string, releasedOnly?: boolean): Promise<void> {

        // Resolve commits from input
        const { goodCommit, badCommit } = await this.resolveCommits({ runtime, quality, flavor }, goodCommitOrVersion, badCommitOrVersion);

        // Get builds to bisect
        const buildsRange = await builds.fetchBuilds({ runtime, quality, flavor }, goodCommit, badCommit, releasedOnly);

        LOGGER.log(`${chalk.gray('[build]')} total ${chalk.green(buildsRange.length)} builds with roughly ${chalk.green(Math.round(Math.log2(buildsRange.length)))} steps`);

        let goodBuild: IBuild | undefined = undefined;
        let badBuild: IBuild | undefined = undefined;
        let build: IBuild;
        let quit = false;

        if (buildsRange.length < 2) {
            return this.finishBisect(badBuild, goodBuild);
        }

        // Start bisecting via binary search

        const state = { currentChunk: buildsRange.length, currentIndex: 0 };
        this.nextState(state, BisectResponse.Bad /* try older */);

        // Go over next builds for as long as we are not done...
        while (build = buildsRange[state.currentIndex]) {
            const response = await this.tryBuild(build, { isBisecting: true, forceReDownload: false });
            if (response === BisectResponse.Bad) {
                badBuild = build;
            } else if (response === BisectResponse.Good) {
                goodBuild = build;
            } else {
                quit = true;
                break;
            }

            const finished = this.nextState(state, response);
            if (finished) {
                break;
            }
        }

        if (!quit) {
            return this.finishBisect(badBuild, goodBuild);
        }
    }

    logWelcome(): void {
        console.clear();

        const banner = `
${chalk.green('╔══════════════════════════════════════════════════════════════╗')}
${chalk.green('║')}                                                              ${chalk.green('║')}
${chalk.green('║')}    ${chalk.bold('VS Code Build Bisecter')}                                    ${chalk.green('║')}
${chalk.green('║')}                                                              ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('How it works:')}                                             ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('• Run different program versions step by step')}             ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('• Verify the bug reproduces ("bad") or not ("good")')}       ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('• Find the commit range causing the issue')}                 ${chalk.green('║')}
${chalk.green('║')}                                                              ${chalk.green('║')}
${chalk.green('╚══════════════════════════════════════════════════════════════╝')}
`;

        console.log(banner);
    }

    private async resolveCommits({ runtime, quality, flavor }: IBuildKind, goodCommitOrVersion?: string, badCommitOrVersion?: string) {
        return {
            goodCommit: await this.resolveCommit({ runtime, quality, flavor }, goodCommitOrVersion),
            badCommit: await this.resolveCommit({ runtime, quality, flavor }, badCommitOrVersion)
        };
    }

    private async resolveCommit({ runtime, quality, flavor }: IBuildKind, commitOrVersion?: string) {
        if (!commitOrVersion) {
            return undefined;
        }

        if (/^\d+\.\d+$/.test(commitOrVersion)) {
            const commit = (await builds.fetchBuildByVersion({ runtime, quality, flavor }, commitOrVersion)).commit;
            LOGGER.log(`${chalk.gray('[build]')} latest build with version ${chalk.green(commitOrVersion)} is ${chalk.green(commit)}.`);
            return commit;
        }

        if (/^[0-9a-f]{40}$/i.test(commitOrVersion)) {
            return commitOrVersion;
        }

        throw new Error(`Invalid commit or version format. Please provide a valid Git commit hash or version in the format of ${chalk.green('major.minor')}.`);
    }

    private async finishBisect(badBuild: IBuild | undefined, goodBuild: IBuild | undefined): Promise<void> {
        if (goodBuild && badBuild) {
            LOGGER.log(`${chalk.gray('[build]')} ${chalk.green(badBuild.commit)} is the first bad commit after ${chalk.green(goodBuild.commit)}.`);

            console.log();
            const response = await prompts([
                {
                    type: 'confirm',
                    name: 'open',
                    initial: true,
                    message: 'Would you like to open GitHub for the list of changes?'
                }
            ]);

            if (response.open) {
                open(`https://github.com/microsoft/vscode/compare/${goodBuild.commit}...${badBuild.commit}`);
            }

            LOGGER.log(`
Run the following commands to continue bisecting via git in a folder where VS Code is checked out to:

${chalk.green(`git bisect start && git bisect bad ${badBuild.commit} && git bisect good ${goodBuild.commit}`)}

`);
        } else if (badBuild) {
            LOGGER.log(`${chalk.gray('[build]')} ${chalk.red('All builds are bad!')} Try running with ${chalk.green('--releasedOnly')} to support older builds.`);
        } else if (goodBuild) {
            LOGGER.log(`${chalk.gray('[build]')} ${chalk.green('All builds are good!')} Try running with ${chalk.green('--releasedOnly')} to support older builds.`);
        } else {
            LOGGER.log(`${chalk.gray('[build]')} ${chalk.red('No builds bisected. Bisect needs at least 2 builds from "main" branch to work.')}`);
        }
    }

    private nextState(state: IBisectState, response: BisectResponse): boolean {

        // Binary search is done
        if (state.currentChunk === 1) {
            return true;
        }

        // Binary search is not done
        else {
            state.currentChunk = Math.round(state.currentChunk / 2);
            state.currentIndex = response === BisectResponse.Good ? state.currentIndex - state.currentChunk /* try newer */ : state.currentIndex + state.currentChunk /* try older */;

            return false;
        }
    }

    async tryBuild(build: IBuild, options: { forceReDownload: boolean, isBisecting: boolean }): Promise<BisectResponse> {
        try {
            const instance = await launcher.launch(build, options);
            if (!instance) {
                return BisectResponse.Good;
            }

            console.log();
            const response = options.isBisecting ? await prompts([
                {
                    type: 'select',
                    name: 'status',
                    message: `Is ${chalk.green(build.commit)} good or bad?`,
                    choices: (() => {
                        const choices = [
                            { title: 'Good', value: 'good' },
                            { title: 'Bad', value: 'bad' },
                            { title: 'Retry', value: 'retry' }
                        ];

                        if (build.runtime === Runtime.DesktopLocal && (build.flavor === Flavor.Default || build.flavor === Flavor.DarwinUniversal)) {
                            choices.push({ title: 'Retry (fresh user data dir)', value: 'retry-fresh' });
                        }

                        choices.push({ title: 'Quit', value: 'quit' });

                        return choices;
                    })()
                }
            ]) : await this.promptToRestart(build);
            console.log();

            await instance.stop();

            if (response.status === 'retry-fresh') {
                cleanUserDataDir();
            }

            if (response.status === 'retry' || response.status === 'retry-fresh') {
                return this.tryBuild(build, { ...options, forceReDownload: false });
            }

            return response.status === 'good' ? BisectResponse.Good : response.status === 'bad' ? BisectResponse.Bad : BisectResponse.Quit;
        } catch (error) {
            LOGGER.log(`${chalk.red('\n[error]')} ${error}\n`);

            console.log();
            const response = await this.promptToRestart(build);
            console.log();

            if (response.status === 'retry-fresh') {
                cleanUserDataDir();
            }

            if (response.status === 'retry' || response.status === 'retry-fresh') {
                return this.tryBuild(build, { ...options, forceReDownload: true });
            }

            logTroubleshoot();

            return BisectResponse.Quit;
        }
    }

    private async promptToRestart(build: IBuild) {
        return await prompts([
            {
                type: 'select',
                name: 'status',
                message: `Would you like to restart ${chalk.green(build.commit)}?`,
                choices: (() => {
                    const choices = [
                        { title: 'Yes', value: 'retry' }
                    ];

                    if (build.runtime === Runtime.DesktopLocal && (build.flavor === Flavor.Default || build.flavor === Flavor.DarwinUniversal)) {
                        choices.push({ title: 'Yes (fresh user data dir)', value: 'retry-fresh' });
                    }

                    choices.push({ title: 'No', value: 'no' });

                    return choices;
                })()
            }
        ]);
    }
}

export const bisecter = new Bisecter();