// Feature hub ranking and retrieval with semantic keyword and hybrid modes
// FEATURE: Hub discovery scoring and full-project fallback context exploration

import { readFile, stat } from "fs/promises";
import { resolve } from "path";
import { fetchEmbedding } from "../core/embeddings.js";
import { discoverHubs, findOrphanedFiles, parseHubFile } from "../core/hub.js";
import { walkDirectory } from "../core/walker.js";

export type HubSearchMode = "semantic" | "keyword" | "both";

export interface FindHubOptions {
  rootDir: string;
  query?: string;
  mode?: HubSearchMode;
  topK?: number;
}

export interface FeatureHubOptions {
  rootDir: string;
  hubPath?: string;
  featureName?: string;
  showOrphans?: boolean;
}

interface RankedHub {
  path: string;
  title: string;
  links: number;
  semanticScore: number;
  keywordScore: number;
  totalScore: number;
  summary: string;
}

function splitTerms(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((token) => token.length > 1);
}

function keywordCoverage(queryTerms: Set<string>, content: string): number {
  if (queryTerms.size === 0) return 0;
  const terms = new Set(splitTerms(content));
  let matched = 0;
  for (const term of queryTerms) if (terms.has(term)) matched += 1;
  return matched / queryTerms.size;
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function buildHubSummary(rootDir: string, hubPath: string): Promise<{ title: string; links: number; summary: string }> {
  const info = await parseHubFile(resolve(rootDir, hubPath));
  const linkText = info.links.map((link) => `${link.target} ${link.description ?? ""}`).join(" ");
  return { title: info.title, links: info.links.length, summary: `${hubPath} ${info.title} ${linkText}`.trim() };
}

async function getAllHubContext(rootDir: string): Promise<string> {
  const hubs = await discoverHubs(rootDir);
  if (hubs.length === 0) return "No hub files found.";
  const lines: string[] = [`All hubs (${hubs.length}):`, ""];
  for (const hubPath of hubs) {
    const info = await parseHubFile(resolve(rootDir, hubPath));
    lines.push(`${hubPath} | ${info.title} | ${info.links.length} links`);
    for (const link of info.links) lines.push(`  - [[${link.target}${link.description ? `|${link.description}` : ""}]]`);
    lines.push("");
  }
  return lines.join("\n");
}

function scoreByMode(mode: HubSearchMode, semanticScore: number, keywordScore: number): number {
  if (mode === "semantic") return semanticScore;
  if (mode === "keyword") return keywordScore;
  return semanticScore * 0.7 + keywordScore * 0.3;
}

async function rankHubs(rootDir: string, query: string, mode: HubSearchMode, topK: number): Promise<RankedHub[]> {
  const hubs = await discoverHubs(rootDir);
  if (hubs.length === 0) return [];
  const summaries = await Promise.all(hubs.map((hubPath) => buildHubSummary(rootDir, hubPath)));
  const queryTerms = new Set(splitTerms(query));
  const [queryVector] = await fetchEmbedding(query);
  const summaryVectors = await fetchEmbedding(summaries.map((item) => item.summary));
  return summaries
    .map((item, index) => {
      const semanticScore = Math.max(cosine(queryVector, summaryVectors[index]), 0);
      const keywordScore = keywordCoverage(queryTerms, item.summary);
      return {
        path: hubs[index],
        title: item.title,
        links: item.links,
        semanticScore,
        keywordScore,
        totalScore: scoreByMode(mode, semanticScore, keywordScore),
        summary: item.summary,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, Math.max(1, topK));
}

export async function findHub(options: FindHubOptions): Promise<string> {
  const mode = options.mode ?? "both";
  const topK = options.topK ?? 5;
  if (!options.query?.trim()) return getAllHubContext(options.rootDir);
  const ranked = await rankHubs(options.rootDir, options.query, mode, topK);
  if (ranked.length === 0) return "No hub files found.";
  const lines = [`Top ${ranked.length} hubs for "${options.query}" (${mode} mode):`, ""];
  for (let i = 0; i < ranked.length; i++) {
    const hub = ranked[i];
    lines.push(`${i + 1}. ${hub.path} (${Math.round(hub.totalScore * 1000) / 10}%)`);
    lines.push(`   Title: ${hub.title} | Links: ${hub.links}`);
    lines.push(`   Semantic: ${Math.round(hub.semanticScore * 1000) / 10}% | Keyword: ${Math.round(hub.keywordScore * 1000) / 10}%`);
    lines.push(`   Status: ${await fileExists(resolve(options.rootDir, hub.path)) ? "ok" : "missing"}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function findHubByName(rootDir: string, name: string): Promise<string | null> {
  const hubs = await discoverHubs(rootDir);
  const lower = name.toLowerCase();
  const exact = hubs.find((hub) => hub.toLowerCase() === `${lower}.md` || hub.toLowerCase().endsWith(`/${lower}.md`));
  if (exact) return exact;
  return hubs.find((hub) => hub.toLowerCase().includes(lower)) ?? null;
}

export async function getFeatureHub(options: FeatureHubOptions): Promise<string> {
  if (options.showOrphans) {
    const entries = await walkDirectory({ rootDir: options.rootDir, depthLimit: 10 });
    const files = entries.filter((entry) => !entry.isDirectory).map((entry) => entry.relativePath);
    const orphans = await findOrphanedFiles(options.rootDir, files);
    if (orphans.length === 0) return "No orphaned files. All source files are linked to a hub.";
    return [`Orphaned Files (${orphans.length}):`, "", ...orphans.map((path) => `  - ${path}`)].join("\n");
  }
  if (!options.hubPath && !options.featureName) {
    const hubs = await discoverHubs(options.rootDir);
    if (hubs.length === 0) return "No hub files found.";
    const lines = [`Feature Hubs (${hubs.length}):`, ""];
    for (const hubPath of hubs) {
      const info = await parseHubFile(resolve(options.rootDir, hubPath));
      lines.push(`  ${hubPath} | ${info.title} | ${info.links.length} links`);
    }
    return lines.join("\n");
  }
  const hubPath = options.hubPath ?? await findHubByName(options.rootDir, options.featureName ?? "");
  if (!hubPath) return `No hub found for feature "${options.featureName}".`;
  const fullPath = resolve(options.rootDir, hubPath);
  if (!await fileExists(fullPath)) return `Hub file not found: ${hubPath}`;
  const hub = await parseHubFile(fullPath);
  const lines = [`Hub: ${hub.title}`, `Path: ${hubPath}`, `Links: ${hub.links.length}`, ""];
  const missing: string[] = [];
  for (const link of hub.links) {
    const targetPath = resolve(options.rootDir, link.target);
    const exists = await fileExists(targetPath);
    lines.push(`- ${link.target}${link.description ? ` | ${link.description}` : ""}${exists ? "" : " | missing"}`);
    if (!exists) missing.push(link.target);
  }
  if (missing.length > 0) {
    lines.push("", `Missing Links (${missing.length})`);
    for (const item of missing) lines.push(`  - ${item}`);
  }
  return lines.join("\n");
}

export async function readHubContent(rootDir: string, hubPath: string): Promise<string> {
  const fullPath = resolve(rootDir, hubPath);
  if (!await fileExists(fullPath)) return `Hub not found: ${hubPath}`;
  return readFile(fullPath, "utf-8");
}
