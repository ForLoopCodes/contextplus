# Context+

Semantic Intelligence for Large-Scale Engineering.

Context+ is an MCP server designed for developers who demand 99% accuracy. By combining Tree-sitter AST parsing, Spectral Clustering, and Obsidian-style linking, Context+ turns a massive codebase into a searchable, hierarchical feature graph.

## Tools

### Discovery

| Tool                   | Description                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_context_tree`     | Structural AST tree of a project with file headers, function names, classes, and enums. Dynamic token-aware pruning shrinks output automatically. |
| `get_file_skeleton`    | Function signatures, class methods, and type definitions without reading the full body. Shows the API surface.                                    |
| `semantic_code_search` | Search the codebase by meaning, not exact text. Uses Ollama embeddings over file headers and symbol names.                                        |
| `semantic_navigate`    | Browse codebase by meaning using spectral clustering. Groups semantically related files into labeled clusters.                                    |

### Analysis

| Tool                  | Description                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `get_blast_radius`    | Trace every file and line where a symbol is imported or used. Prevents orphaned references.                                   |
| `run_static_analysis` | Run native linters and compilers to find unused variables, dead code, and type errors. Supports TypeScript, Python, Rust, Go. |

### Code Ops

| Tool              | Description                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `propose_commit`  | The only way to write code. Validates against strict rules before saving. Creates a shadow restore point before writing. |
| `get_feature_hub` | Obsidian-style feature hub navigator. Hubs are `.md` files with `[[wikilinks]]` that map features to code files.         |

### Version Control

| Tool                  | Description                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `list_restore_points` | List all shadow restore points created by `propose_commit`. Each captures file state before AI changes.    |
| `undo_change`         | Restore files to their state before a specific AI change. Uses shadow restore points. Does not affect git. |

## Setup

### Quick Start (npx / bunx)

No installation needed. Add to your IDE's MCP config:

```json
{
  "mcpServers": {
    "contextplus": {
      "command": "npx",
      "args": ["-y", "contextplus"],
      "env": {
        "OLLAMA_EMBED_MODEL": "nomic-embed-text",
        "OLLAMA_CHAT_MODEL": "gemma2:27b",
        "OLLAMA_API_KEY": "YOUR_OLLAMA_API_KEY"
      }
    }
  }
}
```

Or generate the MCP config file directly in your current directory:

```bash
npx -y contextplus init claude
bunx contextplus init cursor
```

Supported coding agent names: `claude`, `cursor`, `vscode`, `windsurf`.

Config file locations:

| IDE         | Config File          |
| ----------- | -------------------- |
| Claude Code | `.mcp.json`          |
| Cursor      | `.cursor/mcp.json`   |
| VS Code     | `.vscode/mcp.json`   |
| Windsurf    | `.windsurf/mcp.json` |

### From Source

```bash
npm install
npm run build
```

```bash
node build/index.js                      # analyze current directory
node build/index.js /path/to/my-project  # analyze a specific project
```

## Architecture

Three layers built with TypeScript over stdio using the Model Context Protocol SDK:

**Core** (`src/core/`) — Multi-language AST parsing (tree-sitter, 43 extensions), gitignore-aware traversal, Ollama vector embeddings with disk cache, wikilink hub graph.

**Tools** (`src/tools/`) — 10 MCP tools exposing structural, semantic, and operational capabilities.

**Git** (`src/git/`) — Shadow restore point system for undo without touching git history.

## Config

| Variable             | Default            | Description                     |
| -------------------- | ------------------ | ------------------------------- |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embedding model                 |
| `OLLAMA_API_KEY`     | —                  | Ollama Cloud API key            |
| `OLLAMA_CHAT_MODEL`  | `llama3.2`         | Chat model for cluster labeling |

## Test

```bash
npm test
npm run test:demo
npm run test:all
```
