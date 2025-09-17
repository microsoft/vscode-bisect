/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import chalk from 'chalk';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

export const ROOT = join(tmpdir(), 'vscode-bisect');

export const BUILD_FOLDER = join(ROOT, '.builds');

export const DATA_FOLDER = join(ROOT, '.data');
export const USER_DATA_FOLDER = join(DATA_FOLDER, 'data');
export const EXTENSIONS_FOLDER = join(DATA_FOLDER, 'extensions');

export const GIT_FOLDER = join(ROOT, 'git');
export const GIT_VSCODE_FOLDER = join(GIT_FOLDER, 'vscode');
export const GIT_REPO = 'https://github.com/microsoft/vscode.git';

export const STORAGE_FILE = join(ROOT, 'storage.json');

export const DEFAULT_PERFORMANCE_FILE = join(ROOT, 'startup-perf.txt');
export const PERFORMANCE_RUNS = 10;
export const PERFORMANCE_RUN_TIMEOUT = 60000;

export const VSCODE_DEV_URL = function (commit: string, quality: Quality) {
    if (CONFIG.token) {
        return `https://${quality === Quality.Insider ? 'insiders.' : ''}vscode.dev/github/microsoft/vscode/blob/main/package.json?vscode-version=${commit}`; // with auth state, we can use `github` route
    }

    return `https://${quality === Quality.Insider ? 'insiders.' : ''}vscode.dev/?vscode-version=${commit}`;
}

export enum Arch {
    X64 = 'x64',
    Arm64 = 'arm64'
}

export const arch = (() => {
    if (process.arch === Arch.Arm64) {
        return Arch.Arm64;
    }

    return Arch.X64;
})();

export enum Platform {
    MacOSX64 = 1,
    MacOSArm,
    LinuxX64,
    LinuxArm,
    WindowsX64,
    WindowsArm
}

export const platform = (() => {
    if (process.platform === 'win32') {
        return arch === Arch.Arm64 ? Platform.WindowsArm : Platform.WindowsX64;
    }

    if (process.platform === 'darwin') {
        return arch === Arch.Arm64 ? Platform.MacOSArm : Platform.MacOSX64;
    }

    if (process.platform === 'linux') {
        return arch === Arch.Arm64 ? Platform.LinuxArm : Platform.LinuxX64;
    }

    throw new Error('Unsupported platform.');
})();

export enum Runtime {
    WebLocal = 'web-local',
    WebRemote = 'web-remote',
    DesktopLocal = 'desktop'
}

export function runtimeFromString(value: unknown): Runtime {
    switch (value) {
        case 'web':
            return Runtime.WebLocal;
        case 'vscode.dev':
            return Runtime.WebRemote;
        case 'desktop':
            return Runtime.DesktopLocal;
        default: {
            if (typeof value === 'string') {
                throw new Error(`Unknown runtime: ${value}`);
            }
            return Runtime.DesktopLocal;
        }
    }
}

export enum Quality {
    Insider = 'insider',
    Stable = 'stable',
    Exploration = 'exploration'
}

export function qualityFromString(value: unknown): Quality {
    switch (value) {
        case 'stable':
            return Quality.Stable;
        case 'insider':
            return Quality.Insider;
        case 'exploration':
            return Quality.Exploration;
        default: {
            if (typeof value === 'string') {
                throw new Error(`Unknown quality: ${value}`);
            }
            return Quality.Insider;
        }
    }
}

export enum Flavor {
    Default = 'default',
    DarwinUniversal = 'universal',
    WindowsUserInstaller = 'win32-user',
    WindowsSystemInstaller = 'win32-system',
    LinuxDeb = 'linux-deb',
    LinuxRPM = 'linux-rpm',
    LinuxSnap = 'linux-snap',
    Cli = 'cli',
    CliLinuxAmd64 = 'cli-linux-amd64',
    CliLinuxArm64 = 'cli-linux-arm64',
    CliLinuxArmv7 = 'cli-linux-armv7',
    CliAlpineAmd64 = 'cli-alpine-amd64',
    CliAlpineArm64 = 'cli-alpine-arm64'
}

export function flavorFromString(value: unknown): Flavor {
    switch (value) {
        case 'universal':
            return Flavor.DarwinUniversal;
        case 'win32-user':
            return Flavor.WindowsUserInstaller;
        case 'win32-system':
            return Flavor.WindowsSystemInstaller;
        case 'linux-deb':
            return Flavor.LinuxDeb;
        case 'linux-rpm':
            return Flavor.LinuxRPM;
        case 'linux-snap':
            return Flavor.LinuxSnap;
        case 'cli':
            return Flavor.Cli;
        case 'cli-linux-amd64':
            return Flavor.CliLinuxAmd64;
        case 'cli-linux-arm64':
            return Flavor.CliLinuxArm64;
        case 'cli-linux-armv7':
            return Flavor.CliLinuxArmv7;
        case 'cli-alpine-amd64':
            return Flavor.CliAlpineAmd64;
        case 'cli-alpine-arm64':
            return Flavor.CliAlpineArm64;
        default: {
            if (typeof value === 'string') {
                throw new Error(`Unknown flavor: ${value}`);
            }
            return Flavor.Default;
        }
    }
}

export function isDockerCliFlavor(flavor: Flavor): flavor is Flavor.CliLinuxAmd64 | Flavor.CliLinuxArm64 | Flavor.CliLinuxArmv7 | Flavor.CliAlpineAmd64 | Flavor.CliAlpineArm64 {
    return flavor === Flavor.CliLinuxAmd64 ||
        flavor === Flavor.CliLinuxArm64 ||
        flavor === Flavor.CliLinuxArmv7 ||
        flavor === Flavor.CliAlpineAmd64 ||
        flavor === Flavor.CliAlpineArm64;
}

export const LOGGER = {
    verbose: false,
    log: (message: string) => {
        if (!isTesting() || LOGGER.verbose) {
            console.log(message);
        }
    },
    trace: (message: string) => {
        if (LOGGER.verbose) {
            console.log(message);
        }
    }
}

export const CONFIG = {
    performance: false as boolean | string,
    token: undefined as string | undefined,
}

export function logTroubleshoot(): void {
    const packageJson = require('../package.json');

    console.log(`
${chalk.bold('Error Troubleshooting Guide:')}
- run ${chalk.green('vscode-bisect --verbose')} for more detailed output
- run ${chalk.green('vscode-bisect --reset')} to delete the cache folder
- run ${chalk.green('vscode-bisect --exclude <commit1> <commit2>')} to exclude problematic commits from bisecting
- run ${chalk.green(`npm install -g ${packageJson.name}`)} to update to the latest version (your version: ${chalk.green(packageJson.version)})
`);
}

let TESTING = false;
export function setTesting(value: boolean) {
    TESTING = value;
}

export function isTesting(): boolean {
    return TESTING;
}