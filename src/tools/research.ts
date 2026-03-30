// Unified research tool combining code, memory, and ACP search
// Aggregates results from all context sources for comprehensive queries

import { searchCodebase } from "./search.js";
import { toolSearchMemory } from "./memory-tools.js";
import { toolSearchACP } from "./acp-tools.js";

interface ResearchResult {
  source: "code" | "memory" | "acp";
  summary: string;
  score?: number;
}

export async function research(opts: {
  rootDir: string;
  query: string;
  sources?: ("code" | "memory" | "acp")[];
  topK?: number;
}): Promise<string> {
  const sources = opts.sources ?? ["code", "memory", "acp"];
  const topK = opts.topK ?? 5;
  const results: ResearchResult[] = [];

  const tasks: Promise<void>[] = [];

  if (sources.includes("code")) {
    tasks.push(
      searchCodebase({
        rootDir: opts.rootDir,
        query: opts.query,
        mode: "both",
        topK,
      }).then(text => {
        results.push({ source: "code", summary: text });
      }).catch(() => {
        results.push({ source: "code", summary: "Code search unavailable" });
      })
    );
  }

  if (sources.includes("memory")) {
    tasks.push(
      toolSearchMemory({
        rootDir: opts.rootDir,
        query: opts.query,
        mode: "both",
        topK,
      }).then(text => {
        results.push({ source: "memory", summary: text });
      }).catch(() => {
        results.push({ source: "memory", summary: "Memory search unavailable" });
      })
    );
  }

  if (sources.includes("acp")) {
    tasks.push(
      toolSearchACP({
        rootDir: opts.rootDir,
        query: opts.query,
      }).then(text => {
        results.push({ source: "acp", summary: text });
      }).catch(() => {
        results.push({ source: "acp", summary: "ACP search unavailable" });
      })
    );
  }

  await Promise.all(tasks);

  const lines: string[] = [
    `# Research Results: "${opts.query}"`,
    `Sources: ${sources.join(", ")} | Top K: ${topK}`,
    "",
  ];

  for (const r of results) {
    lines.push(`## ${r.source.toUpperCase()}`);
    lines.push(r.summary);
    lines.push("");
  }

  return lines.join("\n");
}

export async function discoverRelated(opts: {
  rootDir: string;
  filePath: string;
  topK?: number;
}): Promise<string> {
  const topK = opts.topK ?? 10;

  const codeResults = await searchCodebase({
    rootDir: opts.rootDir,
    query: `files related to ${opts.filePath}`,
    searchType: "file",
    mode: "both",
    topK,
  });

  const memoryResults = await toolSearchMemory({
    rootDir: opts.rootDir,
    query: opts.filePath,
    mode: "both",
    topK: 5,
  });

  return [
    `# Related Context: ${opts.filePath}`,
    "",
    "## Related Files",
    codeResults,
    "",
    "## Related Memories",
    memoryResults,
  ].join("\n");
}
