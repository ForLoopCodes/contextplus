// Better Agent MCP - Semantic codebase navigator for AI agents
// Structural AST tree, blast radius, semantic search, commit gatekeeper

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getContextTree } from "./tools/context-tree.js";
import { getFileSkeleton } from "./tools/file-skeleton.js";
import { semanticCodeSearch, invalidateSearchCache } from "./tools/semantic-search.js";
import { getBlastRadius } from "./tools/blast-radius.js";
import { runStaticAnalysis } from "./tools/static-analysis.js";
import { proposeCommit } from "./tools/propose-commit.js";
import { listRestorePoints, restorePoint } from "./git/shadow.js";

const ROOT_DIR = process.cwd();

const server = new McpServer({
  name: "better-agent-mcp",
  version: "1.0.0",
}, {
  capabilities: { logging: {} },
});

server.tool(
  "get_context_tree",
  "Get the structural tree of the project with file headers, function names, classes, enums. " +
  "Automatically reads 2-line headers for file purpose. Dynamic token-aware pruning: " +
  "Level 2 (deep symbols) -> Level 1 (headers only) -> Level 0 (file names only) based on project size.",
  {
    target_path: z.string().optional().describe("Specific directory or file to analyze (relative to project root). Defaults to root."),
    depth_limit: z.number().optional().describe("How many folder levels deep to scan. Use 1-2 for large projects."),
    include_symbols: z.boolean().optional().describe("Include function/class/enum names in the tree. Defaults to true."),
    max_tokens: z.number().optional().describe("Maximum tokens for output. Auto-prunes if exceeded. Default: 20000."),
  },
  async ({ target_path, depth_limit, include_symbols, max_tokens }) => ({
    content: [{
      type: "text" as const,
      text: await getContextTree({
        rootDir: ROOT_DIR,
        targetPath: target_path,
        depthLimit: depth_limit,
        includeSymbols: include_symbols,
        maxTokens: max_tokens,
      }),
    }],
  }),
);

server.tool(
  "get_file_skeleton",
  "Get detailed function signatures, class methods, and type definitions of a specific file WITHOUT reading the full body. " +
  "Shows the API surface: function names, parameters, return types. Perfect for understanding how to use code without loading it all.",
  {
    file_path: z.string().describe("Path to the file to inspect (relative to project root)."),
  },
  async ({ file_path }) => ({
    content: [{
      type: "text" as const,
      text: await getFileSkeleton({ rootDir: ROOT_DIR, filePath: file_path }),
    }],
  }),
);

server.tool(
  "semantic_code_search",
  "Search the codebase by MEANING, not just exact variable names. Uses TF-IDF over file headers and symbol names. " +
  "Example: searching 'user authentication' finds files about login, sessions, JWT even if those exact words aren't used. Zero API calls.",
  {
    query: z.string().describe("Natural language description of what you're looking for. Example: 'how are transactions signed'"),
    top_k: z.number().optional().describe("Number of matches to return. Default: 5."),
  },
  async ({ query, top_k }) => ({
    content: [{
      type: "text" as const,
      text: await semanticCodeSearch({ rootDir: ROOT_DIR, query, topK: top_k }),
    }],
  }),
);

server.tool(
  "get_blast_radius",
  "Before deleting or modifying code, check the BLAST RADIUS. Traces every file and line where a specific symbol " +
  "(function, class, variable) is imported or used. Prevents orphaned code. Also warns if usage count is low (candidate for inlining).",
  {
    symbol_name: z.string().describe("The function, class, or variable name to trace across the codebase."),
    file_context: z.string().optional().describe("The file where the symbol is defined. Excludes the definition line from results."),
  },
  async ({ symbol_name, file_context }) => ({
    content: [{
      type: "text" as const,
      text: await getBlastRadius({ rootDir: ROOT_DIR, symbolName: symbol_name, fileContext: file_context }),
    }],
  }),
);

server.tool(
  "run_static_analysis",
  "Run the project's native linter/compiler to find unused variables, dead code, type errors, and syntax issues. " +
  "Delegates detection to deterministic tools instead of LLM guessing. Supports TypeScript, Python, Rust, Go.",
  {
    target_path: z.string().optional().describe("Specific file or folder to lint (relative to root). Omit for full project."),
  },
  async ({ target_path }) => ({
    content: [{
      type: "text" as const,
      text: await runStaticAnalysis({ rootDir: ROOT_DIR, targetPath: target_path }),
    }],
  }),
);

server.tool(
  "propose_commit",
  "The ONLY way to write code. Validates the code against strict rules before saving: " +
  "2-line header comments, no inline comments, max nesting depth, max file length. " +
  "Creates a shadow restore point before writing. REJECTS code that violates formatting rules.",
  {
    file_path: z.string().describe("Where to save the file (relative to project root)."),
    new_content: z.string().describe("The complete file content to save."),
  },
  async ({ file_path, new_content }) => {
    invalidateSearchCache();
    return {
      content: [{
        type: "text" as const,
        text: await proposeCommit({ rootDir: ROOT_DIR, filePath: file_path, newContent: new_content }),
      }],
    };
  },
);

server.tool(
  "list_restore_points",
  "List all shadow restore points created by propose_commit. Each point captures the file state before the AI made changes. " +
  "Use this to find a restore point ID for undoing a bad change.",
  {},
  async () => {
    const points = await listRestorePoints(ROOT_DIR);
    if (points.length === 0) return { content: [{ type: "text" as const, text: "No restore points found." }] };

    const lines = points.map((p) =>
      `${p.id} | ${new Date(p.timestamp).toISOString()} | ${p.files.join(", ")} | ${p.message}`,
    );
    return { content: [{ type: "text" as const, text: `Restore Points (${points.length}):\n\n${lines.join("\n")}` }] };
  },
);

server.tool(
  "undo_change",
  "Restore files to their state before a specific AI change. Uses the shadow restore point system. " +
  "Does NOT affect git history. Call list_restore_points first to find the point ID.",
  {
    point_id: z.string().describe("The restore point ID (format: rp-timestamp-hash). Get from list_restore_points."),
  },
  async ({ point_id }) => {
    const restored = await restorePoint(ROOT_DIR, point_id);
    invalidateSearchCache();
    return {
      content: [{
        type: "text" as const,
        text: restored.length > 0
          ? `Restored ${restored.length} file(s):\n${restored.join("\n")}`
          : "No files were restored. The backup may be empty.",
      }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Better Agent MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
