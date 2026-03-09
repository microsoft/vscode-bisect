/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import prompts from 'prompts';
import chalk from 'chalk';
import { builds, IBuild, IBuildKind } from './builds.js';
import { LOGGER } from './constants.js';
import { bisecter } from './bisect.js';

export enum ExploreResponse {
    Next = 1,
    Previous,
    Jump,
    Quit
}

export function computeNextIndex(currentIndex: number, totalBuilds: number, response: ExploreResponse, jumpTarget?: number): number | undefined {
    switch (response) {
        case ExploreResponse.Next:
            return currentIndex + 1 < totalBuilds ? currentIndex + 1 : undefined;
        case ExploreResponse.Previous:
            return currentIndex - 1 >= 0 ? currentIndex - 1 : undefined;
        case ExploreResponse.Jump:
            return jumpTarget !== undefined &&
                jumpTarget >= 0 &&
                jumpTarget < totalBuilds ? jumpTarget : undefined;
        default:
            return undefined;
    }
}

class Explorer {

    async start({ runtime, quality, flavor }: IBuildKind, goodCommitOrVersion?: string, badCommitOrVersion?: string, releasedOnly?: boolean): Promise<void> {
        const buildKind: IBuildKind = { runtime, quality, flavor };

        const allBuilds = await builds.fetchBuilds(buildKind, goodCommitOrVersion, badCommitOrVersion, releasedOnly);

        if (allBuilds.length === 0) {
            LOGGER.log(`${chalk.gray('[explore]')} ${chalk.red('No builds found in the specified range.')}`);
            return;
        }

        LOGGER.log(`${chalk.gray('[explore]')} found ${chalk.green(allBuilds.length)} builds to explore`);

        let currentIndex = 0;

        while (currentIndex >= 0 && currentIndex < allBuilds.length) {
            const build = allBuilds[currentIndex];

            LOGGER.log(`${chalk.gray('[explore]')} build ${chalk.green(`${currentIndex + 1}`)} of ${chalk.green(`${allBuilds.length}`)} — commit ${chalk.green(build.commit)}`);

            await bisecter.tryBuild(build, { isBisecting: false, forceReDownload: false });

            const response = await this.promptNavigation(currentIndex, allBuilds.length);

            if (response.action === ExploreResponse.Quit) {
                break;
            }

            const nextIndex = computeNextIndex(currentIndex, allBuilds.length, response.action, response.jumpTarget);
            if (nextIndex === undefined) {
                LOGGER.log(`${chalk.gray('[explore]')} ${chalk.yellow('Cannot navigate there — already at the boundary.')}`);
                continue;
            }

            currentIndex = nextIndex;
        }
    }

    private async promptNavigation(currentIndex: number, totalBuilds: number): Promise<{ action: ExploreResponse; jumpTarget?: number }> {
        const choices: { title: string; value: string }[] = [];

        if (currentIndex + 1 < totalBuilds) {
            choices.push({ title: 'Next (older build)', value: 'next' });
        }
        if (currentIndex - 1 >= 0) {
            choices.push({ title: 'Previous (newer build)', value: 'previous' });
        }
        if (totalBuilds > 2) {
            choices.push({ title: 'Jump to build...', value: 'jump' });
        }
        choices.push({ title: 'Quit', value: 'quit' });

        console.log();
        const response = await prompts([
            {
                type: 'select',
                name: 'action',
                message: `Build ${chalk.green(`${currentIndex + 1}`)} of ${chalk.green(`${totalBuilds}`)} — navigate:`,
                choices
            }
        ]);

        if (response.action === 'jump') {
            const jumpResponse = await prompts([
                {
                    type: 'number',
                    name: 'target',
                    message: `Enter build number (1-${totalBuilds}):`,
                    validate: (value: number) => value >= 1 && value <= totalBuilds ? true : `Please enter a number between 1 and ${totalBuilds}`
                }
            ]);

            if (typeof jumpResponse.target !== 'number') {
                return { action: ExploreResponse.Quit };
            }

            return { action: ExploreResponse.Jump, jumpTarget: jumpResponse.target - 1 };
        }

        switch (response.action) {
            case 'next': return { action: ExploreResponse.Next };
            case 'previous': return { action: ExploreResponse.Previous };
            default: return { action: ExploreResponse.Quit };
        }
    }
}

export const explorer = new Explorer();
