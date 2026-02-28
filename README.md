# contextplus

MCP server for semantic codebase navigation. Gives AI agents structural awareness without reading every file.

## Tools

- `get_context_tree` — Map project structure with file headers and symbols
- `get_file_skeleton` — See function signatures without bodies
- `semantic_code_search` — Find code by concept using Ollama embeddings
- `semantic_navigate` — Browse codebase by meaning using spectral clustering
- `get_blast_radius` — Trace symbol usage across the codebase
- `run_static_analysis` — Run native linters (tsc, eslint, py_compile, cargo, go vet)
- `propose_commit` — Validate and save files with formatting rules
- `list_restore_points` — View undo history
- `undo_change` — Revert changes without touching git
- `get_feature_hub` — Obsidian-style feature graph with wikilink hubs

## Setup

```bash
npm install
npm run build
```

## Usage

By default, contextplus analyzes the directory it's launched from (`process.cwd()`).
To point it at a different project, pass the path as the first argument:

```bash
# Analyze current directory
node build/index.js

# Analyze a specific project
node build/index.js /path/to/my-project

# In MCP config (Claude Desktop / VS Code)
{
  "contextplus": {
    "command": "node",
    "args": ["/path/to/contextplus/build/index.js", "/path/to/target-project"]
  }
}
```

## Config

| Env Var              | Default            | Purpose                           |
| -------------------- | ------------------ | --------------------------------- |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | Embedding model                   |
| `OLLAMA_API_KEY`     | —                  | Cloud auth (auto-detected by SDK) |
| `OLLAMA_CHAT_MODEL`  | `llama3.2`         | Cluster labeling                  |

## Test

```bash
npm test
npm run test:demo
npm run test:all
```
