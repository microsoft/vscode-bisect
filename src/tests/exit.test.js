import { describe, it } from 'node:test';
import { spawn } from 'child_process';
import { strict as assert } from 'assert';

describe('Process Exit Behavior', () => {
    it('should exit cleanly with explicit process.exit(0)', async () => {
        // Test that a process with explicit exit actually exits
        const cp = spawn('node', ['-e', 'console.log("test"); process.exit(0);']);
        
        return new Promise((resolve, reject) => {
            let output = '';
            
            cp.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            cp.on('close', (code) => {
                try {
                    assert.equal(code, 0, 'Process should exit with code 0');
                    assert.equal(output.trim(), 'test', 'Should output test message');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            
            cp.on('error', (error) => {
                reject(error);
            });
        });
    });
    
    it('should handle process kill gracefully', async () => {
        // Test that process kill works as expected
        const cp = spawn('node', ['-e', 'setInterval(() => {}, 1000); // Keep alive']);
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                cp.kill('SIGTERM');
            }, 100);
            
            cp.on('close', (code, signal) => {
                try {
                    assert.equal(signal, 'SIGTERM', 'Process should be killed with SIGTERM');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            
            cp.on('error', (error) => {
                reject(error);
            });
        });
    });
});