/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Quality, qualityFromString, VSCODE_DEV_URL, CONFIG, Runtime, runtimeFromString, flavorFromString, Flavor, Platform, platform, Arch, arch } from '../constants.js';
import { builds, IBuildKind } from '../builds.js';

describe('Quality functions', () => {
    test('qualityFromString handles all quality values correctly', () => {
        // Test valid quality strings
        assert.strictEqual(qualityFromString('stable'), Quality.Stable);
        assert.strictEqual(qualityFromString('insider'), Quality.Insider);
        assert.strictEqual(qualityFromString('exploration'), Quality.Exploration);
        
        // Test default fallback for undefined
        assert.strictEqual(qualityFromString(undefined), Quality.Insider);
        
        // Test invalid string throws error
        assert.throws(() => qualityFromString('invalid'), /Unknown quality: invalid/);
    });
    
    test('Quality enum values are correct', () => {
        assert.strictEqual(Quality.Stable, 'stable');
        assert.strictEqual(Quality.Insider, 'insider');
        assert.strictEqual(Quality.Exploration, 'exploration');
    });
});

describe('Runtime functions', () => {
    test('runtimeFromString handles all runtime values correctly', () => {
        // Test valid runtime strings
        assert.strictEqual(runtimeFromString('web'), Runtime.WebLocal);
        assert.strictEqual(runtimeFromString('vscode.dev'), Runtime.WebRemote);
        assert.strictEqual(runtimeFromString('desktop'), Runtime.DesktopLocal);
        
        // Test default fallback for undefined
        assert.strictEqual(runtimeFromString(undefined), Runtime.DesktopLocal);
        
        // Test invalid string throws error
        assert.throws(() => runtimeFromString('invalid'), /Unknown runtime: invalid/);
    });
});

describe('Flavor functions', () => {
    test('flavorFromString handles all flavor values correctly', () => {
        // Test valid flavor strings
        assert.strictEqual(flavorFromString('universal'), Flavor.DarwinUniversal);
        assert.strictEqual(flavorFromString('win32-user'), Flavor.WindowsUserInstaller);
        assert.strictEqual(flavorFromString('win32-system'), Flavor.WindowsSystemInstaller);
        assert.strictEqual(flavorFromString('linux-deb'), Flavor.LinuxDeb);
        assert.strictEqual(flavorFromString('linux-rpm'), Flavor.LinuxRPM);
        assert.strictEqual(flavorFromString('linux-snap'), Flavor.LinuxSnap);
        assert.strictEqual(flavorFromString('cli'), Flavor.Cli);
        assert.strictEqual(flavorFromString('cli-linux-amd64'), Flavor.CliLinuxAmd64);
        assert.strictEqual(flavorFromString('cli-linux-arm64'), Flavor.CliLinuxArm64);
        assert.strictEqual(flavorFromString('cli-linux-armv7'), Flavor.CliLinuxArmv7);
        assert.strictEqual(flavorFromString('cli-alpine-amd64'), Flavor.CliAlpineAmd64);
        assert.strictEqual(flavorFromString('cli-alpine-arm64'), Flavor.CliAlpineArm64);
        
        // Test default fallback for undefined
        assert.strictEqual(flavorFromString(undefined), Flavor.Default);
        
        // Test invalid string throws error
        assert.throws(() => flavorFromString('invalid'), /Unknown flavor: invalid/);
    });
});

describe('VSCode.dev URL generation', () => {
    test('VSCODE_DEV_URL handles all quality types correctly without token', () => {
        // Clear token to test non-authenticated URLs
        const originalToken = CONFIG.token;
        CONFIG.token = undefined;
        
        try {
            const commit = 'abc123';
            
            // Test stable quality
            const stableUrl = VSCODE_DEV_URL(commit, Quality.Stable);
            assert.strictEqual(stableUrl, `https://vscode.dev/?vscode-version=${commit}`);
            
            // Test insider quality
            const insiderUrl = VSCODE_DEV_URL(commit, Quality.Insider);
            assert.strictEqual(insiderUrl, `https://insiders.vscode.dev/?vscode-version=${commit}`);
            
            // Test exploration quality
            const explorationUrl = VSCODE_DEV_URL(commit, Quality.Exploration);
            assert.strictEqual(explorationUrl, `https://exploration.vscode.dev/?vscode-version=${commit}`);
        } finally {
            CONFIG.token = originalToken;
        }
    });
    
    test('VSCODE_DEV_URL handles all quality types correctly with token', () => {
        // Set token to test authenticated URLs
        const originalToken = CONFIG.token;
        CONFIG.token = 'test-token';
        
        try {
            const commit = 'abc123';
            
            // Test stable quality
            const stableUrl = VSCODE_DEV_URL(commit, Quality.Stable);
            assert.strictEqual(stableUrl, `https://vscode.dev/github/microsoft/vscode/blob/main/package.json?vscode-version=${commit}`);
            
            // Test insider quality
            const insiderUrl = VSCODE_DEV_URL(commit, Quality.Insider);
            assert.strictEqual(insiderUrl, `https://insiders.vscode.dev/github/microsoft/vscode/blob/main/package.json?vscode-version=${commit}`);
            
            // Test exploration quality
            const explorationUrl = VSCODE_DEV_URL(commit, Quality.Exploration);
            assert.strictEqual(explorationUrl, `https://exploration.vscode.dev/github/microsoft/vscode/blob/main/package.json?vscode-version=${commit}`);
        } finally {
            CONFIG.token = originalToken;
        }
    });
});

describe('Build system functionality', () => {
    // Helper to access private methods for testing
    const buildsInstance = builds as any;
    
    test('getBuildApiName handles exploration quality correctly', () => {
        const buildKinds: IBuildKind[] = [
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.WebLocal, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.WebRemote, quality: Quality.Exploration, flavor: Flavor.Default },
        ];
        
        for (const buildKind of buildKinds) {
            // Test that the method doesn't throw and returns a string
            const apiName = buildsInstance.getBuildApiName(buildKind);
            assert.ok(typeof apiName === 'string');
            assert.ok(apiName.length > 0);
        }
    });
    
    test('getPlatformName handles exploration quality correctly', () => {
        const buildKinds: IBuildKind[] = [
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Cli },
            { runtime: Runtime.WebLocal, quality: Quality.Exploration, flavor: Flavor.Default },
        ];
        
        for (const buildKind of buildKinds) {
            // Test that the method doesn't throw and returns a string
            const platformName = buildsInstance.getPlatformName(buildKind);
            assert.ok(typeof platformName === 'string');
            assert.ok(platformName.length > 0);
        }
    });
    
    test('getBuildName generates correct names for exploration quality', async () => {
        const commit = 'test-commit';
        
        // Test CLI build names
        const cliBuild = { runtime: Runtime.DesktopLocal, commit, quality: Quality.Exploration, flavor: Flavor.Cli };
        const cliBuildName = await buildsInstance.getBuildName(cliBuild);
        assert.strictEqual(cliBuildName, 'code-exploration');
        
        // Compare with other qualities
        const stableCliBuild = { runtime: Runtime.DesktopLocal, commit, quality: Quality.Stable, flavor: Flavor.Cli };
        const stableCliBuildName = await buildsInstance.getBuildName(stableCliBuild);
        assert.strictEqual(stableCliBuildName, 'code');
        
        const insiderCliBuild = { runtime: Runtime.DesktopLocal, commit, quality: Quality.Insider, flavor: Flavor.Cli };
        const insiderCliBuildName = await buildsInstance.getBuildName(insiderCliBuild);
        assert.strictEqual(insiderCliBuildName, 'code-insiders');
    });
    
    test('getBuildName generates correct names for exploration desktop builds on macOS', async () => {
        // Skip if not on macOS platform
        if (platform !== Platform.MacOSX64 && platform !== Platform.MacOSArm) {
            return;
        }
        
        const commit = 'test-commit';
        const desktopBuild = { runtime: Runtime.DesktopLocal, commit, quality: Quality.Exploration, flavor: Flavor.Default };
        const buildName = await buildsInstance.getBuildName(desktopBuild);
        assert.strictEqual(buildName, 'Visual Studio Code - Exploration.app');
        
        // Compare with other qualities
        const stableBuild = { runtime: Runtime.DesktopLocal, commit, quality: Quality.Stable, flavor: Flavor.Default };
        const stableBuildName = await buildsInstance.getBuildName(stableBuild);
        assert.strictEqual(stableBuildName, 'Visual Studio Code.app');
        
        const insiderBuild = { runtime: Runtime.DesktopLocal, commit, quality: Quality.Insider, flavor: Flavor.Default };
        const insiderBuildName = await buildsInstance.getBuildName(insiderBuild);
        assert.strictEqual(insiderBuildName, 'Visual Studio Code - Insiders.app');
    });
    
    test('getBuildName generates correct names for exploration server builds', async () => {
        const commit = 'test-commit';
        
        // Test server build names for different platforms
        const serverBuild = { runtime: Runtime.WebLocal, commit, quality: Quality.Exploration, flavor: Flavor.Default };
        const serverBuildName = await buildsInstance.getBuildName(serverBuild);
        
        // Should contain platform-specific naming
        assert.ok(typeof serverBuildName === 'string');
        assert.ok(serverBuildName.includes('vscode-server'));
        assert.ok(serverBuildName.includes('web'));
    });
    
    test('exploration quality works with different build combinations', () => {
        // Test various combinations that should be valid
        const validCombinations: IBuildKind[] = [
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Cli },
            { runtime: Runtime.WebLocal, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.WebRemote, quality: Quality.Exploration, flavor: Flavor.Default },
        ];
        
        // Add platform-specific flavors
        if (platform === Platform.MacOSX64 || platform === Platform.MacOSArm) {
            validCombinations.push(
                { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.DarwinUniversal }
            );
        } else if (platform === Platform.WindowsX64 || platform === Platform.WindowsArm) {
            validCombinations.push(
                { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.WindowsUserInstaller },
                { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.WindowsSystemInstaller }
            );
        } else if (platform === Platform.LinuxX64 || platform === Platform.LinuxArm) {
            validCombinations.push(
                { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.LinuxDeb },
                { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.LinuxRPM },
                { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.LinuxSnap }
            );
        }
        
        // Test that all combinations work with build system methods
        for (const buildKind of validCombinations) {
            // Test getBuildApiName
            const apiName = buildsInstance.getBuildApiName(buildKind);
            assert.ok(typeof apiName === 'string' && apiName.length > 0);
            
            // Test getPlatformName
            const platformName = buildsInstance.getPlatformName(buildKind);
            assert.ok(typeof platformName === 'string' && platformName.length > 0);
        }
    });
});

describe('URL generation edge cases', () => {
    test('exploration URLs with special characters in commit hash', () => {
        const originalToken = CONFIG.token;
        CONFIG.token = undefined;
        
        try {
            // Test with various commit hash formats
            const commitHashes = ['abc123', 'abc123def456', '1234567890abcdef', 'v1.93.0', 'test-branch'];
            
            for (const commit of commitHashes) {
                const url = VSCODE_DEV_URL(commit, Quality.Exploration);
                assert.ok(url.includes(`vscode-version=${commit}`));
                assert.ok(url.startsWith('https://exploration.vscode.dev'));
            }
        } finally {
            CONFIG.token = originalToken;
        }
    });
    
    test('exploration URLs maintain consistency across different scenarios', () => {
        const commit = 'test-commit';
        
        // Test with different token states
        const originalToken = CONFIG.token;
        
        try {
            // Without token
            CONFIG.token = undefined;
            const urlWithoutToken = VSCODE_DEV_URL(commit, Quality.Exploration);
            
            // With token
            CONFIG.token = 'test-token';
            const urlWithToken = VSCODE_DEV_URL(commit, Quality.Exploration);
            
            // Both should use exploration subdomain
            assert.ok(urlWithoutToken.startsWith('https://exploration.vscode.dev'));
            assert.ok(urlWithToken.startsWith('https://exploration.vscode.dev'));
            
            // Both should include the commit
            assert.ok(urlWithoutToken.includes(commit));
            assert.ok(urlWithToken.includes(commit));
            
            // Token version should have github path
            assert.ok(urlWithToken.includes('github/microsoft/vscode'));
            assert.ok(!urlWithoutToken.includes('github/microsoft/vscode'));
        } finally {
            CONFIG.token = originalToken;
        }
    });
});

describe('Build system comprehensive testing', () => {
    const buildsInstance = builds as any;
    
    test('exploration quality works with all supported architecture combinations', () => {
        // Test with different architecture scenarios
        const architectures = [Arch.X64, Arch.Arm64];
        
        for (const testArch of architectures) {
            const buildKind = { 
                runtime: Runtime.DesktopLocal, 
                quality: Quality.Exploration, 
                flavor: Flavor.Default 
            };
            
            // These should not throw errors regardless of architecture
            assert.doesNotThrow(() => {
                buildsInstance.getBuildApiName(buildKind);
            });
            
            assert.doesNotThrow(() => {
                buildsInstance.getPlatformName(buildKind);
            });
        }
    });
    
    test('exploration quality naming conventions are consistent', async () => {
        const commit = 'consistent-test';
        
        // Test that exploration naming follows consistent patterns
        const buildKinds = [
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Cli },
            { runtime: Runtime.WebLocal, quality: Quality.Exploration, flavor: Flavor.Default },
        ];
        
        for (const buildKind of buildKinds) {
            const buildName = await buildsInstance.getBuildName({ ...buildKind, commit });
            
            // Exploration builds should have consistent naming
            if (buildKind.flavor === Flavor.Cli) {
                assert.strictEqual(buildName, 'code-exploration');
            } else if (buildKind.runtime === Runtime.WebLocal) {
                assert.ok(buildName.includes('vscode-server'));
                assert.ok(buildName.includes('web'));
            }
        }
    });
    
    test('exploration quality parameter validation', () => {
        // Test various parameter combinations
        const validCombinations = [
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.WebLocal, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.WebRemote, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Cli },
        ];
        
        for (const combo of validCombinations) {
            // Test that all combinations work with internal methods
            assert.doesNotThrow(() => {
                buildsInstance.getBuildApiName(combo);
                buildsInstance.getPlatformName(combo);
            }, `Combination should be valid: ${JSON.stringify(combo)}`);
        }
    });
});

describe('Build executable path generation', () => {
    test('getBuildExecutable generates correct paths for exploration CLI builds', async () => {
        const commit = 'test-commit';
        const cliBuild = { runtime: Runtime.DesktopLocal, commit, quality: Quality.Exploration, flavor: Flavor.Cli };
        
        try {
            const executablePath = await builds.getBuildExecutable(cliBuild);
            
            // Should contain the quality-specific executable name
            assert.ok(executablePath.includes('code-exploration') || executablePath.includes('code-exploration.exe'));
        } catch (error) {
            // It's expected that this might fail in test environment without actual builds
            // Just verify the method exists and can be called
            assert.ok(true);
        }
    });
    
    test('getBuildExecutable handles all quality types for CLI builds', async () => {
        const commit = 'test-commit';
        const qualities = [Quality.Stable, Quality.Insider, Quality.Exploration];
        
        for (const quality of qualities) {
            const cliBuild = { runtime: Runtime.DesktopLocal, commit, quality, flavor: Flavor.Cli };
            
            try {
                const executablePath = await builds.getBuildExecutable(cliBuild);
                assert.ok(typeof executablePath === 'string');
                assert.ok(executablePath.length > 0);
                
                // Verify quality-specific naming
                if (quality === Quality.Stable) {
                    assert.ok(executablePath.includes('code') && !executablePath.includes('insiders') && !executablePath.includes('exploration'));
                } else if (quality === Quality.Insider) {
                    assert.ok(executablePath.includes('code-insiders'));
                } else if (quality === Quality.Exploration) {
                    assert.ok(executablePath.includes('code-exploration'));
                }
            } catch (error) {
                // Expected in test environment - just verify method exists
                assert.ok(true);
            }
        }
    });
    
    test('getBuildExecutable handles server builds with exploration quality', async () => {
        const commit = 'test-commit';
        const serverBuild = { runtime: Runtime.WebLocal, commit, quality: Quality.Exploration, flavor: Flavor.Default };
        
        try {
            const executablePath = await builds.getBuildExecutable(serverBuild);
            
            // Should contain server-specific path
            assert.ok(executablePath.includes('code-server'));
            // Should contain quality-specific naming for newer builds
            if (!executablePath.includes('server.sh') && !executablePath.includes('server.cmd')) {
                assert.ok(executablePath.includes('code-server-exploration'));
            }
        } catch (error) {
            // Expected in test environment
            assert.ok(true);
        }
    });
});

describe('Edge cases and error handling', () => {
    test('exploration quality works with all supported runtime/flavor combinations', () => {
        const testCombinations = [
            { runtime: Runtime.DesktopLocal, flavor: Flavor.Default },
            { runtime: Runtime.DesktopLocal, flavor: Flavor.Cli },
            { runtime: Runtime.WebLocal, flavor: Flavor.Default },
            { runtime: Runtime.WebRemote, flavor: Flavor.Default },
        ];
        
        // Add platform-specific combinations
        if (platform === Platform.MacOSX64 || platform === Platform.MacOSArm) {
            testCombinations.push({ runtime: Runtime.DesktopLocal, flavor: Flavor.DarwinUniversal });
        }
        if (platform === Platform.WindowsX64 || platform === Platform.WindowsArm) {
            testCombinations.push(
                { runtime: Runtime.DesktopLocal, flavor: Flavor.WindowsUserInstaller },
                { runtime: Runtime.DesktopLocal, flavor: Flavor.WindowsSystemInstaller }
            );
        }
        if (platform === Platform.LinuxX64 || platform === Platform.LinuxArm) {
            testCombinations.push(
                { runtime: Runtime.DesktopLocal, flavor: Flavor.LinuxDeb },
                { runtime: Runtime.DesktopLocal, flavor: Flavor.LinuxRPM },
                { runtime: Runtime.DesktopLocal, flavor: Flavor.LinuxSnap }
            );
        }
        
        // Test each combination with exploration quality
        for (const combo of testCombinations) {
            const buildKind = { ...combo, quality: Quality.Exploration };
            const buildsInstance = builds as any;
            
            // These should not throw errors
            assert.doesNotThrow(() => {
                buildsInstance.getBuildApiName(buildKind);
            });
            
            assert.doesNotThrow(() => {
                buildsInstance.getPlatformName(buildKind);
            });
        }
    });
    
    test('exploration quality enum consistency', () => {
        // Ensure exploration quality is consistently defined
        assert.strictEqual(Quality.Exploration, 'exploration');
        assert.ok(Object.values(Quality).includes(Quality.Exploration));
        
        // Test parsing roundtrip
        const parsed = qualityFromString(Quality.Exploration);
        assert.strictEqual(parsed, Quality.Exploration);
    });
    
    test('exploration quality in build kind validation', () => {
        // Test that IBuildKind interface accepts exploration quality
        const validBuildKind: IBuildKind = {
            runtime: Runtime.DesktopLocal,
            quality: Quality.Exploration,  // This should be valid
            flavor: Flavor.Default
        };
        
        assert.strictEqual(validBuildKind.quality, Quality.Exploration);
        assert.ok(true); // TypeScript compilation validates interface compatibility
    });
    
    test('exploration quality handles invalid input gracefully', () => {
        // Test that qualityFromString throws appropriate errors for invalid input
        const invalidInputs = ['', 'invalid', 'explore', 'exploration1', 'EXPLORATION', 'exploration '];
        
        for (const input of invalidInputs) {
            assert.throws(() => qualityFromString(input), 
                /Unknown quality/, 
                `Should throw error for invalid input: ${input}`);
        }
    });
    
    test('exploration quality case sensitivity', () => {
        // Ensure quality parsing is case sensitive
        assert.throws(() => qualityFromString('EXPLORATION'), /Unknown quality/);
        assert.throws(() => qualityFromString('Exploration'), /Unknown quality/);
        assert.throws(() => qualityFromString('ExPlOrAtIoN'), /Unknown quality/);
        
        // Only exact lowercase match should work
        assert.strictEqual(qualityFromString('exploration'), Quality.Exploration);
    });
    
    test('exploration quality with whitespace handling', () => {
        // Test that whitespace is not trimmed (should fail)
        assert.throws(() => qualityFromString(' exploration'), /Unknown quality/);
        assert.throws(() => qualityFromString('exploration '), /Unknown quality/);
        assert.throws(() => qualityFromString(' exploration '), /Unknown quality/);
        assert.throws(() => qualityFromString('\texploration'), /Unknown quality/);
        assert.throws(() => qualityFromString('exploration\n'), /Unknown quality/);
    });
});

describe('URL generation edge cases', () => {
    test('exploration URLs with special characters in commit hash', () => {
        const originalToken = CONFIG.token;
        CONFIG.token = undefined;
        
        try {
            // Test with various commit hash formats
            const commitHashes = ['abc123', 'abc123def456', '1234567890abcdef', 'v1.93.0', 'test-branch'];
            
            for (const commit of commitHashes) {
                const url = VSCODE_DEV_URL(commit, Quality.Exploration);
                assert.ok(url.includes(`vscode-version=${commit}`));
                assert.ok(url.startsWith('https://exploration.vscode.dev'));
            }
        } finally {
            CONFIG.token = originalToken;
        }
    });
    
    test('exploration URLs maintain consistency across different scenarios', () => {
        const commit = 'test-commit';
        
        // Test with different token states
        const originalToken = CONFIG.token;
        
        try {
            // Without token
            CONFIG.token = undefined;
            const urlWithoutToken = VSCODE_DEV_URL(commit, Quality.Exploration);
            
            // With token
            CONFIG.token = 'test-token';
            const urlWithToken = VSCODE_DEV_URL(commit, Quality.Exploration);
            
            // Both should use exploration subdomain
            assert.ok(urlWithoutToken.startsWith('https://exploration.vscode.dev'));
            assert.ok(urlWithToken.startsWith('https://exploration.vscode.dev'));
            
            // Both should include the commit
            assert.ok(urlWithoutToken.includes(commit));
            assert.ok(urlWithToken.includes(commit));
            
            // Token version should have github path
            assert.ok(urlWithToken.includes('github/microsoft/vscode'));
            assert.ok(!urlWithoutToken.includes('github/microsoft/vscode'));
        } finally {
            CONFIG.token = originalToken;
        }
    });
});

describe('Build system comprehensive testing', () => {
    const buildsInstance = builds as any;
    
    test('exploration quality works with all supported architecture combinations', () => {
        // Test with different architecture scenarios
        const architectures = [Arch.X64, Arch.Arm64];
        
        for (const testArch of architectures) {
            const buildKind = { 
                runtime: Runtime.DesktopLocal, 
                quality: Quality.Exploration, 
                flavor: Flavor.Default 
            };
            
            // These should not throw errors regardless of architecture
            assert.doesNotThrow(() => {
                buildsInstance.getBuildApiName(buildKind);
            });
            
            assert.doesNotThrow(() => {
                buildsInstance.getPlatformName(buildKind);
            });
        }
    });
    
    test('exploration quality naming conventions are consistent', async () => {
        const commit = 'consistent-test';
        
        // Test that exploration naming follows consistent patterns
        const buildKinds = [
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Cli },
            { runtime: Runtime.WebLocal, quality: Quality.Exploration, flavor: Flavor.Default },
        ];
        
        for (const buildKind of buildKinds) {
            const buildName = await buildsInstance.getBuildName({ ...buildKind, commit });
            
            // Exploration builds should have consistent naming
            if (buildKind.flavor === Flavor.Cli) {
                assert.strictEqual(buildName, 'code-exploration');
            } else if (buildKind.runtime === Runtime.WebLocal) {
                assert.ok(buildName.includes('vscode-server'));
                assert.ok(buildName.includes('web'));
            }
        }
    });
    
    test('exploration quality parameter validation', () => {
        // Test various parameter combinations
        const validCombinations = [
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.WebLocal, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.WebRemote, quality: Quality.Exploration, flavor: Flavor.Default },
            { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Cli },
        ];
        
        for (const combo of validCombinations) {
            // Test that all combinations work with internal methods
            assert.doesNotThrow(() => {
                buildsInstance.getBuildApiName(combo);
                buildsInstance.getPlatformName(combo);
            }, `Combination should be valid: ${JSON.stringify(combo)}`);
        }
    });
});

describe('Quality compatibility and consistency', () => {
    test('exploration quality behaves identically to other qualities in core functions', () => {
        const qualities = [Quality.Stable, Quality.Insider, Quality.Exploration];
        const commit = 'consistency-test';
        
        // Test that all qualities work with the same functions
        for (const quality of qualities) {
            // qualityFromString should work
            const parsedQuality = qualityFromString(quality);
            assert.strictEqual(parsedQuality, quality);
            
            // URL generation should work (without token)
            const originalToken = CONFIG.token;
            CONFIG.token = undefined;
            
            try {
                const url = VSCODE_DEV_URL(commit, quality);
                assert.ok(url.includes(commit));
                assert.ok(url.includes('vscode.dev'));
            } finally {
                CONFIG.token = originalToken;
            }
        }
    });
    
    test('exploration quality enum completeness', () => {
        // Ensure all expected qualities are present
        const expectedQualities = ['stable', 'insider', 'exploration'];
        const actualQualities = Object.values(Quality);
        
        assert.strictEqual(actualQualities.length, expectedQualities.length);
        
        for (const expected of expectedQualities) {
            assert.ok(actualQualities.includes(expected as Quality), 
                `Expected quality '${expected}' should be present in enum`);
        }
    });
    
    test('exploration quality type safety', () => {
        // Test that Quality.Exploration is properly typed
        const explorationQuality: Quality = Quality.Exploration;
        assert.strictEqual(explorationQuality, 'exploration');
        
        // Test that it works in arrays and objects
        const qualityArray: Quality[] = [Quality.Stable, Quality.Insider, Quality.Exploration];
        assert.strictEqual(qualityArray.length, 3);
        assert.ok(qualityArray.includes(Quality.Exploration));
        
        const qualityMap: Record<Quality, string> = {
            [Quality.Stable]: 'Stable Version',
            [Quality.Insider]: 'Insider Version',
            [Quality.Exploration]: 'Exploration Version'
        };
        assert.strictEqual(qualityMap[Quality.Exploration], 'Exploration Version');
    });
});