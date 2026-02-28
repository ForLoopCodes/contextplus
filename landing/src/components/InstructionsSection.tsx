"use client";

import { useState } from "react";

const INSTRUCTIONS = `# Contextual MCP - Agent Instructions

## Purpose

You are equipped with the Contextual MCP server. It gives you structural awareness of the entire codebase without reading every file. Follow this workflow strictly to conserve context and maximize accuracy.

## Architecture

The MCP server is built with TypeScript and communicates over stdio using the Model Context Protocol SDK. It has three layers:

**Core Layer** (\`src/core/\`):

- \`parser.ts\` — Multi-language symbol extraction via tree-sitter AST with regex fallback. Supports 14+ languages.
- \`tree-sitter.ts\` — WASM grammar loader for 43 file extensions using web-tree-sitter 0.20.8.
- \`walker.ts\` — Gitignore-aware recursive directory traversal with depth and target path control.
- \`embeddings.ts\` — Ollama vector embedding engine with disk cache, cosine similarity search, and API key support.

**Tools Layer** (\`src/tools/\`):

- \`context-tree.ts\` — Token-aware structural tree with Level 0/1/2 pruning.
- \`file-skeleton.ts\` — Function signatures without bodies for quick file understanding.
- \`semantic-search.ts\` — Ollama-powered semantic code search with 60s cache TTL.
- \`semantic-navigate.ts\` — Browse-by-meaning navigator using spectral clustering and Ollama labeling.
- \`blast-radius.ts\` — Symbol usage tracer across the entire codebase.
- \`static-analysis.ts\` — Native linter runner (tsc, eslint, py_compile, cargo check, go vet).
- \`propose-commit.ts\` — Code gatekeeper validating headers, FEATURE tag, no inline comments, nesting, file length.
- \`feature-hub.ts\` — Obsidian-style feature hub navigator with bundled skeleton views.

**Core Layer** (continued):

- \`hub.ts\` — Wikilink parser for \`[[path]]\` links, cross-link tags, hub discovery, orphan detection.

**Git Layer** (\`src/git/\`):

- \`shadow.ts\` — Shadow restore point system for undo without touching git history.

**Entry Point**: \`src/index.ts\` registers 10 MCP tools and starts the stdio transport. Accepts an optional CLI argument for the target project root directory (defaults to \`process.cwd()\`).

## Environment Variables

| Variable             | Default            | Description                       |
| -------------------- | ------------------ | --------------------------------- |
| \`OLLAMA_EMBED_MODEL\` | \`nomic-embed-text\` | Embedding model name              |
| \`OLLAMA_API_KEY\`     | (empty)            | Cloud auth (auto-detected by SDK) |
| \`OLLAMA_CHAT_MODEL\`  | \`llama3.2\`         | Chat model for cluster labeling   |

## The 3-Step Workflow (Mandatory)

### Step 1: PLAN (Use native thinking)

1. Call \`get_context_tree\` to map the project structure with file purposes and symbol names.
2. If the project is large, scope it: \`get_context_tree(target_path="src/auth", depth_limit=2)\`.
3. Use \`get_feature_hub\` to find the feature hub for the area you're working in. Read all linked files at once.
4. Use \`semantic_code_search\` to find files by concept if you don't know where something lives.
5. Use \`get_file_skeleton\` on relevant files to see function signatures without loading bodies.
6. Plan exactly which files need changes and what logic goes where.

### Step 2: WORK (Execute precisely)

1. Read only the specific files you identified in Step 1.
2. Before modifying or deleting any function, call \`get_blast_radius\` to check dependencies.
3. Write code through \`propose_commit\` — it validates your work before saving.
4. If \`propose_commit\` rejects the code, fix the violations and resubmit.

### Step 3: REVIEW (Self-audit)

1. Call \`run_static_analysis\` on changed files to catch unused variables and type errors.
2. Verify the 2-line header exists on every file you created or modified.
3. Verify line 2 includes a \`FEATURE:\` tag linking the file to its feature hub.
4. Update the feature hub \`.md\` file with \`[[path/to/new-file]]\` for any new files.
5. Run \`get_feature_hub(show_orphans=true)\` to ensure no orphaned files.
6. Confirm zero inline comments exist (only the 2-line header at file top).

## Strict Formatting Rules

### File Header (Mandatory)

Every file MUST start with exactly 2 comment lines (10 words each) explaining the file:

\`\`\`
// Regex-based symbol extraction engine for multi-language AST parsing
// FEATURE: Core parsing layer for structural code analysis
\`\`\`

Line 1: What the file does.
Line 2: \`FEATURE: <name>\` — the primary feature it belongs to. Links to hub.

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

- No redundant intermediate variables. Chain calls: \`c = g(f(a))\` instead of \`b = f(a); c = g(b)\`.
- Exception: Keep intermediate variables that represent distinct, meaningful states.
- Remove all unused variables, imports, and files before finishing.

## Tool Reference

| Tool                   | When to Use                                             |
| ---------------------- | ------------------------------------------------------- |
| \`get_context_tree\`     | Start of every task. Map the territory.                 |
| \`semantic_navigate\`    | Browse codebase by meaning, not directory structure.    |
| \`get_file_skeleton\`    | Before reading a full file. See signatures first.       |
| \`semantic_code_search\` | Find code by concept ("auth logic", "fee calculation"). |
| \`get_blast_radius\`     | Before deleting or modifying any symbol.                |
| \`run_static_analysis\`  | After writing code. Catch dead code deterministically.  |
| \`propose_commit\`       | The ONLY way to save files. Validates before writing.   |
| \`list_restore_points\`  | See undo history.                                       |
| \`undo_change\`          | Revert a bad AI change without touching git.            |
| \`get_feature_hub\`      | Browse feature graph hubs. Find orphaned files.         |

## Anti-Patterns to Avoid

1. Reading entire files without checking the skeleton first.
2. Deleting functions without checking blast radius.
3. Creating small helper functions that are only used once.
4. Writing inline comments anywhere in the code.
5. Wrapping simple logic in 10 layers of abstraction or nesting.
6. Leaving unused imports or variables after a refactor.
7. Creating more than 10 files in a single directory.
8. Writing files longer than 1000 lines.`;

export default function InstructionsSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(INSTRUCTIONS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section
      className="instructions-section"
      style={{
        position: "relative",
        zIndex: 1,
        padding: "0px 100px 40px",
        width: "100%",
        maxWidth: 1200,
        marginLeft: "auto",
      }}
    >
      <p
        style={{
          fontSize: 18,
          fontWeight: 300,
          lineHeight: "28px",
          fontFamily: "var(--font-geist-pixel-square)",
          letterSpacing: "-0.02em",
          background: "linear-gradient(180deg, #000000 0%, #666666 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text" as const,
          maxWidth: 630,
          marginLeft: "auto",
          textAlign: "right" as const,
          marginBottom: 40,
        }}
      >
        Copy the instruction file into your project root to teach your agent the
        3-step workflow, strict formatting rules, and anti-patterns that make
        Contextual effective. It enforces file headers
        and clean abstraction.
      </p>

      <div
        style={{
          background: "rgba(0,0,0,0.04)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 24px 0",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 300,
              color: "#888",
              fontFamily: "var(--font-geist-mono)",
            }}
          >
            INSTRUCTIONS.md
          </span>
          <button
            onClick={handleCopy}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              fontSize: 13,
              fontWeight: 300,
              color: copied ? "#000" : "#888",
              fontFamily: "var(--font-geist-mono)",
              transition: "color 0.15s",
            }}
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
        <pre
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: 13,
            fontWeight: 300,
            lineHeight: "20px",
            color: "#333",
            padding: "12px 24px 20px",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
            maxHeight: 400,
          }}
        >
          {INSTRUCTIONS}
        </pre>
      </div>
    </section>
  );
}
