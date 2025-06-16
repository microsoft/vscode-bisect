/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { builds, IBuildKind } from '../builds.js';
import { Flavor, Platform, platform, Quality, Runtime } from '../constants.js';

const platformFlavors = [Flavor.Default, Flavor.Cli];
if (platform === Platform.MacOSArm || platform === Platform.MacOSX64) {
    platformFlavors.push(Flavor.Universal);
}

const buildKinds: IBuildKind[] = [];
for (const quality of [Quality.Stable, Quality.Insider]) {
    for (const flavor of platformFlavors) {
        for (const runtime of [Runtime.DesktopLocal, Runtime.WebLocal]) {
            buildKinds.push({ runtime, quality, flavor });
        }
    }
}

function buildKindToString(kind: IBuildKind): string {
    return `${kind.runtime}-${kind.quality}-${kind.flavor}`;
}

describe('Integration tests', () => {

    test('fetch and install build by version', async () => {
        for (const kind of buildKinds) {
            const build = await builds.fetchBuildByVersion(kind, '1.100');
            assert.ok(build.commit, `Expected commit to be defined for build ${buildKindToString(kind)}`);

            await builds.installBuild(build, { forceReDownload: true });

            const executable = await builds.getBuildExecutable(build);
            assert.ok(fs.existsSync(executable), `Expected executable to exist for build ${buildKindToString(kind)}`);
        }
    });

    test('fetch builds', async () => {
        for (const kind of buildKinds) {
            let result = await builds.fetchBuilds(kind, undefined, undefined, true /* released only */);
            assert.ok(result.length > 0, `Expected released builds to be fetched for build ${buildKindToString(kind)}`);

            result = await builds.fetchBuilds(kind, undefined, undefined, false /* released only */);
            assert.ok(result.length > 0, `Expected all builds to be fetched for build ${buildKindToString(kind)}`);
        }
    });
});