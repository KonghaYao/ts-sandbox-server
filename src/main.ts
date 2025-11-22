import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { stream } from 'hono/streaming';
import { run_sandbox } from './sandbox.js';

const app = new Hono();

// 获取环境变量中的 Master Key
const MASTER_KEY = Deno.env.get('MASTER_KEY');

// 安全检查：如果未设置 MASTER_KEY，则警告或拒绝启动
if (!MASTER_KEY) {
    console.warn('WARNING: MASTER_KEY environment variable is not set. Authentication is disabled.');
}

app.use(logger());
app.use(prettyJSON());

// 全局中间件：Master Key 认证
app.use(async (c, next) => {
    // 如果没有设置 MASTER_KEY，则跳过认证（开发模式或不安全模式）
    if (!MASTER_KEY) {
        await next();
        return;
    }

    // 从 Authorization 头获取 Master Key
    // 支持格式: "Bearer <key>" 或直接 "<key>"
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
        return c.json({ error: 'Unauthorized: Missing Authorization header' }, 401);
    }

    const clientKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    // 验证 Master Key
    if (clientKey !== MASTER_KEY) {
        return c.json({ error: 'Unauthorized: Invalid Master Key' }, 401);
    }

    await next();
});

// API 路由组 - 基于 workspace 参数
const api = new Hono<{
    Variables: {
        workspace: string;
    };
}>();

// 中间件：验证 workspace 参数
api.use('/:workspace/*', async (c, next) => {
    const workspace = c.req.param('workspace');

    // 防止路径遍历攻击
    if (!workspace || workspace.includes('..') || workspace.includes('/') || workspace.includes('\\')) {
        return c.json({ error: 'Invalid workspace name' }, 400);
    }

    // 设置 workspace 到上下文
    c.set('workspace', `./${workspace}`);
    await next();
});

// 接口：执行远程代码
api.post('/:workspace/execute', async (c) => {
    try {
        const body = await c.req.json();
        const workspace = c.get('workspace');

        // 验证请求参数
        const { code, timeout = 5000, memoryLimit = 50 } = body;

        if (!code || typeof code !== 'string') {
            return c.json({ error: 'Code is required and must be a string' }, 400);
        }

        if (timeout < 100 || timeout > 30000) {
            return c.json({ error: 'Timeout must be between 100ms and 30000ms' }, 400);
        }

        if (memoryLimit < 10 || memoryLimit > 500) {
            return c.json({ error: 'Memory limit must be between 10MB and 500MB' }, 400);
        }

        // 执行代码
        const result = await run_sandbox({
            code,
            workspace,
            timeout,
            memoryLimit,
        });

        return c.json(result);
    } catch (error) {
        console.error('Execute error:', error);
        return c.json({ error: 'Internal server error', details: String(error) }, 500);
    }
});

// 接口：管理工作空间中的文件
api.post('/:workspace/files', async (c) => {
    try {
        const body = await c.req.json();
        const workspacePath = c.get('workspace');
        const { action, filename, content } = body;

        // 验证必需参数
        if (!action) {
            return c.json({ error: 'Action is required' }, 400);
        }

        // 确保工作空间存在
        try {
            await Deno.stat(workspacePath);
        } catch {
            return c.json({ error: 'Workspace does not exist' }, 404);
        }

        const filePath = filename ? `${workspacePath}/${filename.replace(/\.\./g, '')}` : null;

        switch (action) {
            case 'list':
                // 列出工作空间中的文件
                try {
                    const entries = [];
                    for await (const entry of Deno.readDir(workspacePath)) {
                        const entryPath = `${workspacePath}/${entry.name}`;
                        const stat = await Deno.stat(entryPath);
                        entries.push({
                            name: entry.name,
                            isFile: entry.isFile,
                            isDirectory: entry.isDirectory,
                            size: stat.size,
                            modified: stat.mtime,
                        });
                    }
                    return c.json({ files: entries });
                } catch (error) {
                    return c.json({ error: 'Failed to list files', details: String(error) }, 500);
                }

            case 'read':
                // 读取文件内容
                if (!filename || !filePath) {
                    return c.json({ error: 'Filename is required for read action' }, 400);
                }
                try {
                    const fileContent = await Deno.readTextFile(filePath);
                    return c.json({ content: fileContent });
                } catch (error) {
                    return c.json({ error: 'Failed to read file', details: String(error) }, 404);
                }

            case 'create':
                // 创建新文件
                if (!filename || !filePath || content === undefined) {
                    return c.json({ error: 'Filename and content are required for create action' }, 400);
                }
                try {
                    await Deno.writeTextFile(filePath, content);
                    return c.json({ success: true, message: 'File created successfully' });
                } catch (error) {
                    return c.json({ error: 'Failed to create file', details: String(error) }, 500);
                }

            case 'update':
                // 更新现有文件
                if (!filename || !filePath || content === undefined) {
                    return c.json({ error: 'Filename and content are required for update action' }, 400);
                }
                try {
                    // 检查文件是否存在
                    await Deno.stat(filePath);
                    await Deno.writeTextFile(filePath, content);
                    return c.json({ success: true, message: 'File updated successfully' });
                } catch (error) {
                    if (error instanceof Deno.errors.NotFound) {
                        return c.json({ error: 'File does not exist' }, 404);
                    }
                    return c.json({ error: 'Failed to update file', details: String(error) }, 500);
                }

            case 'delete':
                // 删除文件
                if (!filename || !filePath) {
                    return c.json({ error: 'Filename is required for delete action' }, 400);
                }
                try {
                    await Deno.remove(filePath);
                    return c.json({ success: true, message: 'File deleted successfully' });
                } catch (error) {
                    if (error instanceof Deno.errors.NotFound) {
                        return c.json({ error: 'File does not exist' }, 404);
                    }
                    return c.json({ error: 'Failed to delete file', details: String(error) }, 500);
                }

            default:
                return c.json({ error: 'Invalid action. Supported actions: list, read, create, update, delete' }, 400);
        }
    } catch (error) {
        console.error('Workspace files error:', error);
        return c.json({ error: 'Internal server error', details: String(error) }, 500);
    }
});

// 接口：下载工作空间中的文件（流式传输）
api.get('/:workspace/files/download', async (c) => {
    try {
        const workspacePath = c.get('workspace');
        const filename = c.req.query('filename');

        if (!filename) {
            return c.json({ error: 'Filename is required' }, 400);
        }

        // 防止路径遍历
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return c.json({ error: 'Invalid filename' }, 400);
        }

        const filePath = `${workspacePath}/${filename}`;

        // 检查文件是否存在
        try {
            const stat = await Deno.stat(filePath);
            if (!stat.isFile) {
                return c.json({ error: 'Path is not a file' }, 400);
            }
        } catch {
            return c.json({ error: 'File not found' }, 404);
        }

        // 使用 Deno 原生 API 打开文件
        const file = await Deno.open(filePath, { read: true });

        // 设置响应头
        c.header('Content-Type', 'application/octet-stream');
        c.header('Content-Disposition', `attachment; filename="${filename}"`);

        // 使用 Hono 的 stream helper 进行流式传输
        return stream(c, async (stream) => {
            try {
                // 手动读取并写入流，以获得最大控制权和兼容性
                // Deno.FsFile.readable 是 Web 标准 ReadableStream
                // Hono 的 stream 参数是一个 StreamingApi 对象，有 write 方法

                const reader = file.readable.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    await stream.write(value);
                }
            } catch (error) {
                console.error('Stream error:', error);
            } finally {
                // 显式关闭文件资源可能不是必须的，因为 readable 已被消耗
                // 但如果发生错误中断，reader.cancel() 或 file.close() 是好的实践
                try {
                    file.close();
                } catch {
                    // 忽略已关闭的错误
                }
            }
        });
    } catch (error) {
        console.error('Download error:', error);
        return c.json({ error: 'Internal server error', details: String(error) }, 500);
    }
});

// 接口：创建工作空间
api.post('/:workspace/create', async (c) => {
    try {
        const workspacePath = c.get('workspace');

        // 检查工作空间是否已存在
        try {
            await Deno.stat(workspacePath);
            return c.json({ error: 'Workspace already exists' }, 409);
        } catch {
            // 工作空间不存在，这是期望的
        }

        // 创建工作空间
        await Deno.mkdir(workspacePath, { recursive: true });

        return c.json({ success: true, message: 'Workspace created successfully' });
    } catch (error) {
        console.error('Create workspace error:', error);
        return c.json({ error: 'Failed to create workspace', details: String(error) }, 500);
    }
});

// 挂载 API 路由组
app.route('/api', api);

export default app;
