export interface RunSandboxOptions {
    code: string;
    workspace: string;
    timeout: number;
    memoryLimit: number; // MB
}

export interface SandboxResult {
    success: boolean;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    error?: string;
}

export const run_sandbox = async (options: RunSandboxOptions): Promise<SandboxResult> => {
    const { code, workspace, timeout, memoryLimit } = options;

    // Ensure workspace directory exists
    try {
        await Deno.stat(workspace);
    } catch {
        await Deno.mkdir(workspace, { recursive: true });
    }

    // Create a unique file for this execution
    const scriptId = crypto.randomUUID();
    const scriptName = `sandbox_${scriptId}.ts`;
    const scriptPath = `${workspace.replace(/\/+$/, '')}/${scriptName}`;

    // Write the user code to the file
    await Deno.writeTextFile(scriptPath, code);

    const controller = new AbortController();
    const { signal } = controller;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let timedOut = false;

    try {
        // Use Deno.Command for modern process execution
        const command = new Deno.Command('deno', {
            args: [
                'run',
                '--no-remote', // Disable remote imports for security
                '--no-npm', // Disable npm resolution (optional, creates stricter sandbox)
                `--allow-read=${workspace}`, // Restrict read access to workspace
                `--allow-write=${workspace}`, // Restrict write access to workspace
                memoryLimit ? `--v8-flags=--max-old-space-size=${memoryLimit}` : '', // Limit memory usage
                scriptPath,
            ].filter(Boolean),
            stdout: 'piped',
            stderr: 'piped',
            signal,
        });

        const output = await command.output();
        clearTimeout(timeoutId);

        const decoder = new TextDecoder();

        // Check if the process was killed by the abort signal
        if (signal.aborted) {
            return {
                success: false,
                stdout: decoder.decode(output.stdout),
                stderr: 'Execution timed out',
                timedOut: true,
                error: 'Timeout',
            };
        }

        return {
            success: output.success,
            stdout: decoder.decode(output.stdout),
            stderr: decoder.decode(output.stderr),
            timedOut: false,
        };
    } catch (error) {
        clearTimeout(timeoutId);

        // Handle Timeout (AbortError)
        if (error instanceof DOMException && error.name === 'AbortError') {
            timedOut = true;
            return {
                success: false,
                stdout: '',
                stderr: 'Execution timed out',
                timedOut: true,
                error: 'Timeout',
            };
        }

        return {
            success: false,
            stdout: '',
            stderr: String(error),
            timedOut: false,
            error: String(error),
        };
    } finally {
        // Cleanup: Remove the temporary script file
        try {
            await Deno.remove(scriptPath);
        } catch {
            // Ignore cleanup errors (e.g., if file was already removed or permission issues)
        }
    }
};
