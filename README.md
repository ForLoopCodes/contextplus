# Context+

Semantic Intelligence for Large-Scale Engineering.

Context+ is an MCP server designed for developers who demand 99% accuracy. By combining RAG, Tree-sitter AST, Spectral Clustering, and Obsidian-style linking, Context+ turns a massive codebase into a searchable, hierarchical feature graph.

https://github.com/user-attachments/assets/a97a451f-c9b4-468d-b036-15b65fc13e79

## Tools

### Discovery

| Tool       | Description                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tree`     | Structural AST tree of a project with file headers and symbol ranges (line numbers for functions/classes/methods). Dynamic pruning shrinks output automatically. |
| `skeleton` | Function signatures, class methods, and type definitions with line ranges, without reading full bodies. Shows the API surface.                                   |
| `search`   | Unified search for file-level and identifier-level retrieval with semantic, keyword, or hybrid modes.                                                            |
| `cluster`  | Browse codebase by meaning using spectral clustering. Groups semantically related files into labeled clusters.                                                   |

### Analysis

| Tool           | Description                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `blast_radius` | Trace every file and line where a symbol is imported or used. Prevents orphaned references.                       |
| `lint`         | Run native linters/compilers and project skill checks to find errors, dead code, and instruction-rule violations. |

### Code Ops

| Tool         | Description                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `checkpoint` | Write code after validation and create a local restore point before saving.                                            |
| `find_hub`   | Query-ranked feature hub search with semantic/keyword/both modes; without query it returns all hub context in project. |
| `init`       | Initialize `.contextplus` workspace with hubs, embeddings, config, and memories structure plus context tree snapshot.  |

### Version Control

| Tool             | Description                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `restore_points` | List all local restore points created by `checkpoint`.                                       |
| `restore`        | Restore files to their state at a specific local restore point. Does not affect git history. |

### Memory & RAG

| Tool              | Description                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `create_memory`   | Create or update a memory node (concept, file, symbol, note) with auto-generated embeddings.             |
| `update_memory`   | Update memory node content and refresh embeddings.                                                       |
| `delete_memory`   | Delete memory nodes or relation edges.                                                                   |
| `create_relation` | Create typed edges between nodes (relates_to, depends_on, implements, references, similar_to, contains). |
| `search_memory`   | Semantic/keyword search with graph traversal — finds direct matches then walks neighbors.                |
| `explore_memory`  | Start from a node and walk outward — returns reachable neighbors scored by decay and depth.              |
| `bulk_memory`     | Bulk-add nodes with optional auto-similarity linking.                                                    |

## Setup

### Quick Start (npx / bunx)

No installation needed. Add Context+ to your IDE MCP config.

For Claude Code, Cursor, and Windsurf, use `mcpServers`:

```json
{
  "mcpServers": {
    "contextplus": {
      "command": "bunx",
      "args": ["contextplus"],
      "env": {
        "OLLAMA_EMBED_MODEL": "nomic-embed-text",
        "OLLAMA_CHAT_MODEL": "gemma2:27b",
        "OLLAMA_API_KEY": "YOUR_OLLAMA_API_KEY"
      }
    }
  }
}
```

For VS Code (`.vscode/mcp.json`), use `servers` and `inputs`:

```json
{
  "servers": {
    "contextplus": {
      "type": "stdio",
      "command": "bunx",
      "args": ["contextplus"],
      "env": {
        "OLLAMA_EMBED_MODEL": "nomic-embed-text",
        "OLLAMA_CHAT_MODEL": "gemma2:27b",
        "OLLAMA_API_KEY": "YOUR_OLLAMA_API_KEY"
      }
    }
  },
  "inputs": []
}
```

If you prefer `npx`, use:

- `"command": "npx"`
- `"args": ["-y", "contextplus"]`

Or generate the MCP config file directly in your current directory:

```bash
npx -y contextplus init claude
bunx contextplus init cursor
npx -y contextplus init opencode
```

Supported coding agent names: `claude`, `cursor`, `vscode`, `windsurf`, `opencode`.

Config file locations:

| IDE         | Config File          |
| ----------- | -------------------- |
| Claude Code | `.mcp.json`          |
| Cursor      | `.cursor/mcp.json`   |
| VS Code     | `.vscode/mcp.json`   |
| Windsurf    | `.windsurf/mcp.json` |
| OpenCode    | `opencode.json`      |

### CLI Subcommands

- `init [target]` - Generate MCP configuration (targets: `claude`, `cursor`, `vscode`, `windsurf`, `opencode`).
- `skeleton [path]` or `tree [path]` - **(New)** View the structural tree of a project with file headers and symbol definitions directly in your terminal.
- `[path]` - Start the MCP server (stdio) for the specified path (defaults to current directory).

### From Source

```bash
npm install
npm run build
```

## Embedding Providers

Context+ supports two embedding backends controlled by `CONTEXTPLUS_EMBED_PROVIDER`:

| Provider              | Value    | Requires            | Best For                               |
| --------------------- | -------- | ------------------- | -------------------------------------- |
| **Ollama** (default)  | `ollama` | Local Ollama server | Free, offline, private                 |
| **OpenAI-compatible** | `openai` | API key             | Gemini (free tier), OpenAI, Groq, vLLM |

### Ollama (Default)

No extra configuration needed. Just run Ollama with an embedding model:

```bash
ollama pull nomic-embed-text
ollama serve
```

### Google Gemini (Free Tier)

Full Claude Code `.mcp.json` example:

```json
{
  "mcpServers": {
    "contextplus": {
      "command": "npx",
      "args": ["-y", "contextplus"],
      "env": {
        "CONTEXTPLUS_EMBED_PROVIDER": "openai",
        "CONTEXTPLUS_OPENAI_API_KEY": "YOUR_GEMINI_API_KEY",
        "CONTEXTPLUS_OPENAI_BASE_URL": "https://generativelanguage.googleapis.com/v1beta/openai",
        "CONTEXTPLUS_OPENAI_EMBED_MODEL": "text-embedding-004"
      }
    }
  }
}
```

Get a free API key at [Google AI Studio](https://aistudio.google.com/apikey).

### OpenAI

```json
{
  "mcpServers": {
    "contextplus": {
      "command": "npx",
      "args": ["-y", "contextplus"],
      "env": {
        "CONTEXTPLUS_EMBED_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-...",
        "OPENAI_EMBED_MODEL": "text-embedding-3-small"
      }
    }
  }
}
```

### Other OpenAI-compatible APIs (Groq, vLLM, LiteLLM)

Any endpoint implementing the [OpenAI Embeddings API](https://platform.openai.com/docs/api-reference/embeddings) works:

```json
{
  "mcpServers": {
    "contextplus": {
      "command": "npx",
      "args": ["-y", "contextplus"],
      "env": {
        "CONTEXTPLUS_EMBED_PROVIDER": "openai",
        "CONTEXTPLUS_OPENAI_API_KEY": "YOUR_KEY",
        "CONTEXTPLUS_OPENAI_BASE_URL": "https://your-proxy.example.com/v1",
        "CONTEXTPLUS_OPENAI_EMBED_MODEL": "your-model-name"
      }
    }
  }
}
```

> **Note:** The `cluster` tool uses a chat model for cluster labeling. When using the `openai` provider, set `CONTEXTPLUS_OPENAI_CHAT_MODEL` (default: `gpt-4o-mini`).
>
> For VS Code, Cursor, or OpenCode, use the same `env` block inside your IDE's MCP config format (see [Config file locations](#setup) table above).

## Architecture

Three layers built with TypeScript over stdio using the Model Context Protocol SDK:

**Core** (`src/core/`) - Multi-language AST parsing (tree-sitter, 43 extensions), gitignore-aware traversal, vector DB-backed embeddings, wikilink hub graph, and markdown-backed memory graph with traversal scoring.

**Tools** (`src/tools/`) - 18 MCP tools exposing structural, semantic, operational, and memory graph capabilities.

**Git** (`src/git/`) - Shadow restore point system for undo without touching git history.

**Runtime Workspace** (`.contextplus/`) - initialized by `init`; stores hubs, embeddings database, config snapshots, and memory graph files. A realtime tracker refreshes changed files/functions incrementally.

## Config

| Variable                                | Type                       | Default                     | Description                                                            |
| --------------------------------------- | -------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| `CONTEXTPLUS_EMBED_PROVIDER`            | string                     | `ollama`                    | Embedding backend: `ollama` or `openai`                                |
| `OLLAMA_EMBED_MODEL`                    | string                     | `nomic-embed-text`          | Ollama embedding model                                                 |
| `OLLAMA_API_KEY`                        | string                     | -                           | Ollama Cloud API key                                                   |
| `OLLAMA_CHAT_MODEL`                     | string                     | `llama3.2`                  | Ollama chat model for cluster labeling                                 |
| `CONTEXTPLUS_OPENAI_API_KEY`            | string                     | -                           | API key for OpenAI-compatible provider (alias: `OPENAI_API_KEY`)       |
| `CONTEXTPLUS_OPENAI_BASE_URL`           | string                     | `https://api.openai.com/v1` | OpenAI-compatible endpoint URL (alias: `OPENAI_BASE_URL`)              |
| `CONTEXTPLUS_OPENAI_EMBED_MODEL`        | string                     | `text-embedding-3-small`    | OpenAI-compatible embedding model (alias: `OPENAI_EMBED_MODEL`)        |
| `CONTEXTPLUS_OPENAI_CHAT_MODEL`         | string                     | `gpt-4o-mini`               | OpenAI-compatible chat model for labeling (alias: `OPENAI_CHAT_MODEL`) |
| `CONTEXTPLUS_EMBED_BATCH_SIZE`          | string (parsed as number)  | `8`                         | Embedding batch size per GPU call, clamped to 5-10                     |
| `CONTEXTPLUS_EMBED_BATCH_CONCURRENCY`   | string (parsed as number)  | `1`                         | Number of embedding batches processed concurrently, clamped to 1-8     |
| `CONTEXTPLUS_EMBED_CHUNK_CHARS`         | string (parsed as number)  | `2000`                      | Per-chunk chars before merge, clamped to 256-8000                      |
| `CONTEXTPLUS_MAX_EMBED_FILE_SIZE`       | string (parsed as number)  | `51200`                     | Skip non-code text files larger than this many bytes                   |
| `CONTEXTPLUS_EMBED_NUM_GPU`             | string (parsed as number)  | -                           | Optional Ollama embed runtime `num_gpu` override                       |
| `CONTEXTPLUS_EMBED_MAIN_GPU`            | string (parsed as number)  | -                           | Optional Ollama embed runtime `main_gpu` override                      |
| `CONTEXTPLUS_EMBED_NUM_THREAD`          | string (parsed as number)  | -                           | Optional Ollama embed runtime `num_thread` override                    |
| `CONTEXTPLUS_EMBED_NUM_BATCH`           | string (parsed as number)  | -                           | Optional Ollama embed runtime `num_batch` override                     |
| `CONTEXTPLUS_EMBED_NUM_CTX`             | string (parsed as number)  | -                           | Optional Ollama embed runtime `num_ctx` override                       |
| `CONTEXTPLUS_EMBED_LOW_VRAM`            | string (parsed as boolean) | -                           | Optional Ollama embed runtime `low_vram` override                      |
| `CONTEXTPLUS_EMBED_TRACKER`             | string (parsed as boolean) | `true`                      | Enable realtime embedding refresh on file changes                      |
| `CONTEXTPLUS_EMBED_TRACKER_MAX_FILES`   | string (parsed as number)  | `8`                         | Max changed files processed per tracker tick, clamped to 5-10          |
| `CONTEXTPLUS_EMBED_TRACKER_DEBOUNCE_MS` | string (parsed as number)  | `700`                       | Debounce window before tracker refresh                                 |

## Test

```bash
npm test
npm run test:demo
npm run test:all
```
