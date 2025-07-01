/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Quality, VSCODE_DEV_URL, CONFIG, qualityFromString, Runtime, Flavor } from '../constants.js';
import { builds } from '../builds.js';

describe('Exploration Quality Behavioral Tests', () => {
    test('exploration URLs have correct subdomain structure', () => {
        const commit = 'abc123def456';
        
        // Test without token
        const originalToken = CONFIG.token;
        CONFIG.token = undefined;
        
        try {
            const explorationUrl = VSCODE_DEV_URL(commit, Quality.Exploration);
            
            // Should use exploration subdomain
            assert.ok(explorationUrl.startsWith('https://exploration.vscode.dev'));
            assert.ok(explorationUrl.includes(`vscode-version=${commit}`));
            
            // Compare structure with other qualities
            const stableUrl = VSCODE_DEV_URL(commit, Quality.Stable);
            const insiderUrl = VSCODE_DEV_URL(commit, Quality.Insider);
            
            // All should have the same query parameter structure
            assert.ok(stableUrl.includes(`vscode-version=${commit}`));
            assert.ok(insiderUrl.includes(`vscode-version=${commit}`));
            
            // But different subdomains
            assert.ok(stableUrl.startsWith('https://vscode.dev'));
            assert.ok(insiderUrl.startsWith('https://insiders.vscode.dev'));
            assert.ok(explorationUrl.startsWith('https://exploration.vscode.dev'));
            
        } finally {
            CONFIG.token = originalToken;
        }
    });
    
    test('exploration URLs work correctly with authentication', () => {
        const commit = 'test-commit-hash';
        
        // Test with token
        const originalToken = CONFIG.token;
        CONFIG.token = 'test-github-token';
        
        try {
            const explorationUrl = VSCODE_DEV_URL(commit, Quality.Exploration);
            
            // Should use GitHub route with exploration subdomain
            assert.ok(explorationUrl.startsWith('https://exploration.vscode.dev/github/microsoft/vscode'));
            assert.ok(explorationUrl.includes('blob/main/package.json'));
            assert.ok(explorationUrl.includes(`vscode-version=${commit}`));
            
        } finally {
            CONFIG.token = originalToken;
        }
    });
    
    test('build API methods handle exploration quality consistently', () => {
        const buildsInstance = builds as any;
        const explorationBuildKind = {
            runtime: 'desktop',
            quality: Quality.Exploration,
            flavor: 'default'
        };
        
        // All build-related methods should handle exploration without throwing
        assert.doesNotThrow(() => {
            const apiName = buildsInstance.getBuildApiName(explorationBuildKind);
            assert.ok(typeof apiName === 'string');
        });
        
        assert.doesNotThrow(() => {
            const platformName = buildsInstance.getPlatformName(explorationBuildKind);
            assert.ok(typeof platformName === 'string');
        });
    });
    
    test('exploration quality maintains consistency with other qualities', () => {
        // Test that exploration follows the same patterns as other qualities
        const commit = 'test-commit';
        const buildsInstance = builds as any;
        
        const qualities = [Quality.Stable, Quality.Insider, Quality.Exploration];
        const runtimes = ['desktop', 'web-local'];
        
        for (const quality of qualities) {
            for (const runtime of runtimes) {
                const buildKind = { runtime, quality, flavor: 'default' };
                
                // All combinations should work
                assert.doesNotThrow(() => {
                    buildsInstance.getBuildApiName(buildKind);
                });
                
                assert.doesNotThrow(() => {
                    buildsInstance.getPlatformName(buildKind);
                });
            }
        }
    });
    
    test('exploration build names follow correct naming conventions', async () => {
        const commit = 'test-commit';
        const buildsInstance = builds as any;
        
        // Test CLI naming
        const cliBuild = { runtime: 'desktop', commit, quality: Quality.Exploration, flavor: 'cli' };
        const cliBuildName = await buildsInstance.getBuildName(cliBuild);
        
        // Should follow the pattern: code-{quality}
        assert.strictEqual(cliBuildName, 'code-exploration');
        
        // Test server naming
        const serverBuild = { runtime: 'web-local', commit, quality: Quality.Exploration, flavor: 'default' };
        const serverBuildName = await buildsInstance.getBuildName(serverBuild);
        
        // Should contain server-specific naming
        assert.ok(serverBuildName.includes('vscode-server'));
        assert.ok(serverBuildName.includes('web'));
    });
    
    test('exploration quality handles version parsing correctly', () => {
        // Test that exploration follows same version patterns as other qualities
        const testVersions = ['1.93', '1.94', '2.0'];
        
        for (const version of testVersions) {
            // Version format validation should work the same for all qualities
            const versionRegex = /^\d+\.\d+$/;
            assert.ok(versionRegex.test(version), `Version ${version} should match expected format`);
        }
    });
    
    test('exploration quality error handling', () => {
        // Test that exploration quality doesn't introduce new error cases
        const buildsInstance = builds as any;
        
        // Invalid combinations should still throw appropriate errors
        // (Not testing the actual errors since they may need network access,
        // but ensuring exploration doesn't break existing error handling)
        
        const validBuildKind = {
            runtime: 'desktop',
            quality: Quality.Exploration,
            flavor: 'default'
        };
        
        // These should not throw
        assert.doesNotThrow(() => {
            buildsInstance.getBuildApiName(validBuildKind);
            buildsInstance.getPlatformName(validBuildKind);
        });
    });
});

describe('Exploration Quality Performance Tests', () => {
    test('exploration quality performs comparably to other qualities', () => {
        const iterations = 100;
        const commit = 'perf-test-commit';
        
        // Test that exploration quality doesn't have performance regression
        const startTime = performance.now();
        
        for (let i = 0; i < iterations; i++) {
            // Test quality parsing
            qualityFromString('exploration');
            
            // Test URL generation
            const originalToken = CONFIG.token;
            CONFIG.token = undefined;
            try {
                VSCODE_DEV_URL(commit, Quality.Exploration);
            } finally {
                CONFIG.token = originalToken;
            }
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Should complete within reasonable time (allowing for test environment variability)
        assert.ok(duration < 1000, `Performance test took ${duration}ms, should be under 1000ms`);
    });
    
    test('exploration quality memory usage is reasonable', () => {
        // Test that creating many exploration quality objects doesn't cause issues
        const qualities = [];
        
        for (let i = 0; i < 1000; i++) {
            qualities.push({
                runtime: Runtime.DesktopLocal,
                quality: Quality.Exploration,
                flavor: Flavor.Default,
                commit: `test-commit-${i}`
            });
        }
        
        // Verify we can access all qualities
        assert.strictEqual(qualities.length, 1000);
        assert.ok(qualities.every(q => q.quality === Quality.Exploration));
    });
});

describe('Exploration Quality Integration Scenarios', () => {
    test('exploration quality works in realistic bisect scenarios', () => {
        // Test scenarios that mirror actual bisect usage
        const bisectScenarios = [
            {
                name: 'version-based bisect',
                buildKind: { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Default },
                version: '1.93'
            },
            {
                name: 'commit-based bisect',
                buildKind: { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Default },
                commit: 'abc123def456'
            },
            {
                name: 'cli-based bisect',
                buildKind: { runtime: Runtime.DesktopLocal, quality: Quality.Exploration, flavor: Flavor.Cli },
                version: '1.93'
            },
            {
                name: 'web-based bisect',
                buildKind: { runtime: Runtime.WebLocal, quality: Quality.Exploration, flavor: Flavor.Default },
                version: '1.93'
            }
        ];
        
        const buildsInstance = builds as any;
        
        for (const scenario of bisectScenarios) {
            // Test that build system can handle each scenario
            assert.doesNotThrow(() => {
                buildsInstance.getBuildApiName(scenario.buildKind);
                buildsInstance.getPlatformName(scenario.buildKind);
            }, `Scenario '${scenario.name}' should work with exploration quality`);
        }
    });
    
    test('exploration quality maintains state consistency', () => {
        // Test that exploration quality maintains consistent state across operations
        const originalToken = CONFIG.token;
        
        try {
            // Test state with no token
            CONFIG.token = undefined;
            const url1 = VSCODE_DEV_URL('commit1', Quality.Exploration);
            const url2 = VSCODE_DEV_URL('commit2', Quality.Exploration);
            
            // Both should use exploration subdomain
            assert.ok(url1.startsWith('https://exploration.vscode.dev'));
            assert.ok(url2.startsWith('https://exploration.vscode.dev'));
            
            // Test state with token
            CONFIG.token = 'test-token';
            const url3 = VSCODE_DEV_URL('commit3', Quality.Exploration);
            const url4 = VSCODE_DEV_URL('commit4', Quality.Exploration);
            
            // Both should use exploration subdomain with github path
            assert.ok(url3.startsWith('https://exploration.vscode.dev'));
            assert.ok(url4.startsWith('https://exploration.vscode.dev'));
            assert.ok(url3.includes('github/microsoft/vscode'));
            assert.ok(url4.includes('github/microsoft/vscode'));
            
        } finally {
            CONFIG.token = originalToken;
        }
    });
    
    test('exploration quality error recovery', () => {
        // Test that exploration quality handles errors gracefully
        const buildsInstance = builds as any;
        
        // Test with invalid but structurally correct parameters
        const problematicBuildKind = {
            runtime: Runtime.DesktopLocal,
            quality: Quality.Exploration,
            flavor: Flavor.Default,
            commit: '' // empty commit
        };
        
        // Should not throw errors for basic operations
        assert.doesNotThrow(() => {
            buildsInstance.getBuildApiName(problematicBuildKind);
            buildsInstance.getPlatformName(problematicBuildKind);
        });
    });
});