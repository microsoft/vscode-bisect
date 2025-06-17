/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import chalk from "chalk";
import { IBuild } from "./builds.js";
import { arch, Flavor, Platform, platform, Quality, Runtime } from "./constants.js";
import { bisecter, BisectResponse } from "./bisect.js";

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
                buildKinds.push({ commit, quality, runtime, flavor: Flavor.LinuxSnap, label: `Linux (Snap)` });
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

            const result = await bisecter.tryBuild(build, { isBisecting: true, forceReDownload: false, label: build.label });
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
        console.clear();

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