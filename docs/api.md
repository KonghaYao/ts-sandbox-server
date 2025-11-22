# API Documentation

The TS Sandbox Server provides a RESTful API to manage isolated workspaces and execute TypeScript/JavaScript code
securely.

## Base URL

All API endpoints follow the pattern: `/api/:workspace/:action`

Where `:workspace` is the unique identifier for your sandbox environment.

---

## Authentication

Secure access using the `MASTER_KEY` environment variable.

-   **Environment Variable**: `MASTER_KEY=your-secret-key`
-   **Header**: `Authorization: Bearer your-secret-key` (or just `Authorization: your-secret-key`)

If `MASTER_KEY` is set on the server, all API requests MUST include the `Authorization` header.

---

## Endpoints

### 1. Create Workspace

Initialize a new isolated workspace directory.

-   **URL**: `/api/:workspace/create`
-   **Method**: `POST`
-   **URL Parameters**:
    -   `workspace` (string): Name of the workspace (alphanumeric, no path separators).

#### Response

```json
{
    "success": true,
    "message": "Workspace created successfully"
}
```

#### Errors

-   `409 Conflict`: Workspace already exists.
-   `400 Bad Request`: Invalid workspace name.

---

### 2. Execute Code

Run TypeScript/JavaScript code within the context of the workspace.

-   **URL**: `/api/:workspace/execute`
-   **Method**: `POST`
-   **Headers**: `Content-Type: application/json`

#### Request Body

| Field         | Type   | Required | Default | Description                                    |
| ------------- | ------ | -------- | ------- | ---------------------------------------------- |
| `code`        | string | Yes      | -       | The TS/JS code to execute.                     |
| `timeout`     | number | No       | 5000    | Execution timeout in milliseconds (100-30000). |
| `memoryLimit` | number | No       | 50      | Memory limit in MB (10-500).                   |

#### Example Request

```json
{
    "code": "console.log('Hello World');",
    "timeout": 2000
}
```

#### Response

```json
{
    "success": true,
    "stdout": "Hello World\n",
    "stderr": "",
    "timedOut": false
}
```

---

### 3. File Management

Perform CRUD operations on files within the workspace.

-   **URL**: `/api/:workspace/files`
-   **Method**: `POST`
-   **Headers**: `Content-Type: application/json`

#### Request Body

| Field      | Type   | Required | Description                                           |
| ---------- | ------ | -------- | ----------------------------------------------------- |
| `action`   | string | Yes      | One of: `list`, `read`, `create`, `update`, `delete`. |
| `filename` | string | varies   | Required for `read`, `create`, `update`, `delete`.    |
| `content`  | string | varies   | Required for `create`, `update`.                      |

#### Actions

##### `list`

List all files in the workspace.

```json
{ "action": "list" }
```

**Response**:

```json
{
    "files": [
        {
            "name": "script.ts",
            "isFile": true,
            "isDirectory": false,
            "size": 1024,
            "modified": "2023-10-27T10:00:00.000Z"
        }
    ]
}
```

##### `create`

Create a new file.

```json
{
    "action": "create",
    "filename": "config.json",
    "content": "{ \"debug\": true }"
}
```

##### `read`

Read file content.

```json
{
    "action": "read",
    "filename": "config.json"
}
```

**Response**:

```json
{ "content": "{ \"debug\": true }" }
```

##### `update`

Update an existing file.

```json
{
    "action": "update",
    "filename": "config.json",
    "content": "{ \"debug\": false }"
}
```

##### `delete`

Delete a file.

```json
{
    "action": "delete",
    "filename": "config.json"
}
```

---

## Error Handling

All endpoints return standard HTTP error codes:

-   `200 OK`: Success.
-   `400 Bad Request`: Invalid parameters or missing fields.
-   `404 Not Found`: Workspace or file not found.
-   `500 Internal Server Error`: Server-side processing error.

**Error Response Format**:

```json
{
    "error": "Error description",
    "details": "Optional technical details"
}
```
