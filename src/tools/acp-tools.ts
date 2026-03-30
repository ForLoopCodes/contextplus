// ACP tools wrapper for MCP server integration
// Provides import, list, and search functions for external agent memories

import { importSessionFile, listSessions, listMemories, searchACPMemories, discoverSessionFiles, type ACPSession, type ACPMemory } from "../core/acp.js";

export interface ImportACPOptions {
  rootDir: string;
  filePath?: string;
  autoDiscover?: boolean;
}

export async function toolImportACP(options: ImportACPOptions): Promise<string> {
  const { rootDir, filePath, autoDiscover } = options;
  let imported = { sessions: 0, memories: 0 };

  if (filePath) {
    imported = await importSessionFile(rootDir, filePath);
  } else if (autoDiscover) {
    const files = await discoverSessionFiles(rootDir);
    for (const f of files) {
      const result = await importSessionFile(rootDir, f);
      imported.sessions += result.sessions;
      imported.memories += result.memories;
    }
  }

  if (imported.sessions === 0 && imported.memories === 0) {
    return "No sessions found to import. Provide a file_path or enable auto_discover.";
  }
  return `Imported ${imported.sessions} session(s) with ${imported.memories} memory fragment(s) to .contextplus/external_memories/`;
}

export interface ListACPSessionsOptions {
  rootDir: string;
  source?: string;
}

export async function toolListACPSessions(options: ListACPSessionsOptions): Promise<string> {
  const sessions = await listSessions(options.rootDir);
  const filtered = options.source ? sessions.filter((s) => s.source === options.source) : sessions;

  if (filtered.length === 0) return "No external sessions found. Use import_acp to import agent sessions.";

  const lines = filtered.map((s) => {
    const date = new Date(s.timestamp).toISOString().split("T")[0];
    return `[${s.source}] ${s.id.slice(0, 12)} | ${date} | ${s.title} (${s.messages.length} msgs)`;
  });
  return `External Sessions (${filtered.length}):\n\n${lines.join("\n")}`;
}

export interface ListACPMemoriesOptions {
  rootDir: string;
  source?: string;
  type?: string;
}

export async function toolListACPMemories(options: ListACPMemoriesOptions): Promise<string> {
  let memories = await listMemories(options.rootDir);
  if (options.source) memories = memories.filter((m) => m.source === options.source);
  if (options.type) memories = memories.filter((m) => m.type === options.type);

  if (memories.length === 0) return "No external memories found. Use import_acp to import agent sessions.";

  const lines = memories.slice(0, 50).map((m) => {
    const preview = m.content.slice(0, 80).replace(/\n/g, " ");
    return `[${m.source}/${m.type}] ${m.id.slice(0, 10)} | ${preview}...`;
  });
  return `External Memories (${memories.length} total, showing ${lines.length}):\n\n${lines.join("\n")}`;
}

export interface SearchACPOptions {
  rootDir: string;
  query: string;
}

export async function toolSearchACP(options: SearchACPOptions): Promise<string> {
  const results = await searchACPMemories(options.rootDir, options.query);

  if (results.length === 0) return `No external memories found matching "${options.query}".`;

  const lines = results.map((m, i) => {
    const preview = m.content.slice(0, 120).replace(/\n/g, " ");
    return `${i + 1}. [${m.source}/${m.type}] ${preview}...`;
  });
  return `ACP Search Results for "${options.query}" (${results.length}):\n\n${lines.join("\n\n")}`;
}
