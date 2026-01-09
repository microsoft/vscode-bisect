/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *  Author: bpasero
 *--------------------------------------------------------------------------------------------*/

import chalk from "chalk";
import { IBuild } from "./builds.js";
import { Arch, arch, Flavor, LOGGER, logTroubleshoot, Platform, platform, Quality, Runtime, USER_DATA_FOLDER } from "./constants.js";
import prompts from "prompts";
import { cleanUserDataDir } from "./files.js";
import { launcher } from "./launcher.js";

class Sanity {

    async testAllFlavors(commit: string): Promise<void> {
        this.logWelcome();

        const quality = Quality.Stable;
        const runtime = Runtime.DesktopLocal;

        const useDocker = await this.promptUserForDocker();

        let buildKinds: (IBuild & { label: string })[] = [];
        if (useDocker) {
            buildKinds = [
                { commit, quality, runtime, flavor: Flavor.CliLinuxAmd64, label: 'Server & CLI (AMD64)' },
                { commit, quality, runtime, flavor: Flavor.CliLinuxArm64, label: 'Server & CLI (ARM64)' },
                { commit, quality, runtime, flavor: Flavor.CliLinuxArmv7, label: 'Server & CLI (ARMv7)' },
                { commit, quality, runtime, flavor: Flavor.CliAlpineAmd64, label: 'Server & CLI (Alpine AMD64)' },
                { commit, quality, runtime, flavor: Flavor.CliAlpineArm64, label: 'Server & CLI (Alpine ARM64)' },
            ]
        } else {
            buildKinds = [
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
                    const selectedLinuxFlavors = await this.promptUserForLinuxFlavors();
                    for (const flavor of selectedLinuxFlavors) {
                        let label: string;
                        switch (flavor) {
                            case Flavor.LinuxDeb:
                                label = 'Linux (Debian)';
                                break;
                            case Flavor.LinuxRPM:
                                label = 'Linux (RPM)';
                                break;
                            case Flavor.LinuxSnap:
                                label = 'Linux (Snap)';
                                break;
                            default:
                                continue; // Skip unknown flavors
                        }
                        buildKinds.push({ commit, quality, runtime, flavor, label });
                    }
                    break;
                case Platform.WindowsArm:
                case Platform.WindowsX64:
                    buildKinds.push({ commit, quality, runtime, flavor: Flavor.WindowsUserInstaller, label: `Windows User Installer (${arch})` });
                    buildKinds.push({ commit, quality, runtime, flavor: Flavor.WindowsSystemInstaller, label: `Windows System Installer (${arch})` });
                    break;
            }

            buildKinds.push({ commit, quality, runtime, flavor: Flavor.Cli, label: 'Server & CLI' });
        }

        for (let i = 0; i < buildKinds.length; i++) {
            const build = buildKinds[i];

            const shouldContinue = await this.tryBuild(build, { forceReDownload: false, label: build.label, isLast: i === buildKinds.length - 1 });
            if (!shouldContinue) {
                return;
            }
        }
    }

    private async promptUserForDocker() {
        const response = await prompts([
            {
                type: 'select',
                name: 'useDocker',
                message: 'Are you assigned to sanity test builds locally or the server/CLI via docker on all supported Linux architectures?',
                choices: [
                    { title: 'Run builds locally', value: false },
                    { title: 'Run server/CLI via Docker (must be running)', value: true }
                ]
            }
        ]);

        return response.useDocker;
    }

    private async promptUserForLinuxFlavors(): Promise<Flavor[]> {
        const response = await prompts([
            {
                type: 'select',
                name: 'choice',
                message: 'Which Linux package would you like to test?',
                choices: [
                    { title: 'Test Debian package', value: 'deb' },
                    { title: 'Test RPM package', value: 'rpm' }
                ]
            }
        ]);

        const selectedFlavors = [];
        
        // Add the user's choice
        if (response.choice === 'deb') {
            selectedFlavors.push(Flavor.LinuxDeb);
        } else {
            selectedFlavors.push(Flavor.LinuxRPM);
        }

        // Always add Snap on X64 architecture
        if (arch === Arch.X64) {
            selectedFlavors.push(Flavor.LinuxSnap);
        }

        return selectedFlavors;
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
                            choices.push({ title: 'Retry (fresh user data & extensions dir)', value: 'retry-fresh' });
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
                            choices.push({ title: 'Yes (fresh user data & extensions dir)', value: 'retry-fresh' });
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