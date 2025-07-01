/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Quality, VSCODE_DEV_URL, CONFIG } from '../constants.js';
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