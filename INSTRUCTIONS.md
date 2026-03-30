# Context+ MCP - Agent Instructions

## Purpose

You are equipped with the Context+ MCP server. It gives you structural awareness of the entire codebase without reading every file. Follow this workflow strictly to conserve context and maximize accuracy.

## Architecture

The MCP server is built with TypeScript and communicates over stdio using the Model Context Protocol SDK. It has three layers:

**Core Layer** (`src/core/`):

- `parser.ts` - Multi-language symbol extraction via tree-sitter AST with regex fallback. Supports 14+ languages.
- `tree-sitter.ts` - WASM grammar loader for 43 file extensions using web-tree-sitter 0.20.8.
- `walker.ts` - Gitignore-aware recursive directory traversal with depth and target path control.
- `embeddings.ts` - Ollama/OpenAI-compatible vector embedding engine backed by vector DB persistence.

**Tools Layer** (`src/tools/`):

- `context-tree.ts` - `tree` tool implementation for token-aware structural mapping.
- `file-skeleton.ts` - `skeleton` tool implementation for signatures and type surfaces.
- `search.ts` - Unified `search` tool for file and identifier retrieval.
- `semantic-navigate.ts` - `cluster` tool implementation for spectral semantic grouping.
- `blast-radius.ts` - Symbol usage tracer across the entire codebase.
- `static-analysis.ts` - `lint` runner with project/file skill scoring output.
- `propose-commit.ts` - `checkpoint` tool for validated writes with local restore points.
- `feature-hub.ts` - `find_hub` ranking and full-project hub context fallback.
- `memory-tools.ts` - Memory graph wrappers for create/search/explore/bulk/update/delete flows.
- `init.ts` - Project bootstrap tool for `.contextplus` directories and context snapshot.

The memory graph is a **Retrieval-Augmented Generation (RAG)** system. Agents SHOULD use `search_memory` early in each task to retrieve prior context, and persist learnings with `create_memory` and `create_relation` after completing work. Stale links are pruned automatically before graph access.

**Core Layer** (continued):

- `hub.ts` - Wikilink parser for `[[path]]` links, cross-link tags, hub discovery, orphan detection.
- `memory-graph.ts` - Graph metadata + markdown node files + vector DB-backed semantic retrieval.

**Git Layer** (`src/git/`):

- `shadow.ts` - Shadow restore point system for undo without touching git history.

**Entry Point**: `src/index.ts` registers 18 MCP tools and starts the stdio transport. Accepts an optional CLI argument for the target project root directory (defaults to `process.cwd()`).

## Environment Variables

| Variable                                | Default            | Description                                                   |
| --------------------------------------- | ------------------ | ------------------------------------------------------------- |
| `OLLAMA_EMBED_MODEL`                    | `nomic-embed-text` | Embedding model name                                          |
| `OLLAMA_API_KEY`                        | (empty)            | Cloud auth (auto-detected by SDK)                             |
| `OLLAMA_CHAT_MODEL`                     | `llama3.2`         | Chat model for cluster labeling                               |
| `CONTEXTPLUS_EMBED_BATCH_SIZE`          | `8`                | Embedding batch per GPU call (hard-capped to 5-10)            |
| `CONTEXTPLUS_EMBED_TRACKER`             | `true`             | Enable realtime embedding updates for changed files/functions |
| `CONTEXTPLUS_EMBED_TRACKER_MAX_FILES`   | `8`                | Max changed files per tracker tick (hard-capped to 5-10)      |
| `CONTEXTPLUS_EMBED_TRACKER_DEBOUNCE_MS` | `700`              | Debounce before applying tracker refresh                      |

Runtime storage: `.contextplus/` is created by `init` and stores hubs, memory graph data, and vector DB embeddings. A realtime tracker can refresh changed function/file embeddings incrementally.

## Fast Execute Mode (Mandatory)

Default to execution-first behavior. Use minimal tokens, minimal narration, and maximum tool leverage.

1. Skip long planning prose. Start with lightweight scoping: `tree` and `skeleton`.
2. Run independent discovery operations in parallel whenever possible (for example, multiple searches/reads).
3. Prefer structural tools over full-file reads to conserve context.
4. Before modifying or deleting symbols, run `blast_radius`.
5. Write changes through `checkpoint`.
6. Run `lint` once after edits, or once per changed module for larger refactors.

### Execution Rules

1. Think less, execute sooner: make the smallest safe change that can be validated quickly.
2. Do not serialize 10 independent commands; batch parallelizable reads/searches.
3. If a command fails, avoid blind retry loops. Diagnose once, pivot strategy, continue.
4. Cap retry attempts for the same failing operation to 1-2 unless new evidence appears.
5. Keep outputs concise: short status updates, no verbose reasoning dumps.

### Token-Efficiency Rules

1. Treat 100 effective tokens as better than 1000 vague tokens.
2. Use high-signal tool calls first (`skeleton`, `tree`, `blast_radius`).
3. Read full file bodies only when signatures/structure are insufficient.
4. Avoid repeated scans of unchanged areas.
5. Prefer direct edits + deterministic validation over extended speculative analysis.

## Strict Formatting Rules

### File Header (Mandatory)

Every file MUST start with exactly 2 comment lines (10 words each) explaining the file:

```
// Regex-based symbol extraction engine for multi-language AST parsing
// FEATURE: Core parsing layer for structural code analysis
```

Line 1: What the file does.
Line 2: `FEATURE: <name>` - the primary feature it belongs to. Links to hub.

### Zero Comments

No comments anywhere in the file except the 2-line header. No inline comments, no block comments, no TODO markers.

### Code Ordering

Strict order within every file:

1. Imports
2. Enums
3. Interfaces / Types
4. Constants
5. Functions / Classes

### Abstraction Thresholds

- **Under 20 lines, used once**: INLINE it. Do not extract into a function.
- **Under 20 lines, used multiple times**: Extract into a reusable function.
- **Over 30 lines**: Extract into its own function or file.
- **Max nesting**: 3-4 levels. Flatten deep nesting.
- **Max file length**: 500-1000 lines. Split larger files.
- **Max files per directory**: 10. Use subdirectories for organization.

### Variable Discipline

- No redundant intermediate variables. Chain calls: `c = g(f(a))` instead of `b = f(a); c = g(b)`.
- Exception: Keep intermediate variables that represent distinct, meaningful states.
- Remove all unused variables, imports, and files before finishing.

## Tool Reference

| Tool              | When to Use                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- |
| `init`            | Bootstrap `.contextplus` structure and context snapshot for a project.            |
| `tree`            | Start of every task. Map files + symbols with line ranges.                        |
| `cluster`         | Browse codebase by meaning, not directory structure.                              |
| `skeleton`        | Run before full reads. Get signatures + line ranges first.                        |
| `search`          | Unified semantic/keyword search across files, identifiers, or both.               |
| `blast_radius`    | Before deleting or modifying any symbol.                                           |
| `lint`            | After writing code. Catch dead code and get skill scoring.                        |
| `checkpoint`      | Save file changes with validation and local restore-point creation.                |
| `restore_points`  | See local restore history.                                                         |
| `restore`         | Revert to a specific restore point without touching git history.                   |
| `find_hub`        | Rank hubs by query or list all hub context when query is omitted.                 |
| `create_memory`   | Create/update memory nodes with embedding refresh.                                 |
| `create_relation` | Create typed edges between memory nodes (depends_on, implements, etc).            |
| `search_memory`   | Semantic/keyword memory search with neighborhood traversal.                        |
| `explore_memory`  | Traverse outward from a known memory node id.                                      |
| `bulk_memory`     | Bulk-add nodes and optional auto-linking.                                          |
| `update_memory`   | Update existing memory content and refresh embeddings.                             |
| `delete_memory`   | Delete nodes or relations from the memory graph.                                   |

## Anti-Patterns to Avoid

1. Reading entire files without checking the skeleton first.
2. Deleting functions without checking blast radius.
3. Creating small helper functions that are only used once.
4. Writing inline comments anywhere in the code.
5. Wrapping simple logic in 10 layers of abstraction or nesting.
6. Leaving unused imports or variables after a refactor.
7. Creating more than 10 files in a single directory.
8. Writing files longer than 1000 lines.
9. Running independent commands sequentially when they can be parallelized.
10. Repeating failed terminal commands without changing inputs or approach.

## Priority Reminder

Execute ASAP with the least tokens possible.
Use structural/context tools strategically, then patch and validate.
Avoid over-planning unless the task is ambiguous or high-risk.
