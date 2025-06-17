/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mkdirSync, rmSync } from 'node:fs';
import clipboard from 'clipboardy';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { join } from 'node:path';
import { URL } from 'node:url';
import { URI } from 'vscode-uri';
import open from 'open';
import kill from 'tree-kill';
import chalk from 'chalk';
import * as perf from '@vscode/vscode-perf';
import { builds, IBuild } from './builds.js';
import { CONFIG, DATA_FOLDER, EXTENSIONS_FOLDER, GIT_VSCODE_FOLDER, LOGGER, DEFAULT_PERFORMANCE_FILE, Platform, platform, Runtime, USER_DATA_FOLDER, VSCODE_DEV_URL, Flavor } from './constants.js';
import { exists } from './files.js';

export interface IInstance {

    /**
     * Optional ellapsed time in milliseconds.
     * Only available for desktop builds and when
     * running with `--perf` command line flag.
     */
    readonly ellapsed?: number;

    /**
     * Stops the instance.
     */
    stop(): Promise<unknown>;
}

const NOOP_INSTANCE: IInstance & IWebInstance = { stop: async () => { }, url: '' };

interface IWebInstance extends IInstance {

    /**
     * URL to the web instance.
     */
    readonly url: string;
}

class Launcher {

    private static readonly WEB_AVAILABLE_REGEX = new RegExp('Web UI available at (http://localhost:8000/?\\?tkn=.+)');

    static {

        // Recreate user data & extension folder
        try {
            rmSync(DATA_FOLDER, { recursive: true });
        } catch (error) { }
        mkdirSync(DATA_FOLDER, { recursive: true });
    }

    async launch(build: IBuild, options?: { forceReDownload: boolean }): Promise<IInstance> {

        // Install (unless web remote)
        let path: string | undefined;
        if (build.runtime !== Runtime.WebRemote) {
            path = await builds.installBuild(build, options);
        }

        // Launch according to runtime
        switch (build.runtime) {

            // Web (local)
            case Runtime.WebLocal:
                if (CONFIG.performance) {
                    LOGGER.log(`${chalk.gray('[build]')} starting local web build ${chalk.green(build.commit)} multiple times and measuring performance...`);
                    return this.runWebPerformance(build);
                }

                LOGGER.log(`${chalk.gray('[build]')} starting local web build ${chalk.green(build.commit)}...`);
                return this.launchLocalWeb(build);

            // Web (remote)
            case Runtime.WebRemote:
                if (CONFIG.performance) {
                    LOGGER.log(`${chalk.gray('[build]')} opening vscode.dev ${chalk.green(build.commit)} multiple times and measuring performance...`);
                    return this.runWebPerformance(build);
                }

                LOGGER.log(`${chalk.gray('[build]')} opening vscode.dev ${chalk.green(build.commit)}...`);
                return this.launchRemoteWeb(build);

            // Desktop
            case Runtime.DesktopLocal:
                if (path && (build.flavor === Flavor.WindowsUserInstaller || build.flavor === Flavor.WindowsSystemInstaller)) {
                    LOGGER.log(`${chalk.gray('[build]')} installing ${chalk.green(path)}...`);
                    return this.runWindowsDesktopInstaller(path);
                }

                if (CONFIG.performance) {
                    LOGGER.log(`${chalk.gray('[build]')} starting desktop build ${chalk.green(build.commit)} multiple times and measuring performance...`);
                    return this.runDesktopPerformance(build);
                }

                LOGGER.log(`${chalk.gray('[build]')} starting ${build.flavor === Flavor.Cli ? 'CLI' : 'desktop'} build ${chalk.green(build.commit)}...`);
                return this.launchElectronOrCLI(build);
        }
    }

    private runWindowsDesktopInstaller(path: string): IInstance {
        const cp = spawn(path, ['/silent']);

        return {
            async stop() {
                cp.kill();
            }
        }
    }

    private async runDesktopPerformance(build: IBuild): Promise<IInstance> {
        const executable = await this.getExecutablePath(build);

        await perf.run({
            build: executable,
            folder: GIT_VSCODE_FOLDER,
            file: join(GIT_VSCODE_FOLDER, 'package.json'),
            profAppendTimers: typeof CONFIG.performance === 'string' ? CONFIG.performance : DEFAULT_PERFORMANCE_FILE
        });

        return NOOP_INSTANCE;
    }

    private async runWebPerformance(build: IBuild): Promise<IInstance> {
        let url: string;
        let server: IWebInstance | undefined;

        // Web local: launch local web server
        if (build.runtime === Runtime.WebLocal) {
            server = await this.launchLocalWebServer(build);
            url = server.url;
        }

        // Web remote: use remote URL
        else {
            url = VSCODE_DEV_URL(build.commit, build.quality);
        }

        try {
            await perf.run({
                build: url,
                runtime: 'web',
                token: CONFIG.token,
                folder: build.runtime === Runtime.WebLocal ? URI.file(GIT_VSCODE_FOLDER).path /* supports Windows & POSIX */ : undefined,
                file: build.runtime === Runtime.WebLocal ? URI.file(join(GIT_VSCODE_FOLDER, 'package.json')).with({ scheme: 'vscode-remote', authority: 'localhost:9888' }).toString(true) : undefined,
                durationMarkersFile: typeof CONFIG.performance === 'string' ? CONFIG.performance : undefined,
            });
        } finally {
            server?.stop();
        }

        return NOOP_INSTANCE;
    }

    private async launchLocalWeb(build: IBuild): Promise<IInstance> {
        const instance = await this.launchLocalWebServer(build);
        if (instance.url) {
            open(instance.url);
        }

        return instance;
    }

    private async launchLocalWebServer(build: IBuild): Promise<IWebInstance> {
        const cp = await this.spawnBuild(build);

        async function stop() {
            return new Promise<void>((resolve, reject) => {
                const pid = cp.pid!;
                kill(pid, error => {
                    if (error) {
                        try {
                            process.kill(pid, 0);
                        } catch (error) {
                            resolve();      // process doesn't exist anymore... so, all good
                            return;
                        }

                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        }

        return new Promise<IWebInstance>(resolve => {
            cp.stdout.on('data', data => {
                LOGGER.trace(`${chalk.gray('[server]')}: ${data.toString()}`);

                const matches = Launcher.WEB_AVAILABLE_REGEX.exec(data.toString());
                const url = matches?.[1];
                if (url) {
                    resolve({ url, stop });
                }
            });

            cp.stderr.on('data', data => {
                LOGGER.trace(`${chalk.red('[server]')}: ${data.toString()}`);
            });
        });
    }

    private async launchRemoteWeb(build: IBuild): Promise<IInstance> {
        open(VSCODE_DEV_URL(build.commit, build.quality));

        return NOOP_INSTANCE;
    }

    private async launchElectronOrCLI(build: IBuild): Promise<IInstance> {
        const cp = await this.spawnBuild(build);

        async function stop() {
            cp.kill();
        }

        return new Promise<IInstance>(resolve => {
            cp.stdout.on('data', data => {
                LOGGER.trace(`${chalk.gray(build.flavor === Flavor.Cli ? '[cli]' : '[electron]')}: ${data.toString()}`);

                if (build.flavor === Flavor.Cli) {
                    const output: string = data.toString().trim();
                    if (output.includes('github.com/login/device')) {
                        const codeMatch = output.match(/code ([A-Z0-9]{4}-[A-Z0-9]{4})/);
                        if (codeMatch) {
                            const code = codeMatch[1];
                            LOGGER.log(`${chalk.gray('[build]')} Open ${chalk.underline('https://github.com/login/device')} and use code ${chalk.green(code)} to log in`);
                            clipboard.writeSync(code);
                            open(`https://github.com/login/device`);
                        }
                    } else if (output.includes('microsoft.com/devicelogin')) {
                        const codeMatch = output.match(/code ([A-Z0-9]{9})/);
                        if (codeMatch) {
                            const code = codeMatch[1];
                            LOGGER.log(`${chalk.gray('[build]')} Open ${chalk.underline('https://microsoft.com/devicelogin')} and use code ${chalk.green(code)} to log in`);
                            clipboard.writeSync(code);
                            open(`https://microsoft.com/devicelogin`);
                        }
                    } else if (output.includes('Open this link in your browser')) {
                        const url = output.substring('Open this link in your browser '.length);
                        try {
                            const href = new URL(url).href;
                            LOGGER.log(`${chalk.gray('[build]')} Opening ${chalk.underline(href)} in your browser...`);
                            open(`${href}?vscode-version=${build.commit}`);

                            return resolve({ stop });
                        } catch (error) {
                            LOGGER.log(`${chalk.gray('[build]')} Invalid URL extracted: ${url}`);
                        }
                    }
                }
            });

            cp.stderr.on('data', data => {
                LOGGER.trace(`${chalk.red(build.flavor === Flavor.Cli ? '[cli]' : '[electron]')}: ${data.toString()}`);
            });

            if (build.flavor !== Flavor.Cli) {
                return resolve({ stop });
            }
        });
    }

    private async spawnBuild(build: IBuild): Promise<ChildProcessWithoutNullStreams> {
        const executable = await this.getExecutablePath(build);
        LOGGER.trace(`${chalk.gray('[build]')} starting build via ${chalk.green(executable)}...`);

        const args = build.flavor === Flavor.Cli ? ['tunnel'] : [
            '--accept-server-license-terms',
            '--extensions-dir',
            EXTENSIONS_FOLDER,
            '--skip-release-notes'
        ];

        if (build.runtime === Runtime.DesktopLocal && build.flavor !== Flavor.Cli) {
            args.push(
                '--disable-updates',
                '--user-data-dir',
                USER_DATA_FOLDER,
                '--disable-telemetry'
            );
        }

         return spawn(executable, args);
    }

    private async getExecutablePath(build: IBuild): Promise<string> {
        const executable = await builds.getBuildExecutable(build);

        const executableExists = await exists(executable);
        if (!executableExists) {
            throw new Error(`[build] unable to find executable ${executable} on disk. Is the archive corrupt?`);
        }

        return executable;
    }
}

export const launcher = new Launcher();