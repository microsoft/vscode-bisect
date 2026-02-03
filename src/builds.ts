/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import chalk from 'chalk';
import { dirname, join } from 'node:path';
import { rmSync } from 'node:fs';
import { Arch, arch, Flavor, isDockerCliFlavor, LOGGER, Platform, platform, Quality, Runtime } from './constants.js';
import { fileGet, jsonGet } from './fetch.js';
import { computeSHA256, exists, getBuildPath, unzip } from './files.js';

export interface IBuildKind {
    readonly runtime: Runtime;
    readonly quality: Quality;
    readonly flavor: Flavor;
}

export interface IBuild extends IBuildKind {
    readonly commit: string;
}

interface IBuildMetadata {
    readonly url: string;
    readonly version: string;
    readonly productVersion: string;
    readonly sha256hash: string;
}

class Builds {

    async fetchBuildByVersion({ runtime, quality, flavor }: IBuildKind, version: string): Promise<IBuild> {
        let meta;
        if (quality === 'insider') {
            meta = await jsonGet<IBuildMetadata>(`https://update.code.visualstudio.com/api/versions/${version}.0-insider/${this.getBuildApiName({ runtime, quality, flavor })}/insider?released=true`);
        } else if (quality === 'exploration') {
            meta = await jsonGet<IBuildMetadata>(`https://update.code.visualstudio.com/api/versions/${version}.0-exploration/${this.getBuildApiName({ runtime, quality, flavor })}/exploration?released=true`);
        } else {
            meta = await jsonGet<IBuildMetadata>(`https://update.code.visualstudio.com/api/versions/${version}.0/${this.getBuildApiName({ runtime, quality, flavor })}/stable?released=true`);
        }

        return { runtime, commit: meta.version, quality, flavor };
    }

    async fetchBuilds({ runtime, quality, flavor }: IBuildKind, goodCommit?: string, badCommit?: string, releasedOnly?: boolean, excludeCommits?: string[]): Promise<IBuild[]> {

        // Fetch all released builds
        const allBuilds = await this.fetchAllBuilds({ runtime, quality, flavor }, releasedOnly);

        let goodCommitIndex = allBuilds.length - 1;  // last build (oldest) by default
        let badCommitIndex = 0;                      // first build (newest) by default

        if (typeof goodCommit === 'string') {
            const candidateGoodCommitIndex = this.indexOf(goodCommit, allBuilds);
            if (typeof candidateGoodCommitIndex !== 'number') {
                if (releasedOnly) {
                    throw new Error(`Provided good commit ${chalk.green(goodCommit)} was not found in the list of builds. It is either invalid or too old.`);
                } else {
                    return this.fetchBuilds({ runtime, quality, flavor }, goodCommit, badCommit, true, excludeCommits);
                }
            }

            goodCommitIndex = candidateGoodCommitIndex;
        }

        if (typeof badCommit === 'string') {
            const candidateBadCommitIndex = this.indexOf(badCommit, allBuilds);
            if (typeof candidateBadCommitIndex !== 'number') {
                if (releasedOnly) {
                    throw new Error(`Provided bad commit ${chalk.green(badCommit)} was not found in the list of builds. It is either invalid or too old.`);
                } else {
                    return this.fetchBuilds({ runtime, quality, flavor }, goodCommit, badCommit, true, excludeCommits);
                }
            }

            badCommitIndex = candidateBadCommitIndex;
        }

        if (badCommitIndex >= goodCommitIndex) {
            throw new Error(`Provided bad commit ${chalk.green(badCommit)} cannot be older or same as good commit ${chalk.green(goodCommit)}.`);
        }

        // Build a range based on the bad and good commits if any
        let buildsInRange = allBuilds.slice(badCommitIndex, goodCommitIndex + 1);

        // Filter out excluded commits if any
        if (excludeCommits && excludeCommits.length > 0) {
            const excludeSet = new Set(excludeCommits);
            const originalLength = buildsInRange.length;
            buildsInRange = buildsInRange.filter(build => !excludeSet.has(build.commit));

            if (buildsInRange.length !== originalLength) {
                const excludedCount = originalLength - buildsInRange.length;
                LOGGER.log(`${chalk.gray('[build]')} excluded ${chalk.green(excludedCount)} commit${excludedCount === 1 ? '' : 's'} from bisecting`);
            }
        }

        // Drop those builds that are not on main branch
        return buildsInRange;
    }

    private indexOf(commit: string, builds: IBuild[]): number | undefined {
        for (let i = 0; i < builds.length; i++) {
            const build = builds[i];
            if (build.commit === commit) {
                return i;
            }
        }

        return undefined;
    }

    private async fetchAllBuilds({ runtime, quality, flavor }: IBuildKind, releasedOnly = false): Promise<IBuild[]> {
        const url = `https://update.code.visualstudio.com/api/commits/${quality}/${this.getBuildApiName({ runtime, quality, flavor })}?released=${releasedOnly}`;
        LOGGER.log(`${chalk.gray('[build]')} fetching all builds from ${chalk.green(url)}...`);
        const commits = await jsonGet<Array<string>>(url);

        return commits.map(commit => ({ commit, runtime, quality, flavor }));
    }

    private getBuildApiName({ runtime, flavor }: IBuildKind): string {

        // Server
        if (runtime === Runtime.WebLocal || runtime === Runtime.WebRemote) {
            switch (platform) {
                case Platform.MacOSX64:
                case Platform.MacOSArm:
                    return 'server-darwin-web';
                case Platform.LinuxX64:
                case Platform.LinuxArm:
                    return `server-linux-${arch}-web`;
                case Platform.WindowsX64:
                case Platform.WindowsArm:
                    return `server-win32-${arch}-web`;
            }
        }

        // Desktop / CLI
        switch (platform) {
            case Platform.MacOSX64:
                return flavor === Flavor.DarwinUniversal ? 'darwin-universal' : 'darwin';
            case Platform.MacOSArm:
                return flavor === Flavor.DarwinUniversal ? 'darwin-universal' : `darwin-${Arch.Arm64}`;
            case Platform.LinuxX64:
            case Platform.LinuxArm:
                return `linux-${arch}`;
            case Platform.WindowsX64:
            case Platform.WindowsArm:
                return `win32-${arch}`;
        }
    }

    async downloadAndExtractBuild({ runtime, commit, quality, flavor }: IBuild, options?: { forceReDownload: boolean }): Promise<string | undefined> {
        if (isDockerCliFlavor(flavor)) {
            return undefined; // CLIs running in docker are handled differently
        }

        const buildName = await this.getBuildDownloadName({ runtime, commit, quality, flavor });

        const path = join(getBuildPath(commit, quality, flavor), buildName);

        const pathExists = await exists(path);
        if (pathExists && !options?.forceReDownload) {
            LOGGER.trace(`${chalk.gray('[build]')} using ${chalk.green(path)} for the next build to try`);

            return path; // assume the build is cached
        }

        if (pathExists && options?.forceReDownload) {
            LOGGER.log(`${chalk.gray('[build]')} deleting ${chalk.green(getBuildPath(commit, quality, flavor))} and retrying download`);
            rmSync(getBuildPath(commit, quality, flavor), { recursive: true });
        }

        // Download
        const { url, sha256hash: expectedSHA256 } = await this.fetchBuildMeta({ runtime, commit, quality, flavor });
        LOGGER.log(`${chalk.gray('[build]')} downloading build from ${chalk.green(url)}...`);
        await fileGet(url, path);

        // Validate SHA256 Checksum
        const computedSHA256 = await computeSHA256(path);
        if (expectedSHA256 !== computedSHA256) {
            throw new Error(`${chalk.gray('[build]')} ${chalk.red('✘')} expected SHA256 checksum (${expectedSHA256}) does not match with download (${computedSHA256})`);
        } else {
            LOGGER.log(`${chalk.gray('[build]')} ${chalk.green('✔︎')} expected SHA256 checksum matches with download`);
        }

        // Unzip (unless its an installer)
        if (flavor === Flavor.Default || flavor === Flavor.Cli || flavor === Flavor.DarwinUniversal) {
            let destination: string;
            if ((runtime === Runtime.DesktopLocal || runtime === Runtime.WebLocal) && flavor === Flavor.Default && (platform === Platform.WindowsX64 || platform === Platform.WindowsArm)) {
                // zip does not contain a single top level folder to use...
                destination = path.substring(0, path.lastIndexOf('.zip'));
            } else {
                // zip contains a single top level folder to use
                destination = dirname(path);
            }
            LOGGER.log(`${chalk.gray('[build]')} unzipping ${chalk.green(path)} to ${chalk.green(destination)}...`);
            await unzip(path, destination);

            return destination;
        }

        return path;
    }

    private async getBuildDownloadName({ runtime, commit, quality, flavor }: IBuild): Promise<string> {

        // Server
        if (runtime === Runtime.WebLocal || runtime === Runtime.WebRemote) {
            switch (platform) {
                case Platform.MacOSX64:
                case Platform.MacOSArm:
                    return `vscode-server-darwin-${arch}-web.zip`;
                case Platform.LinuxX64:
                case Platform.LinuxArm:
                    return `vscode-server-linux-${arch}-web.tar.gz`;
                case Platform.WindowsX64:
                case Platform.WindowsArm:
                    return `vscode-server-win32-${arch}-web.zip`;
            }
        }

        // Desktop
        if (flavor !== Flavor.Cli) {
            switch (platform) {
                case Platform.MacOSX64:
                    return flavor === Flavor.DarwinUniversal ? 'VSCode-darwin-universal.zip' : 'VSCode-darwin.zip';
                case Platform.MacOSArm:
                    return flavor === Flavor.DarwinUniversal ? 'VSCode-darwin-universal.zip' : `VSCode-darwin-${Arch.Arm64}.zip`;
                case Platform.LinuxX64:
                case Platform.LinuxArm:
                    return (await this.fetchBuildMeta({ runtime, commit, quality, flavor })).url.split('/').pop()!; // e.g. https://az764295.vo.msecnd.net/insider/807bf598bea406dcb272a9fced54697986e87768/code-insider-x64-1639979337.tar.gz
                case Platform.WindowsX64:
                case Platform.WindowsArm: {
                    const buildMeta = await this.fetchBuildMeta({ runtime, commit, quality, flavor });
                    switch (flavor) {
                        case Flavor.Default:
                            return `VSCode-win32-${arch}-${buildMeta.productVersion}.zip`;
                        case Flavor.WindowsSystemInstaller:
                            return `VSCodeSetup-${arch}-${buildMeta.productVersion}.exe`;
                        case Flavor.WindowsUserInstaller:
                            return `VSCodeUserSetup-${arch}-${buildMeta.productVersion}.exe`;
                    }
                }
            }
        }

        // CLI
        switch (platform) {
            case Platform.MacOSX64:
                return 'vscode_cli_darwin_x64_cli.zip';
            case Platform.MacOSArm:
                return 'vscode_cli_darwin_arm64_cli.zip';
            case Platform.LinuxX64:
                return 'vscode_cli_linux_x64_cli.tar.gz';
            case Platform.LinuxArm:
                return 'vscode_cli_linux_arm64_cli.tar.gz';
            case Platform.WindowsX64:
                return 'vscode_cli_win32_x64_cli.zip';
            case Platform.WindowsArm:
                return 'vscode_cli_win32_arm64_cli.zip';
        }
    }

    private async getBuildName({ runtime, commit, quality, flavor }: IBuild): Promise<string> {

        // Server
        if (runtime === Runtime.WebLocal || runtime === Runtime.WebRemote) {
            switch (platform) {
                case Platform.MacOSX64:
                case Platform.MacOSArm:
                    return `vscode-server-darwin-${arch}-web`;
                case Platform.LinuxX64:
                case Platform.LinuxArm:
                    return `vscode-server-linux-${arch}-web`;
                case Platform.WindowsX64:
                case Platform.WindowsArm:
                    return `vscode-server-win32-${arch}-web`;
            }
        }

        // Desktop
        if (flavor !== Flavor.Cli) {
            switch (platform) {
                case Platform.MacOSX64:
                case Platform.MacOSArm:
                    // Exploration builds use the same naming convention as insider builds
                    return quality === 'insider' || quality === 'exploration' ? 'Visual Studio Code - Insiders.app' : 'Visual Studio Code.app';
                case Platform.LinuxX64:
                case Platform.LinuxArm:
                    return `VSCode-linux-${arch}`;
                case Platform.WindowsX64:
                case Platform.WindowsArm: {
                    const buildMeta = await this.fetchBuildMeta({ runtime, commit, quality, flavor });

                    return `VSCode-win32-${arch}-${buildMeta.productVersion}`;
                }
            }
        }

        // CLI - exploration builds use the same executable name as insider builds
        return quality === 'insider' || quality === 'exploration' ? 'code-insiders' : 'code';
    }

    private fetchBuildMeta({ runtime, commit, quality, flavor }: IBuild): Promise<IBuildMetadata> {
        return jsonGet<IBuildMetadata>(`https://update.code.visualstudio.com/api/versions/commit:${commit}/${this.getPlatformName({ runtime, quality, flavor })}/${quality}`);
    }

    private getPlatformName({ runtime, flavor }: IBuildKind): string {

        // Server
        if (runtime === Runtime.WebLocal || runtime === Runtime.WebRemote) {
            switch (platform) {
                case Platform.MacOSX64:
                    return 'server-darwin-web';
                case Platform.MacOSArm:
                    return `server-darwin-${Arch.Arm64}-web`;
                case Platform.LinuxX64:
                case Platform.LinuxArm:
                    return `server-linux-${arch}-web`;
                case Platform.WindowsX64:
                case Platform.WindowsArm:
                    return `server-win32-${arch}-web`;
            }
        }

        // Desktop
        if (flavor !== Flavor.Cli) {
            switch (platform) {
                case Platform.MacOSX64:
                    return flavor === Flavor.DarwinUniversal ? 'darwin-universal' : 'darwin';
                case Platform.MacOSArm:
                    return flavor === Flavor.DarwinUniversal ? 'darwin-universal' : `darwin-${Arch.Arm64}`;
                case Platform.LinuxX64:
                case Platform.LinuxArm:
                    switch (flavor) {
                        case Flavor.Default:
                            return `linux-${arch}`;
                        case Flavor.LinuxDeb:
                            return `linux-deb-${arch}`;
                        case Flavor.LinuxRPM:
                            return `linux-rpm-${arch}`;
                        case Flavor.LinuxSnap:
                            return `linux-snap-${arch}`;
                    }
                case Platform.WindowsX64:
                case Platform.WindowsArm:
                    switch (flavor) {
                        case Flavor.Default:
                            return `win32-${arch}-archive`;
                        case Flavor.WindowsUserInstaller:
                            return `win32-${arch}-user`;
                        case Flavor.WindowsSystemInstaller:
                            return `win32-${arch}`;
                    }
            }
        }

        // CLI
        switch (platform) {
            case Platform.MacOSX64:
            case Platform.MacOSArm:
                return `cli-darwin-${arch}`;
            case Platform.LinuxX64:
            case Platform.LinuxArm:
                return `cli-linux-${arch}`;
            case Platform.WindowsX64:
            case Platform.WindowsArm:
                return `cli-win32-${arch}`;
        }
    }

    async getBuildExecutable({ runtime, commit, quality, flavor }: IBuild): Promise<string> {
        const buildPath = getBuildPath(commit, quality, flavor);
        const buildName = await builds.getBuildName({ runtime, commit, quality, flavor });

        // Server
        if (runtime === Runtime.WebLocal || runtime === Runtime.WebRemote) {
            switch (platform) {
                case Platform.MacOSX64:
                case Platform.MacOSArm:
                case Platform.LinuxX64:
                case Platform.LinuxArm: {
                    const oldLocation = join(buildPath, buildName, 'server.sh');
                    if (await exists(oldLocation)) {
                        return oldLocation; // only valid until 1.64.x
                    }

                    // Exploration builds use the same server executable name as insider builds
                    return join(buildPath, buildName, 'bin', quality === 'insider' || quality === 'exploration' ? 'code-server-insiders' : 'code-server');
                }
                case Platform.WindowsX64:
                case Platform.WindowsArm: {
                    const oldLocation = join(buildPath, buildName, 'server.cmd');
                    if (await exists(oldLocation)) {
                        return oldLocation; // only valid until 1.64.x
                    }

                    // Exploration builds use the same server executable name as insider builds
                    return join(buildPath, buildName, buildName, 'bin', quality === 'insider' || quality === 'exploration' ? 'code-server-insiders.cmd' : 'code-server.cmd');
                }
            }
        }

        // Desktop
        if (flavor !== Flavor.Cli) {
            switch (platform) {
                case Platform.MacOSX64:
                case Platform.MacOSArm:
                    return join(buildPath, buildName, 'Contents', 'MacOS', 'Electron');
                case Platform.LinuxX64:
                case Platform.LinuxArm:
                    // Exploration builds use the same executable name as insider builds
                    return join(buildPath, buildName, quality === 'insider' || quality === 'exploration' ? 'code-insiders' : 'code')
                case Platform.WindowsX64:
                case Platform.WindowsArm:
                    // Exploration builds use the same executable name as insider builds
                    return join(buildPath, buildName, quality === 'insider' || quality === 'exploration' ? 'Code - Insiders.exe' : 'Code.exe');
            }
        }

        // CLI
        switch (platform) {
            case Platform.MacOSX64:
            case Platform.MacOSArm:
            case Platform.LinuxX64:
            case Platform.LinuxArm:
                return join(buildPath, buildName);
            case Platform.WindowsX64:
            case Platform.WindowsArm:
                return join(buildPath, `${buildName}.exe`);
        }
    }
}

export const builds = new Builds();
