/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import prompts from "prompts";
import chalk from "chalk";
import { IBuild } from "./builds.js";
import { Flavor, Platform, platform, Quality, Runtime } from "./constants.js";
import { bisecter, BisectResponse } from "./bisect.js";

class Sanity {

    async testAllFlavors(commit: string): Promise<void> {
        const quality = Quality.Stable;
        const runtime = Runtime.DesktopLocal;

        const buildKinds: (IBuild & { label: string })[] = [
            { commit, quality, runtime, flavor: Flavor.Default, label: 'Desktop' },
        ];
        switch (platform) {
            case Platform.MacOSArm:
            case Platform.MacOSX64:
                buildKinds.push({ commit, quality, runtime, flavor: Flavor.DarwinUniversal, label: 'Darwin Universal' });
                break;
            case Platform.LinuxArm:
            case Platform.LinuxX64:
                break;
            case Platform.WindowsArm:
            case Platform.WindowsX64:
                buildKinds.push({ commit, quality, runtime, flavor: Flavor.WindowsUserInstaller, label: 'Windows User Installer' });
                buildKinds.push({ commit, quality, runtime, flavor: Flavor.WindowsSystemInstaller, label: 'Windows System Installer' });
                break;
        }
        buildKinds.push({ commit, quality, runtime, flavor: Flavor.Cli, label: 'CLI & Server' });

        this.logWelcome();

        const result = await prompts([
            {
                type: 'confirm',
                name: 'status',
                message: `Are you ready to begin testing ${chalk.green(commit)}?`,
                initial: true
            }
        ]);

        if (!result.status) {
            return;
        }

        for (let i = 0; i < buildKinds.length; i++) {
            const build = buildKinds[i];

            const result = await bisecter.tryBuild(build, { isBisecting: true, forceReDownload: false });
            switch (result) {
                case BisectResponse.Bad:
                    console.log(`\n👉 Please report an issue at ${chalk.green('https://github.com/microsoft/vscode/issues')}\n`);
                    break;
                case BisectResponse.Quit:
                    return;
            }
        }
    }

    private logWelcome(): void {
        const banner = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║    VS Code Build Sanity Checker                              ║
║                                                              ║
║    Sanity check flavors of VS Code Stable                    ║
║                                                              ║
║    How it works:                                             ║
║    • Run different program flavors step by step              ║
║    • Verify the program installs and runs as expected        ║
║    • Continue to the next step                               ║
║                                                              ║
║    https://github.com/microsoft/vscode/wiki/Sanity-Check     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

        console.log(banner);
    }
}

export const sanity = new Sanity();