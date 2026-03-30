// ACP parser for importing agent sessions from opencode, copilot, claude, codex
// Converts external session formats to unified contextplus memory format

import { readdir, readFile, mkdir, writeFile } from "fs/promises";
import { join, basename } from "path";
import { existsSync } from "fs";

export type AgentSource = "opencode" | "copilot" | "claude" | "codex" | "unknown";

export interface ACPSession {
  id: string;
  source: AgentSource;
  timestamp: number;
  title: string;
  messages: ACPMessage[];
  metadata: Record<string, string>;
}

export interface ACPMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface ACPMemory {
  id: string;
  source: AgentSource;
  sessionId: string;
  content: string;
  type: "insight" | "decision" | "context" | "code";
  timestamp: number;
}

const EXTERNAL_DIR = "external_memories";
const SESSIONS_FILE = "sessions.json";
const MEMORIES_FILE = "memories.json";

function detectSource(filePath: string, content: string): AgentSource {
  const name = basename(filePath).toLowerCase();
  if (name.includes("opencode") || content.includes('"opencode"')) return "opencode";
  if (name.includes("copilot") || content.includes('"copilot"') || content.includes("github.copilot")) return "copilot";
  if (name.includes("claude") || content.includes('"claude"') || content.includes("anthropic")) return "claude";
  if (name.includes("codex") || content.includes('"codex"') || content.includes("openai")) return "codex";
  return "unknown";
}

function generateId(): string {
  return `acp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseOpenCodeSession(data: Record<string, unknown>): ACPSession | null {
  const messages: ACPMessage[] = [];
  const rawMessages = (data.messages || data.conversation || []) as Record<string, unknown>[];
  for (const msg of rawMessages) {
    messages.push({
      role: (msg.role as string) === "user" ? "user" : (msg.role as string) === "system" ? "system" : "assistant",
      content: String(msg.content || msg.text || ""),
      timestamp: typeof msg.timestamp === "number" ? msg.timestamp : undefined,
    });
  }
  if (messages.length === 0) return null;
  return {
    id: String(data.id || generateId()),
    source: "opencode",
    timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
    title: String(data.title || data.name || "OpenCode Session"),
    messages,
    metadata: { model: String(data.model || "unknown") },
  };
}

function parseCopilotSession(data: Record<string, unknown>): ACPSession | null {
  const messages: ACPMessage[] = [];
  const rawMessages = (data.turns || data.messages || []) as Record<string, unknown>[];
  for (const msg of rawMessages) {
    const content = String(msg.request || msg.response || msg.content || "");
    if (!content) continue;
    messages.push({
      role: msg.request ? "user" : "assistant",
      content,
      timestamp: typeof msg.timestamp === "number" ? msg.timestamp : undefined,
    });
  }
  if (messages.length === 0) return null;
  return {
    id: String(data.id || generateId()),
    source: "copilot",
    timestamp: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
    title: String(data.title || "Copilot Session"),
    messages,
    metadata: {},
  };
}

function parseClaudeSession(data: Record<string, unknown>): ACPSession | null {
  const messages: ACPMessage[] = [];
  const rawMessages = (data.chat_messages || data.messages || []) as Record<string, unknown>[];
  for (const msg of rawMessages) {
    messages.push({
      role: (msg.sender as string) === "human" ? "user" : "assistant",
      content: String(msg.text || msg.content || ""),
      timestamp: typeof msg.created_at === "string" ? Date.parse(msg.created_at as string) : undefined,
    });
  }
  if (messages.length === 0) return null;
  return {
    id: String(data.uuid || data.id || generateId()),
    source: "claude",
    timestamp: typeof data.created_at === "string" ? Date.parse(data.created_at as string) : Date.now(),
    title: String(data.name || "Claude Session"),
    messages,
    metadata: { model: String(data.model || "unknown") },
  };
}

function parseCodexSession(data: Record<string, unknown>): ACPSession | null {
  const messages: ACPMessage[] = [];
  const rawMessages = (data.messages || data.history || []) as Record<string, unknown>[];
  for (const msg of rawMessages) {
    messages.push({
      role: (msg.role as string) === "user" ? "user" : "assistant",
      content: String(msg.content || ""),
    });
  }
  if (messages.length === 0) return null;
  return {
    id: String(data.id || generateId()),
    source: "codex",
    timestamp: Date.now(),
    title: String(data.title || "Codex Session"),
    messages,
    metadata: {},
  };
}

function parseSession(source: AgentSource, data: Record<string, unknown>): ACPSession | null {
  switch (source) {
    case "opencode": return parseOpenCodeSession(data);
    case "copilot": return parseCopilotSession(data);
    case "claude": return parseClaudeSession(data);
    case "codex": return parseCodexSession(data);
    default: return parseOpenCodeSession(data);
  }
}

function extractMemories(session: ACPSession): ACPMemory[] {
  const memories: ACPMemory[] = [];
  for (const msg of session.messages) {
    if (msg.role !== "assistant" || msg.content.length < 50) continue;
    const content = msg.content;
    let type: ACPMemory["type"] = "context";
    if (content.includes("```") || content.includes("function ") || content.includes("class ")) type = "code";
    else if (content.includes("decided") || content.includes("should") || content.includes("recommend")) type = "decision";
    else if (content.includes("insight") || content.includes("learned") || content.includes("discovered")) type = "insight";
    memories.push({
      id: generateId(),
      source: session.source,
      sessionId: session.id,
      content: content.slice(0, 2000),
      type,
      timestamp: msg.timestamp || session.timestamp,
    });
  }
  return memories;
}

export async function importSessionFile(rootDir: string, filePath: string): Promise<{ sessions: number; memories: number }> {
  const content = await readFile(filePath, "utf-8");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch {
    return { sessions: 0, memories: 0 };
  }

  const source = detectSource(filePath, content);
  const items = Array.isArray(data) ? data : [data];
  const sessions: ACPSession[] = [];
  const memories: ACPMemory[] = [];

  for (const item of items) {
    const session = parseSession(source, item as Record<string, unknown>);
    if (session) {
      sessions.push(session);
      memories.push(...extractMemories(session));
    }
  }

  if (sessions.length === 0) return { sessions: 0, memories: 0 };

  const extDir = join(rootDir, ".contextplus", EXTERNAL_DIR);
  await mkdir(extDir, { recursive: true });

  const sessionsPath = join(extDir, SESSIONS_FILE);
  const memoriesPath = join(extDir, MEMORIES_FILE);

  let existing: ACPSession[] = [];
  let existingMem: ACPMemory[] = [];
  if (existsSync(sessionsPath)) {
    existing = JSON.parse(await readFile(sessionsPath, "utf-8"));
  }
  if (existsSync(memoriesPath)) {
    existingMem = JSON.parse(await readFile(memoriesPath, "utf-8"));
  }

  const existingIds = new Set(existing.map((s) => s.id));
  const newSessions = sessions.filter((s) => !existingIds.has(s.id));
  const newMemIds = new Set(existingMem.map((m) => m.id));
  const newMemories = memories.filter((m) => !newMemIds.has(m.id));

  await writeFile(sessionsPath, JSON.stringify([...existing, ...newSessions], null, 2));
  await writeFile(memoriesPath, JSON.stringify([...existingMem, ...newMemories], null, 2));

  return { sessions: newSessions.length, memories: newMemories.length };
}

export async function listSessions(rootDir: string): Promise<ACPSession[]> {
  const sessionsPath = join(rootDir, ".contextplus", EXTERNAL_DIR, SESSIONS_FILE);
  if (!existsSync(sessionsPath)) return [];
  return JSON.parse(await readFile(sessionsPath, "utf-8"));
}

export async function listMemories(rootDir: string): Promise<ACPMemory[]> {
  const memoriesPath = join(rootDir, ".contextplus", EXTERNAL_DIR, MEMORIES_FILE);
  if (!existsSync(memoriesPath)) return [];
  return JSON.parse(await readFile(memoriesPath, "utf-8"));
}

export async function searchACPMemories(rootDir: string, query: string): Promise<ACPMemory[]> {
  const memories = await listMemories(rootDir);
  const queryLower = query.toLowerCase();
  const terms = queryLower.split(/\s+/).filter((t) => t.length > 2);
  return memories
    .filter((m) => {
      const contentLower = m.content.toLowerCase();
      return terms.some((t) => contentLower.includes(t));
    })
    .sort((a, b) => {
      const aScore = terms.filter((t) => a.content.toLowerCase().includes(t)).length;
      const bScore = terms.filter((t) => b.content.toLowerCase().includes(t)).length;
      return bScore - aScore;
    })
    .slice(0, 20);
}

export async function discoverSessionFiles(searchDir: string): Promise<string[]> {
  const patterns = ["conversations.json", "chat*.json", "*session*.json", "history.json"];
  const found: string[] = [];

  async function scan(dir: string, depth: number): Promise<void> {
    if (depth > 3) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath, depth + 1);
        } else if (entry.name.endsWith(".json")) {
          const name = entry.name.toLowerCase();
          if (patterns.some((p) => name.includes(p.replace("*", "")) || name.match(new RegExp(p.replace("*", ".*"))))) {
            found.push(fullPath);
          }
        }
      }
    } catch { }
  }

  await scan(searchDir, 0);
  return found;
}
