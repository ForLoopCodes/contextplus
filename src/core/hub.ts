// Obsidian-style hub parser extracting wikilinks and cross-link tags
// FEATURE: Hierarchical context management via feature hub graph

import { readFile, readdir, stat } from "fs/promises";
import { resolve, relative, join, extname, basename } from "path";

export interface HubLink {
  target: string;
  description?: string;
}

export interface CrossLink {
  hubName: string;
  sourceFile: string;
}

export interface HubInfo {
  hubPath: string;
  title: string;
  links: HubLink[];
  crossLinks: CrossLink[];
  raw: string;
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
const CROSS_LINK_RE = /@linked-to\s+\[\[([^\]]+)\]\]/g;
const HEADER_FEATURE_RE = /^(?:\/\/|#|--)\s*FEATURE:\s*(.+)$/m;

export function parseWikiLinks(content: string): HubLink[] {
  const links: HubLink[] = [];
  const seen = new Set<string>();
  const cleaned = content.replace(CROSS_LINK_RE, "");

  for (const match of cleaned.matchAll(WIKILINK_RE)) {
    const target = match[1].trim();
    if (!seen.has(target)) {
      seen.add(target);
      links.push({ target, description: match[2]?.trim() });
    }
  }
  return links;
}

export function parseCrossLinks(content: string, sourceFile: string): CrossLink[] {
  const crossLinks: CrossLink[] = [];
  for (const match of content.matchAll(CROSS_LINK_RE)) {
    crossLinks.push({ hubName: match[1].trim(), sourceFile });
  }
  return crossLinks;
}

export function extractFeatureTag(content: string): string | null {
  const match = content.match(HEADER_FEATURE_RE);
  return match ? match[1].trim() : null;
}

export async function parseHubFile(hubPath: string): Promise<HubInfo> {
  const content = await readFile(hubPath, "utf-8");
  const lines = content.split("\n");

  let title = basename(hubPath, extname(hubPath));
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) title = headingMatch[1].trim();

  return {
    hubPath,
    title,
    links: parseWikiLinks(content),
    crossLinks: parseCrossLinks(content, hubPath),
    raw: content,
  };
}

export async function discoverHubs(rootDir: string): Promise<string[]> {
  const hubs: string[] = [];
  const skip = new Set(["node_modules", ".git", "build", "dist", ".mcp_data"]);

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith(".md")) {
        const content = await readFile(full, "utf-8");
        if (WIKILINK_RE.test(content)) {
          hubs.push(relative(rootDir, full).replace(/\\/g, "/"));
          WIKILINK_RE.lastIndex = 0;
        }
      }
    }
  }

  await walk(rootDir);
  return hubs.sort();
}

export async function findOrphanedFiles(
  rootDir: string,
  allFilePaths: string[],
): Promise<string[]> {
  const hubs = await discoverHubs(rootDir);
  const linkedFiles = new Set<string>();

  for (const hubRelPath of hubs) {
    const info = await parseHubFile(resolve(rootDir, hubRelPath));
    for (const link of info.links) {
      linkedFiles.add(link.target.replace(/\\/g, "/"));
    }
    linkedFiles.add(hubRelPath);
  }

  return allFilePaths
    .filter((f) => !f.endsWith(".md"))
    .filter((f) => !linkedFiles.has(f.replace(/\\/g, "/")));
}

export function formatHubLink(target: string, description: string): string {
  return description
    ? `- [[${target}|${description}]]`
    : `- [[${target}]]`;
}
