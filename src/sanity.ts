/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import chalk from "chalk";
import { IBuild } from "./builds.js";
import { Arch, arch, Flavor, LOGGER, logTroubleshoot, Platform, platform, Quality, Runtime, USER_DATA_FOLDER } from "./constants.js";
import prompts from "prompts";
import { cleanUserDataDir } from "./files.js";
import { launcher } from "./launcher.js";

class Sanity {

    async testAllFlavors(commit: string): Promise<void> {
        const quality = Quality.Stable;
        const runtime = Runtime.DesktopLocal;

        const buildKinds: (IBuild & { label: string })[] = [
            {
                commit, quality, runtime, flavor: Flavor.Default, label: (() => {
                    switch (platform) {
                        case Platform.MacOSArm:
                        case Platform.MacOSX64:
                            return `macOS (${arch})`;
                        case Platform.LinuxArm:
                        case Platform.LinuxX64:
                            return `Linux (${arch})`;
                        case Platform.WindowsArm:
                        case Platform.WindowsX64:
                            return `Windows (${arch})`;
                    }
                })()
            },
        ];
        switch (platform) {
            case Platform.MacOSArm:
            case Platform.MacOSX64:
                buildKinds.push({ commit, quality, runtime, flavor: Flavor.DarwinUniversal, label: 'macOS (universal)' });
                break;
            case Platform.LinuxArm:
            case Platform.LinuxX64:
                buildKinds.push({ commit, quality, runtime, flavor: Flavor.LinuxDeb, label: `Linux (Debian)` });
                buildKinds.push({ commit, quality, runtime, flavor: Flavor.LinuxRPM, label: `Linux (RPM)` });
                if (arch === Arch.X64) {
                    buildKinds.push({ commit, quality, runtime, flavor: Flavor.LinuxSnap, label: `Linux (Snap)` });
                }
                break;
            case Platform.WindowsArm:
            case Platform.WindowsX64:
                buildKinds.push({ commit, quality, runtime, flavor: Flavor.WindowsUserInstaller, label: `Windows User Installer (${arch})` });
                buildKinds.push({ commit, quality, runtime, flavor: Flavor.WindowsSystemInstaller, label: `Windows System Installer (${arch})` });
                break;
        }
        buildKinds.push({ commit, quality, runtime, flavor: Flavor.Cli, label: 'Server & CLI' });

        this.logWelcome();

        for (let i = 0; i < buildKinds.length; i++) {
            const build = buildKinds[i];

            const shouldContinue = await this.tryBuild(build, { forceReDownload: false, label: build.label, isLast: i === buildKinds.length - 1 });
            if (!shouldContinue) {
                return;
            }
        }
    }

    async tryBuild(build: IBuild, options: { forceReDownload: boolean, label: string, isLast: boolean }): Promise<boolean /* continue */> {
        try {
            const instance = await launcher.launch(build, options);
            if (!instance) {
                return true;
            }

            console.log();
            const response = await prompts([
                {
                    type: 'select',
                    name: 'status',
                    message: `Running ${chalk.green(options.label)}`,
                    choices: (() => {
                        const choices = [
                            { title: options.isLast ? 'Done' : 'Next', value: 'next' },
                            { title: 'Retry', value: 'retry' }
                        ];

                        if (build.runtime === Runtime.DesktopLocal && (build.flavor === Flavor.Default || build.flavor === Flavor.DarwinUniversal)) {
                            choices.push({ title: 'Retry (fresh user data dir)', value: 'retry-fresh' });
                        }

                        if (!options.isLast) {
                            choices.push({ title: 'Quit', value: 'quit' });
                        }

                        return choices;
                    })()
                }
            ]);
            console.log();

            await instance.stop();

            if (response.status === 'retry-fresh') {
                cleanUserDataDir();
            }

            if (response.status === 'retry' || response.status === 'retry-fresh') {
                return this.tryBuild(build, { ...options, forceReDownload: false });
            }

            return response.status === 'next';
        } catch (error) {
            LOGGER.log(`${chalk.red('\n[error]')} ${error}\n`);

            console.log();
            const response = await prompts([
                {
                    type: 'select',
                    name: 'status',
                    message: `Would you like to restart ${chalk.green(options.label)}?`,
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
            console.log();

            if (response.status === 'retry-fresh') {
                cleanUserDataDir();
            }

            if (response.status === 'retry' || response.status === 'retry-fresh') {
                return this.tryBuild(build, { ...options, forceReDownload: true });
            }

            logTroubleshoot();

            return true;
        }
    }

    private logWelcome(): void {
        console.clear();

        const banner = `
${chalk.green('╔══════════════════════════════════════════════════════════════╗')}
${chalk.green('║')}                                                              ${chalk.green('║')}
${chalk.green('║')}    ${chalk.bold('VS Code Build Sanity Checker')}                              ${chalk.green('║')}
${chalk.green('║')}                                                              ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('Sanity check flavors of VS Code Stable')}                    ${chalk.green('║')}
${chalk.green('║')}                                                              ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('How it works:')}                                             ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('• Run different program flavors step by step')}              ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('• Verify the program installs and runs as expected')}        ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('• Continue to the next step')}                               ${chalk.green('║')}
${chalk.green('║')}                                                              ${chalk.green('║')}
${chalk.green('║')}    ${chalk.gray('https://github.com/microsoft/vscode/wiki/Sanity-Check')}     ${chalk.green('║')}
${chalk.green('║')}                                                              ${chalk.green('║')}
${chalk.green('╚══════════════════════════════════════════════════════════════╝')}
`;

        console.log(banner);
    }
}

export const sanity = new Sanity();