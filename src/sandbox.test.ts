import { assertEquals, assertStringIncludes } from '@std/assert';
import { resolve } from '@std/path';
import { run_sandbox } from './sandbox.js';

const WORKSPACE = resolve('./test_sandbox_workspace');

Deno.test('Sandbox - Basic Execution', async () => {
    const result = await run_sandbox({
        code: 'console.log("Hello from Sandbox");',
        workspace: WORKSPACE,
        timeout: 5000,
        memoryLimit: 50,
    });

    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, 'Hello from Sandbox');
    assertEquals(result.timedOut, false);
});

Deno.test('Sandbox - Timeout Execution', async () => {
    // Run a loop that definitely takes longer than the timeout
    // Using a busy loop to ensure it blocks and gets killed
    const result = await run_sandbox({
        code: 'while (true) {}',
        workspace: WORKSPACE,
        timeout: 500, // 0.5s timeout
        memoryLimit: 50,
    });

    assertEquals(result.timedOut, true);
    assertEquals(result.success, false);
    assertStringIncludes(result.stderr, 'Execution timed out');
});

Deno.test('Sandbox - Runtime Error', async () => {
    const result = await run_sandbox({
        code: 'throw new Error("Runtime Crash");',
        workspace: WORKSPACE,
        timeout: 2000,
        memoryLimit: 50,
    });

    assertEquals(result.success, false);
    assertStringIncludes(result.stderr, 'Runtime Crash');
});

Deno.test('Sandbox - Security (No Network Access)', async () => {
    // fetch requires --allow-net which is not provided
    const result = await run_sandbox({
        code: 'await fetch("https://example.com")',
        workspace: WORKSPACE,
        timeout: 2000,
        memoryLimit: 50,
    });

    assertEquals(result.success, false);
    assertStringIncludes(result.stderr, 'NotCapable');
});

Deno.test('Sandbox - Security (Restricted File System)', async () => {
    // script runs inside WORKSPACE. Trying to read a file outside (e.g. project root deno.json)
    // Relative path from workspace/script.ts to project root is ../
    const result = await run_sandbox({
        code: 'await Deno.readTextFile("../deno.json")',
        workspace: WORKSPACE,
        timeout: 2000,
        memoryLimit: 50,
    });

    assertEquals(result.success, false);
    assertStringIncludes(result.stderr, 'NotCapable');
});

// Clean up workspace after tests
Deno.test('Cleanup', async () => {
    try {
        await Deno.remove(WORKSPACE, { recursive: true });
    } catch {
        // ignore if already removed
    }
});
