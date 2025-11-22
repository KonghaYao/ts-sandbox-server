# TS Sandbox Server

A secure, high-performance TypeScript/JavaScript execution sandbox server **designed for Large Language Models (LLMs)**.
Built with Deno, Bun, and Hono.

This server provides a safe environment for LLM-generated code execution, enabling AI agents to run calculations, data
processing, and logic verification without risking the host system.

## Features

-   🤖 **LLM-Ready**: Specifically optimized for executing AI-generated code snippets.
-   🔒 **Secure Execution**: Runs code in a restricted environment with customizable permissions.
-   🔑 **Access Control**: Built-in Master Key authentication protection.
-   ⏱️ **Resource Control**: Configurable timeouts and memory limits.
-   📦 **Workspace Management**: Isolated workspaces for file operations.
-   🚀 **High Performance**: Built on Deno and Hono for minimal latency.
-   🐳 **Docker Ready**: Production-ready Docker configuration.
-   🛠️ **File System API**: Full CRUD operations for files within the sandbox workspace.

## Architecture

-   **Runtime**: Deno (for secure execution)
-   **Build System**: Bun (for fast compilation)
-   **Web Framework**: Hono (for lightweight HTTP handling)

## Quick Start

### Using Docker (Recommended)

```bash
# Build the image
docker build -t ts-sandbox-server .

# Run the container
docker run -p 8000:8000 -e MASTER_KEY=your-secret-key ts-sandbox-server
```

### Local Development

Prerequisites:

-   [Deno](https://deno.com/) 2.x
-   [Bun](https://bun.sh/) 1.x

```bash
# Install dependencies
bun install

# Run in development mode
MASTER_KEY=dev-secret deno task dev

# Build for production
bun run build
MASTER_KEY=prod-secret deno run --allow-all --unstable-sloppy-imports dist/main.js
```

## API Usage

The server exposes a RESTful API for managing workspaces and executing code.

All requests must include the `Authorization` header if `MASTER_KEY` is set.

### 1. Create a Workspace

```http
POST /api/my_workspace/create
Authorization: Bearer your-secret-key
```

### 2. Execute Code

```http
POST /api/my_workspace/execute
Content-Type: application/json
Authorization: Bearer your-secret-key

{
  "code": "console.log('Hello from sandbox!');",
  "timeout": 5000,
  "memoryLimit": 50
}
```

### 3. Manage Files

```http
POST /api/my_workspace/files
Content-Type: application/json

{
  "action": "create",
  "filename": "data.json",
  "content": "{\"key\": \"value\"}"
}
```

For detailed API documentation, see [docs/api.md](docs/api.md).

## Security

The sandbox enforces strict security policies:

-   **Network Access**: Blocked by default.
-   **File System**: Restricted to the specific workspace directory only.
-   **Environment**: No access to environment variables.
-   **Process**: No access to spawn child processes.

## License

Apache-2.0
