# Better Agent MCP - Agent Instructions

## Purpose

You are equipped with the Better Agent MCP server. It gives you structural awareness of the entire codebase without reading every file. Follow this workflow strictly to conserve context and maximize accuracy.

## The 3-Step Workflow (Mandatory)

### Step 1: PLAN (Use native thinking)

1. Call `get_context_tree` to map the project structure with file purposes and symbol names.
2. If the project is large, scope it: `get_context_tree(target_path="src/auth", depth_limit=2)`.
3. Use `semantic_code_search` to find files by concept if you don't know where something lives.
4. Use `get_file_skeleton` on relevant files to see function signatures without loading bodies.
5. Plan exactly which files need changes and what logic goes where.

### Step 2: WORK (Execute precisely)

1. Read only the specific files you identified in Step 1.
2. Before modifying or deleting any function, call `get_blast_radius` to check dependencies.
3. Write code through `propose_commit` — it validates your work before saving.
4. If `propose_commit` rejects the code, fix the violations and resubmit.

### Step 3: REVIEW (Self-audit)

1. Call `run_static_analysis` on changed files to catch unused variables and type errors.
2. Verify the 2-line header exists on every file you created or modified.
3. Confirm zero inline comments exist (only the 2-line header at file top).

## Strict Formatting Rules

### File Header (Mandatory)

Every file MUST start with exactly 2 comment lines (10 words each) explaining the file:

```
// Regex-based symbol extraction engine for multi-language AST parsing
// Extracts functions, classes, enums, interfaces, structs from source files
```

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

| Tool                   | When to Use                                             |
| ---------------------- | ------------------------------------------------------- |
| `get_context_tree`     | Start of every task. Map the territory.                 |
| `get_file_skeleton`    | Before reading a full file. See signatures first.       |
| `semantic_code_search` | Find code by concept ("auth logic", "fee calculation"). |
| `get_blast_radius`     | Before deleting or modifying any symbol.                |
| `run_static_analysis`  | After writing code. Catch dead code deterministically.  |
| `propose_commit`       | The ONLY way to save files. Validates before writing.   |
| `list_restore_points`  | See undo history.                                       |
| `undo_change`          | Revert a bad AI change without touching git.            |

## Anti-Patterns to Avoid

1. Reading entire files without checking the skeleton first.
2. Deleting functions without checking blast radius.
3. Creating small helper functions that are only used once.
4. Writing inline comments anywhere in the code.
5. Wrapping simple logic in 10 layers of abstraction or nesting.
6. Leaving unused imports or variables after a refactor.
7. Creating more than 10 files in a single directory.
8. Writing files longer than 1000 lines.
