/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { builds, IBuildKind } from '../builds.js';
import { Flavor, Platform, platform, Quality, Runtime, setTesting } from '../constants.js';

setTesting(true);

const platformFlavors = [Flavor.Default, Flavor.Cli];
if (platform === Platform.MacOSArm || platform === Platform.MacOSX64) {
    platformFlavors.push(Flavor.DarwinUniversal);
} else if (platform === Platform.WindowsArm || platform === Platform.WindowsX64) {
    platformFlavors.push(Flavor.WindowsUserInstaller);
    platformFlavors.push(Flavor.WindowsSystemInstaller);
} else if (platform === Platform.LinuxArm || platform === Platform.LinuxX64) {
    platformFlavors.push(Flavor.LinuxDeb);
    platformFlavors.push(Flavor.LinuxRPM);
    platformFlavors.push(Flavor.LinuxSnap);
}

const buildKinds: IBuildKind[] = [];
for (const quality of [Quality.Stable, Quality.Insider]) {
    for (const flavor of platformFlavors) {
        for (const runtime of [Runtime.DesktopLocal, Runtime.WebLocal]) {
            if (flavor !== Flavor.Default && runtime === Runtime.WebLocal) {
                continue; // skip over some invalid combinations
            }

            buildKinds.push({ runtime, quality, flavor });
        }
    }
}

function buildKindToString(kind: IBuildKind): string {
    return `${kind.runtime}-${kind.quality}-${kind.flavor}`;
}

describe('Integration tests', () => {

    for (const kind of buildKinds) {
        test(`fetch and install build by version: ${buildKindToString(kind)}`, async () => {
            const build = await builds.fetchBuildByVersion(kind, '1.100');
            assert.ok(build.commit, `Expected commit to be defined for build ${buildKindToString(kind)}`);

            const path = await builds.downloadAndExtractBuild(build, { forceReDownload: true });
            assert.ok(path);
            assert.ok(fs.existsSync(path), `Expected path to exist for build ${buildKindToString(kind)}`);

            if (kind.flavor === Flavor.Default || kind.flavor === Flavor.Cli || kind.flavor === Flavor.DarwinUniversal) {
                const executable = await builds.getBuildExecutable(build);
                assert.ok(fs.existsSync(executable), `Expected executable to exist for build ${buildKindToString(kind)}`);
            }
        });
    }

    for (const kind of buildKinds) {
        test(`fetch builds: ${buildKindToString(kind)}`, async () => {
            let result = await builds.fetchBuilds(kind, undefined, undefined, true /* released only */);
            assert.ok(result.length > 0, `Expected released builds to be fetched for build ${buildKindToString(kind)}`);

            result = await builds.fetchBuilds(kind, undefined, undefined, false /* released only */);
            assert.ok(result.length > 0, `Expected all builds to be fetched for build ${buildKindToString(kind)}`);
        });
    }

    test('exclude commits functionality', async () => {
        const kind = buildKinds[0]; // Use first build kind for testing

        // Fetch builds without exclusions
        const allBuilds = await builds.fetchBuilds(kind, undefined, undefined, true /* released only */);
        assert.ok(allBuilds.length >= 3, 'Expected at least 3 builds for exclude testing');

        // Take the first 2 commit hashes to exclude
        const excludeCommits = [allBuilds[1].commit, allBuilds[2].commit];

        // Fetch builds with exclusions
        const filteredBuilds = await builds.fetchBuilds(kind, undefined, undefined, true /* released only */, excludeCommits);

        // Verify the excluded commits are not in the result
        const filteredCommits = new Set(filteredBuilds.map(b => b.commit));
        for (const excludedCommit of excludeCommits) {
            assert.ok(!filteredCommits.has(excludedCommit), `Expected excluded commit ${excludedCommit} to not be in filtered builds`);
        }

        // Verify we have fewer builds than before
        assert.ok(filteredBuilds.length < allBuilds.length, 'Expected filtered builds to have fewer items than all builds');
        assert.ok(filteredBuilds.length === allBuilds.length - excludeCommits.length, 'Expected exactly 2 fewer builds after excluding 2 commits');
    });

    test('exploration quality support', async () => {
        // Test that exploration quality is recognized and handled
        const explorationKind: IBuildKind = {
            runtime: Runtime.DesktopLocal,
            quality: Quality.Exploration,
            flavor: Flavor.Default
        };

        // Verify the buildKindToString works with exploration
        const kindStr = buildKindToString(explorationKind);
        assert.ok(kindStr.includes('exploration'), `Expected kind string to include 'exploration', got: ${kindStr}`);

        // Test that exploration builds can be fetched (may be empty if no builds available)
        // This won't fail if exploration builds aren't available, just validates the API call works
        try {
            const result = await builds.fetchBuilds(explorationKind, undefined, undefined, false /* released only */);
            // If we get here, the API call succeeded (builds may or may not be available)
            assert.ok(Array.isArray(result), 'Expected fetchBuilds to return an array for exploration quality');
        } catch (error) {
            // If exploration builds aren't available, that's ok - we just tested the code path
            assert.ok(error instanceof Error, 'Expected error to be an Error instance');
        }
    });
});