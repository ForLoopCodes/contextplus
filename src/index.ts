#!/usr/bin/env node
// Context+ MCP server with v1 tool names and unified semantics
// FEATURE: MCP entrypoint for discovery analysis checkpoint and memory workflows

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { z } from "zod";
import { createEmbeddingTrackerController } from "./core/embedding-tracker.js";
import { ensureMcpDataDir, cancelAllEmbeddings } from "./core/embeddings.js";
import { formatToolError, formatErrorResponse } from "./core/error-handler.js";
import { getIdleShutdownMs, getParentPollMs, isBrokenPipeError, createIdleMonitor, runCleanup, startParentMonitor } from "./core/process-lifecycle.js";
import { restorePoint, listRestorePoints } from "./git/shadow.js";
import { getBlastRadius } from "./tools/blast-radius.js";
import { getContextTree } from "./tools/context-tree.js";
import { findHub } from "./tools/feature-hub.js";
import { getFileSkeleton } from "./tools/file-skeleton.js";
import { formatInitResult, initProject } from "./tools/init.js";
import {
  toolBulkMemory,
  toolCreateMemory,
  toolCreateRelation,
  toolDeleteMemory,
  toolExploreMemory,
  toolSearchMemory,
  toolUpdateMemory,
} from "./tools/memory-tools.js";
import { checkpoint } from "./tools/propose-commit.js";
import { searchCodebase } from "./tools/search.js";
import { invalidateIdentifierSearchCache } from "./tools/semantic-identifiers.js";
import { semanticNavigate } from "./tools/semantic-navigate.js";
import { invalidateSearchCache } from "./tools/semantic-search.js";
import { runLint } from "./tools/static-analysis.js";
import { getCodeStructure } from "./tools/code-structure.js";
import { research, discoverRelated } from "./tools/research.js";
import { toolImportACP, toolListACPSessions, toolListACPMemories, toolSearchACP } from "./tools/acp-tools.js";

type AgentTarget = "claude" | "cursor" | "vscode" | "windsurf" | "opencode";

const AGENT_CONFIG_PATH: Record<AgentTarget, string> = {
  claude: ".mcp.json",
  cursor: ".cursor/mcp.json",
  vscode: ".vscode/mcp.json",
  windsurf: ".windsurf/mcp.json",
  opencode: "opencode.json",
};

const SUB_COMMANDS = ["init", "skeleton", "tree"];
const passthroughArgs = process.argv.slice(2);
const ROOT_DIR = passthroughArgs[0] && !SUB_COMMANDS.includes(passthroughArgs[0])
  ? resolve(passthroughArgs[0])
  : process.cwd();
const INSTRUCTIONS_SOURCE_URL = "https://contextplus.vercel.app/api/instructions";
const INSTRUCTIONS_RESOURCE_URI = "contextplus://instructions";

let noteServerActivity = () => { };
let ensureTrackerRunning = () => { };

function withRequestActivity<TArgs, TResult>(
  handler: (args: TArgs) => Promise<TResult>,
  options?: { useEmbeddingTracker?: boolean; toolName?: string },
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs): Promise<TResult> => {
    noteServerActivity();
    if (options?.useEmbeddingTracker) ensureTrackerRunning();
    try {
      return await handler(args);
    } catch (error) {
      const toolError = formatToolError(options?.toolName ?? "unknown", error);
      return { content: [{ type: "text" as const, text: formatErrorResponse(toolError) }] } as TResult;
    }
  };
}

function parseAgentTarget(input?: string): AgentTarget {
  const normalized = (input ?? "claude").toLowerCase();
  if (normalized === "claude" || normalized === "claude-code") return "claude";
  if (normalized === "cursor") return "cursor";
  if (normalized === "vscode" || normalized === "vs-code" || normalized === "vs") return "vscode";
  if (normalized === "windsurf") return "windsurf";
  if (normalized === "opencode" || normalized === "open-code") return "opencode";
  throw new Error(`Unsupported coding agent "${input}". Use one of: claude, cursor, vscode, windsurf, opencode.`);
}

function parseRunner(args: string[]): "npx" | "bunx" {
  const explicit = args.find((arg) => arg.startsWith("--runner="));
  if (explicit) {
    const value = explicit.split("=")[1];
    if (value === "npx" || value === "bunx") return value;
    throw new Error(`Unsupported runner "${value}". Use --runner=npx or --runner=bunx.`);
  }
  const runnerFlagIndex = args.findIndex((arg) => arg === "--runner");
  if (runnerFlagIndex >= 0) {
    const value = args[runnerFlagIndex + 1];
    if (value === "npx" || value === "bunx") return value;
    throw new Error(`Unsupported runner "${value}". Use --runner=npx or --runner=bunx.`);
  }
  const userAgent = (process.env.npm_config_user_agent ?? "").toLowerCase();
  const execPath = (process.env.npm_execpath ?? "").toLowerCase();
  if (userAgent.includes("bun/") || execPath.includes("bun")) return "bunx";
  return "npx";
}

function buildMcpConfig(runner: "npx" | "bunx") {
  return JSON.stringify(
    {
      mcpServers: {
        contextplus: {
          command: runner,
          args: runner === "npx" ? ["-y", "contextplus"] : ["contextplus"],
          env: {
            OLLAMA_EMBED_MODEL: "nomic-embed-text",
            OLLAMA_CHAT_MODEL: "gemma2:27b",
            OLLAMA_API_KEY: "YOUR_OLLAMA_API_KEY",
            CONTEXTPLUS_EMBED_BATCH_SIZE: "10",
            CONTEXTPLUS_EMBED_BATCH_CONCURRENCY: "4",
            CONTEXTPLUS_EMBED_CHUNK_CHARS: "8000",
            CONTEXTPLUS_EMBED_TRACKER: "lazy",
          },
        },
      },
    },
    null,
    2,
  );
}

function buildOpenCodeConfig(runner: "npx" | "bunx") {
  return JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      mcp: {
        contextplus: {
          type: "local",
          command: runner === "npx" ? ["npx", "-y", "contextplus"] : ["bunx", "contextplus"],
          enabled: true,
          environment: {
            OLLAMA_EMBED_MODEL: "nomic-embed-text",
            OLLAMA_CHAT_MODEL: "gemma2:27b",
            OLLAMA_API_KEY: "YOUR_OLLAMA_API_KEY",
            CONTEXTPLUS_EMBED_BATCH_SIZE: "10",
            CONTEXTPLUS_EMBED_BATCH_CONCURRENCY: "4",
            CONTEXTPLUS_EMBED_CHUNK_CHARS: "8000",
            CONTEXTPLUS_EMBED_TRACKER: "lazy",
          },
        },
      },
    },
    null,
    2,
  );
}

async function runInitCommand(args: string[]) {
  const nonFlags = args.filter((arg) => !arg.startsWith("--"));
  const target = parseAgentTarget(nonFlags[0]);
  const runner = parseRunner(args);
  const outputPath = resolve(process.cwd(), AGENT_CONFIG_PATH[target]);
  const content = target === "opencode" ? buildOpenCodeConfig(runner) : buildMcpConfig(runner);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${content}\n`, "utf8");
  console.error(`Context+ initialized for ${target} using ${runner}.`);
  console.error(`Wrote MCP config: ${outputPath}`);
}

const server = new McpServer(
  { name: "contextplus", version: "1.0.0" },
  { capabilities: { logging: {} } },
);

server.resource(
  "contextplus_instructions",
  INSTRUCTIONS_RESOURCE_URI,
  withRequestActivity(async (uri) => {
    const response = await fetch(INSTRUCTIONS_SOURCE_URL);
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/markdown",
        text: await response.text(),
      }],
    };
  }),
);

server.tool(
  "tree",
  "Project structural tree with headers and optional symbols.",
  {
    target_path: z.string().optional().describe("Specific directory or file (relative to project root)."),
    depth_limit: z.number().optional().describe("Folder depth to scan."),
    include_symbols: z.boolean().optional().describe("Include symbol names and ranges. Default true."),
    max_tokens: z.number().optional().describe("Output token budget. Default 20000."),
  },
  withRequestActivity(async ({ target_path, depth_limit, include_symbols, max_tokens }) => ({
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
  }), { toolName: "tree" }),
);

server.tool(
  "skeleton",
  "File structure and signatures without full body loading.",
  { file_path: z.string().describe("File path relative to project root.") },
  withRequestActivity(async ({ file_path }) => ({
    content: [{ type: "text" as const, text: await getFileSkeleton({ rootDir: ROOT_DIR, filePath: file_path }) }],
  }), { toolName: "skeleton" }),
);

server.tool(
  "search",
  "Unified search across files and identifiers with semantic, keyword, or hybrid modes.",
  {
    query: z.string().describe("Natural language query."),
    search_type: z.enum(["identifier", "file", "hybrid"]).optional().describe("Search target scope. Default hybrid."),
    mode: z.enum(["semantic", "keyword", "both"]).optional().describe("Ranking mode. Default both."),
    top_k: z.number().optional().describe("Top results count."),
    top_calls_per_identifier: z.number().optional().describe("Top call-sites per identifier for identifier/hybrid search."),
    include_kinds: z.array(z.string()).optional().describe("Optional identifier kinds filter."),
    semantic_weight: z.number().optional().describe("Semantic score weight for both mode."),
    keyword_weight: z.number().optional().describe("Keyword score weight for both mode."),
    min_semantic_score: z.number().optional().describe("Minimum semantic score threshold."),
    min_keyword_score: z.number().optional().describe("Minimum keyword score threshold."),
    min_combined_score: z.number().optional().describe("Minimum total score threshold."),
    require_keyword_match: z.boolean().optional().describe("Require keyword overlap."),
    require_semantic_match: z.boolean().optional().describe("Require semantic score > 0."),
  },
  withRequestActivity(async ({
    query,
    search_type,
    mode,
    top_k,
    top_calls_per_identifier,
    include_kinds,
    semantic_weight,
    keyword_weight,
    min_semantic_score,
    min_keyword_score,
    min_combined_score,
    require_keyword_match,
    require_semantic_match,
  }) => ({
    content: [{
      type: "text" as const,
      text: await searchCodebase({
        rootDir: ROOT_DIR,
        query,
        searchType: search_type,
        mode,
        topK: top_k,
        topCallsPerIdentifier: top_calls_per_identifier,
        includeKinds: include_kinds,
        semanticWeight: semantic_weight,
        keywordWeight: keyword_weight,
        minSemanticScore: min_semantic_score,
        minKeywordScore: min_keyword_score,
        minCombinedScore: min_combined_score,
        requireKeywordMatch: require_keyword_match,
        requireSemanticMatch: require_semantic_match,
      }),
    }],
  }), { useEmbeddingTracker: true, toolName: "search" }),
);

server.tool(
  "cluster",
  "Semantic navigation clusters for project files.",
  {
    max_depth: z.number().optional().describe("Maximum cluster depth."),
    max_clusters: z.number().optional().describe("Maximum clusters per level."),
  },
  withRequestActivity(async ({ max_depth, max_clusters }) => ({
    content: [{
      type: "text" as const,
      text: await semanticNavigate({ rootDir: ROOT_DIR, maxDepth: max_depth, maxClusters: max_clusters }),
    }],
  }), { useEmbeddingTracker: true, toolName: "cluster" }),
);

server.tool(
  "blast_radius",
  "Trace symbol usages across the codebase.",
  {
    symbol_name: z.string().describe("Function, class, or variable name to trace."),
    file_context: z.string().optional().describe("Definition file to exclude the definition line."),
  },
  withRequestActivity(async ({ symbol_name, file_context }) => ({
    content: [{
      type: "text" as const,
      text: await getBlastRadius({ rootDir: ROOT_DIR, symbolName: symbol_name, fileContext: file_context }),
    }],
  }), { toolName: "blast_radius" }),
);

server.tool(
  "lint",
  "Run linting and project skill scoring checks.",
  { target_path: z.string().optional().describe("Optional file/folder path to lint.") },
  withRequestActivity(async ({ target_path }) => ({
    content: [{ type: "text" as const, text: await runLint({ rootDir: ROOT_DIR, targetPath: target_path }) }],
  }), { toolName: "lint" }),
);

server.tool(
  "code_structure",
  "Deep AST analysis showing imports, exports, and call graph for a source file.",
  { file_path: z.string().describe("File path relative to project root.") },
  withRequestActivity(async ({ file_path }) => ({
    content: [{ type: "text" as const, text: await getCodeStructure({ rootDir: ROOT_DIR, filePath: file_path }) }],
  }), { toolName: "code_structure" }),
);

server.tool(
  "checkpoint",
  "Write file after validation and create local restore checkpoint.",
  {
    file_path: z.string().describe("Target file path relative to project root."),
    new_content: z.string().describe("Full replacement file content."),
  },
  withRequestActivity(async ({ file_path, new_content }) => {
    invalidateSearchCache();
    invalidateIdentifierSearchCache();
    return {
      content: [{ type: "text" as const, text: await checkpoint({ rootDir: ROOT_DIR, filePath: file_path, newContent: new_content }) }],
    };
  }, { toolName: "checkpoint" }),
);

server.tool(
  "restore_points",
  "List available local restore checkpoints.",
  {},
  withRequestActivity(async () => {
    const points = await listRestorePoints(ROOT_DIR);
    if (points.length === 0) return { content: [{ type: "text" as const, text: "No restore points found." }] };
    const lines = points.map((entry) => `${entry.id} | ${new Date(entry.timestamp).toISOString()} | ${entry.files.join(", ")} | ${entry.message}`);
    return { content: [{ type: "text" as const, text: `Restore Points (${points.length}):\n\n${lines.join("\n")}` }] };
  }, { toolName: "restore_points" }),
);

server.tool(
  "restore",
  "Restore files from a specific checkpoint.",
  { point_id: z.string().describe("Checkpoint ID from restore_points.") },
  withRequestActivity(async ({ point_id }) => {
    const restored = await restorePoint(ROOT_DIR, point_id);
    invalidateSearchCache();
    invalidateIdentifierSearchCache();
    return {
      content: [{
        type: "text" as const,
        text: restored.length > 0 ? `Restored ${restored.length} file(s):\n${restored.join("\n")}` : "No files restored.",
      }],
    };
  }, { toolName: "restore" }),
);

server.tool(
  "find_hub",
  "Rank or list feature hubs by semantic/keyword/hybrid matching.",
  {
    query: z.string().optional().describe("Search query. If omitted, returns all hubs context."),
    mode: z.enum(["semantic", "keyword", "both"]).optional().describe("Search mode. Default both."),
    top_k: z.number().optional().describe("Top hubs to return. Default 5."),
  },
  withRequestActivity(async ({ query, mode, top_k }) => ({
    content: [{ type: "text" as const, text: await findHub({ rootDir: ROOT_DIR, query, mode, topK: top_k }) }],
  }), { useEmbeddingTracker: true, toolName: "find_hub" }),
);

server.tool(
  "init",
  "Initialize project context tree and .contextplus workspace directories.",
  {
    target_path: z.string().optional().describe("Optional project path relative to current root."),
    skip_embeddings: z.boolean().optional().describe("Skip initial embeddings for faster init. Default false."),
  },
  withRequestActivity(async ({ target_path, skip_embeddings }) => ({
    content: [{
      type: "text" as const,
      text: formatInitResult(await initProject({ rootDir: ROOT_DIR, targetPath: target_path, skipEmbeddings: skip_embeddings })),
    }],
  }), { toolName: "init" }),
);

server.tool(
  "create_memory",
  "Create or update a memory node with automatic embedding updates.",
  {
    type: z.enum(["concept", "file", "symbol", "note"]).describe("Memory node type."),
    label: z.string().describe("Memory node label."),
    content: z.string().describe("Memory content."),
    metadata: z.record(z.string()).optional().describe("Optional metadata map."),
  },
  withRequestActivity(async ({ type, label, content, metadata }) => ({
    content: [{ type: "text" as const, text: await toolCreateMemory({ rootDir: ROOT_DIR, type, label, content, metadata }) }],
  }), { useEmbeddingTracker: true, toolName: "create_memory" }),
);

server.tool(
  "create_relation",
  "Create or update relation edge between memory nodes.",
  {
    source_id: z.string().describe("Source memory node id."),
    target_id: z.string().describe("Target memory node id."),
    relation: z.enum(["relates_to", "depends_on", "implements", "references", "similar_to", "contains"]).describe("Relation type."),
    weight: z.number().optional().describe("Relation weight."),
    metadata: z.record(z.string()).optional().describe("Optional relation metadata."),
  },
  withRequestActivity(async ({ source_id, target_id, relation, weight, metadata }) => ({
    content: [{
      type: "text" as const,
      text: await toolCreateRelation({ rootDir: ROOT_DIR, sourceId: source_id, targetId: target_id, relation, weight, metadata }),
    }],
  }), { toolName: "create_relation" }),
);

server.tool(
  "search_memory",
  "Search memory graph with semantic/keyword modes and graph traversal.",
  {
    query: z.string().describe("Memory search query."),
    mode: z.enum(["semantic", "keyword", "both"]).optional().describe("Search mode. Default both."),
    max_depth: z.number().optional().describe("Traversal depth."),
    top_k: z.number().optional().describe("Top matches count."),
    edge_filter: z.array(z.enum(["relates_to", "depends_on", "implements", "references", "similar_to", "contains"])).optional()
      .describe("Optional relation filter for traversal."),
  },
  withRequestActivity(async ({ query, mode, max_depth, top_k, edge_filter }) => ({
    content: [{
      type: "text" as const,
      text: await toolSearchMemory({
        rootDir: ROOT_DIR,
        query,
        mode,
        maxDepth: max_depth,
        topK: top_k,
        edgeFilter: edge_filter,
      }),
    }],
  }), { useEmbeddingTracker: true, toolName: "search_memory" }),
);

server.tool(
  "explore_memory",
  "Traverse memory graph from a node id.",
  {
    start_node_id: z.string().describe("Starting memory node id."),
    max_depth: z.number().optional().describe("Traversal depth."),
    edge_filter: z.array(z.enum(["relates_to", "depends_on", "implements", "references", "similar_to", "contains"])).optional()
      .describe("Optional relation filter for traversal."),
  },
  withRequestActivity(async ({ start_node_id, max_depth, edge_filter }) => ({
    content: [{
      type: "text" as const,
      text: await toolExploreMemory({ rootDir: ROOT_DIR, startNodeId: start_node_id, maxDepth: max_depth, edgeFilter: edge_filter }),
    }],
  }), { useEmbeddingTracker: true, toolName: "explore_memory" }),
);

server.tool(
  "update_memory",
  "Update existing memory node content and refresh embeddings.",
  {
    node_id: z.string().describe("Memory node id."),
    content: z.string().describe("Updated memory content."),
    metadata: z.record(z.string()).optional().describe("Optional metadata map."),
  },
  withRequestActivity(async ({ node_id, content, metadata }) => ({
    content: [{ type: "text" as const, text: await toolUpdateMemory({ rootDir: ROOT_DIR, nodeId: node_id, content, metadata }) }],
  }), { useEmbeddingTracker: true, toolName: "update_memory" }),
);

server.tool(
  "delete_memory",
  "Delete memory nodes or relations from the graph.",
  {
    node_id: z.string().optional().describe("Node id to delete."),
    edge_id: z.string().optional().describe("Edge id to delete."),
    source_id: z.string().optional().describe("Source id for relation deletion filter."),
    target_id: z.string().optional().describe("Target id for relation deletion filter."),
    relation: z.enum(["relates_to", "depends_on", "implements", "references", "similar_to", "contains"]).optional()
      .describe("Optional relation filter when source/target are provided."),
  },
  withRequestActivity(async ({ node_id, edge_id, source_id, target_id, relation }) => ({
    content: [{
      type: "text" as const,
      text: await toolDeleteMemory({
        rootDir: ROOT_DIR,
        nodeId: node_id,
        edgeId: edge_id,
        sourceId: source_id,
        targetId: target_id,
        relation,
      }),
    }],
  }), { toolName: "delete_memory" }),
);

server.tool(
  "bulk_memory",
  "Bulk create memory nodes and optional similarity links.",
  {
    items: z.array(z.object({
      type: z.enum(["concept", "file", "symbol", "note"]),
      label: z.string(),
      content: z.string(),
      metadata: z.record(z.string()).optional(),
    })).describe("Memory nodes to create or update."),
    auto_link: z.boolean().optional().describe("Whether to auto-create similarity edges. Default true."),
  },
  withRequestActivity(async ({ items, auto_link }) => ({
    content: [{ type: "text" as const, text: await toolBulkMemory({ rootDir: ROOT_DIR, items, autoLink: auto_link }) }],
  }), { useEmbeddingTracker: true, toolName: "bulk_memory" }),
);

server.tool(
  "import_acp",
  "Import agent sessions from external tools (opencode, copilot, claude, codex).",
  {
    file_path: z.string().optional().describe("Path to session JSON file to import."),
    auto_discover: z.boolean().optional().describe("Auto-discover session files in project. Default false."),
  },
  withRequestActivity(async ({ file_path, auto_discover }) => ({
    content: [{ type: "text" as const, text: await toolImportACP({ rootDir: ROOT_DIR, filePath: file_path, autoDiscover: auto_discover }) }],
  }), { toolName: "import_acp" }),
);

server.tool(
  "list_acp_sessions",
  "List imported agent sessions from external tools.",
  { source: z.enum(["opencode", "copilot", "claude", "codex"]).optional().describe("Filter by agent source.") },
  withRequestActivity(async ({ source }) => ({
    content: [{ type: "text" as const, text: await toolListACPSessions({ rootDir: ROOT_DIR, source }) }],
  }), { toolName: "list_acp_sessions" }),
);

server.tool(
  "list_acp_memories",
  "List memory fragments from imported agent sessions.",
  {
    source: z.enum(["opencode", "copilot", "claude", "codex"]).optional().describe("Filter by agent source."),
    type: z.enum(["insight", "decision", "context", "code"]).optional().describe("Filter by memory type."),
  },
  withRequestActivity(async ({ source, type }) => ({
    content: [{ type: "text" as const, text: await toolListACPMemories({ rootDir: ROOT_DIR, source, type }) }],
  }), { toolName: "list_acp_memories" }),
);

server.tool(
  "search_acp",
  "Search across imported agent memories with keyword matching.",
  { query: z.string().describe("Search query for ACP memories.") },
  withRequestActivity(async ({ query }) => ({
    content: [{ type: "text" as const, text: await toolSearchACP({ rootDir: ROOT_DIR, query }) }],
  }), { toolName: "search_acp" }),
);

server.tool(
  "research",
  "Unified search across code, memory, and ACP sources for comprehensive context.",
  {
    query: z.string().describe("Research query."),
    sources: z.array(z.enum(["code", "memory", "acp"])).optional().describe("Sources to search. Default all."),
    top_k: z.number().optional().describe("Top results per source. Default 5."),
  },
  withRequestActivity(async ({ query, sources, top_k }) => ({
    content: [{ type: "text" as const, text: await research({ rootDir: ROOT_DIR, query, sources, topK: top_k }) }],
  }), { useEmbeddingTracker: true, toolName: "research" }),
);

server.tool(
  "discover",
  "Find related files, memories, and context for a specific file.",
  {
    file_path: z.string().describe("File path to find related context for."),
    top_k: z.number().optional().describe("Number of related items. Default 10."),
  },
  withRequestActivity(async ({ file_path, top_k }) => ({
    content: [{ type: "text" as const, text: await discoverRelated({ rootDir: ROOT_DIR, filePath: file_path, topK: top_k }) }],
  }), { useEmbeddingTracker: true, toolName: "discover" }),
);

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "init") {
    await runInitCommand(args.slice(1));
    return;
  }
  if (args[0] === "skeleton" || args[0] === "tree") {
    const targetRoot = args[1] ? resolve(args[1]) : process.cwd();
    const tree = await getContextTree({ rootDir: targetRoot, includeSymbols: true, maxTokens: 50_000 });
    process.stdout.write(`${tree}\n`);
    return;
  }

  await ensureMcpDataDir(ROOT_DIR);
  const trackerController = createEmbeddingTrackerController({
    rootDir: ROOT_DIR,
    mode: process.env.CONTEXTPLUS_EMBED_TRACKER,
    debounceMs: Number.parseInt(process.env.CONTEXTPLUS_EMBED_TRACKER_DEBOUNCE_MS ?? "700", 10),
    maxFilesPerTick: Number.parseInt(process.env.CONTEXTPLUS_EMBED_TRACKER_MAX_FILES ?? "8", 10),
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  let shuttingDown = false;
  let stopParentMonitor = () => { };
  const idleMonitor = createIdleMonitor({
    timeoutMs: getIdleShutdownMs(process.env.CONTEXTPLUS_IDLE_TIMEOUT_MS),
    onIdle: () => requestShutdown("idle-timeout", 0),
    isTransportAlive: () => process.stdin.readable && !process.stdin.destroyed,
  });

  noteServerActivity = idleMonitor.touch;
  ensureTrackerRunning = trackerController.ensureStarted;

  const closeServer = async () => {
    const closable = server as unknown as { close?: () => Promise<void> | void };
    if (typeof closable.close === "function") await closable.close();
  };

  const closeTransport = async () => {
    const closable = transport as unknown as { close?: () => Promise<void> | void };
    if (typeof closable.close === "function") await closable.close();
  };

  const shutdown = async (reason: string, exitCode: number = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`Context+ MCP shutdown requested: ${reason}`);
    await runCleanup({
      cancelEmbeddings: cancelAllEmbeddings,
      stopTracker: trackerController.stop,
      closeServer,
      closeTransport,
      stopMonitors: () => {
        idleMonitor.stop();
        stopParentMonitor();
      },
    });
    process.exit(exitCode);
  };

  const requestShutdown = (reason: string, exitCode: number = 0) => {
    void shutdown(reason, exitCode);
  };

  stopParentMonitor = startParentMonitor({
    parentPid: process.ppid,
    pollIntervalMs: getParentPollMs(process.env.CONTEXTPLUS_PARENT_POLL_MS),
    onParentExit: () => requestShutdown("parent-exit", 0),
  });

  process.once("SIGINT", () => requestShutdown("SIGINT", 0));
  process.once("SIGTERM", () => requestShutdown("SIGTERM", 0));
  process.once("SIGHUP", () => requestShutdown("SIGHUP", 0));
  process.once("disconnect", () => requestShutdown("disconnect", 0));
  process.once("exit", () => {
    idleMonitor.stop();
    stopParentMonitor();
    trackerController.stop();
  });
  process.stdin.once("end", () => requestShutdown("stdin-end", 0));
  process.stdin.once("close", () => requestShutdown("stdin-close", 0));
  process.stdin.once("error", (error) => {
    if (isBrokenPipeError(error)) requestShutdown("stdin-error", 0);
  });
  process.stdout.once("error", (error) => {
    if (isBrokenPipeError(error)) requestShutdown("stdout-error", 0);
  });
  process.stderr.once("error", (error) => {
    if (isBrokenPipeError(error)) requestShutdown("stderr-error", 0);
  });

  noteServerActivity();
  console.error(`Context+ MCP server running on stdio | root: ${ROOT_DIR}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
