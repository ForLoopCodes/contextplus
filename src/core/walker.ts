// Gitignore-aware recursive directory walker with depth control
// Returns filtered file paths respecting project ignore patterns (nested-gitignore-aware)

import { readdir, readFile, stat } from "fs/promises";
import { join, relative, resolve } from "path";
import ignore, { type Ignore } from "ignore";

export interface WalkOptions {
  targetPath?: string;
  depthLimit?: number;
  rootDir: string;
}

export interface FileEntry {
  path: string;
  relativePath: string;
  isDirectory: boolean;
  depth: number;
}

interface IgnoreScope {
  ig: Ignore;
  patterns: string[];
}

const ALWAYS_IGNORE = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "__pycache__",
  ".DS_Store",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "target",
  ".mcp_data",
  ".mcp-shadow-history",
  "coverage",
  ".cache",
  ".turbo",
  ".parcel-cache",
]);

async function readGitignorePatterns(dir: string): Promise<string[]> {
  try {
    const content = await readFile(join(dir, ".gitignore"), "utf-8");
    return content.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("#"));
  } catch {
    return [];
  }
}

async function loadScopeFor(dir: string, parent: IgnoreScope | null): Promise<IgnoreScope> {
  const local = await readGitignorePatterns(dir);
  if (!parent && local.length === 0) return { ig: ignore(), patterns: [] };
  if (!parent) return { ig: ignore().add(local), patterns: local };
  if (local.length === 0) return parent;
  const merged = [...parent.patterns, ...local];
  return { ig: ignore().add(merged), patterns: merged };
}

async function walkRecursive(
  dir: string,
  rootDir: string,
  scope: IgnoreScope,
  depth: number,
  maxDepth: number,
  results: FileEntry[],
): Promise<void> {
  if (maxDepth > 0 && depth > maxDepth) return;

  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (ALWAYS_IGNORE.has(entry.name) || entry.name.startsWith(".")) continue;

    const fullPath = join(dir, entry.name);
    const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");
    if (scope.ig.ignores(relPath)) continue;

    const isDir = entry.isDirectory();
    results.push({ path: fullPath, relativePath: relPath, isDirectory: isDir, depth });

    if (isDir) {
      const childScope = await loadScopeFor(fullPath, scope);
      await walkRecursive(fullPath, rootDir, childScope, depth + 1, maxDepth, results);
    }
  }
}

export async function walkDirectory(options: WalkOptions): Promise<FileEntry[]> {
  const rootDir = resolve(options.rootDir);
  const startDir = options.targetPath ? resolve(rootDir, options.targetPath) : rootDir;
  const results: FileEntry[] = [];

  try {
    await stat(startDir);
  } catch {
    return results;
  }

  const rootScope = await loadScopeFor(rootDir, null);
  let startScope = rootScope;
  if (startDir !== rootDir) {
    // Build the scope chain from rootDir down to startDir so inherited rules apply.
    const rel = relative(rootDir, startDir).split(/[\\/]/).filter(Boolean);
    let cursor = rootDir;
    let scope = rootScope;
    for (const segment of rel) {
      cursor = join(cursor, segment);
      scope = await loadScopeFor(cursor, scope);
    }
    startScope = scope;
  }

  await walkRecursive(startDir, rootDir, startScope, 0, options.depthLimit ?? 0, results);
  return results;
}

export function groupByDirectory(entries: FileEntry[]): Map<string, FileEntry[]> {
  const groups = new Map<string, FileEntry[]>();
  for (const entry of entries) {
    const dir = entry.relativePath.includes("/")
      ? entry.relativePath.substring(0, entry.relativePath.lastIndexOf("/"))
      : ".";
    const existing = groups.get(dir) ?? [];
    existing.push(entry);
    groups.set(dir, existing);
  }
  return groups;
}

let GLOBAL_EXTRA_ROOTS: string[] = [];

export function setExtraRoots(paths: string[]): void {
  GLOBAL_EXTRA_ROOTS = [...paths];
}

export function getExtraRoots(): string[] {
  return [...GLOBAL_EXTRA_ROOTS];
}

export interface WalkRootsOptions {
  rootDir: string;
  extraRoots?: string[];
  depthLimit?: number;
  targetPath?: string;
}

export async function walkRoots(options: WalkRootsOptions): Promise<FileEntry[]> {
  const rootDir = resolve(options.rootDir);
  const extraRoots = options.extraRoots ?? GLOBAL_EXTRA_ROOTS;
  const seen = new Set<string>();
  const results: FileEntry[] = [];

  const primary = await walkDirectory({
    rootDir,
    depthLimit: options.depthLimit,
    targetPath: options.targetPath,
  });
  for (const entry of primary) {
    if (seen.has(entry.path)) continue;
    seen.add(entry.path);
    results.push(entry);
  }

  // targetPath constrains the primary walk only — extraRoots are always walked in full.
  for (const extra of extraRoots) {
    const extraAbs = resolve(rootDir, extra);
    if (extraAbs !== rootDir && !extraAbs.startsWith(rootDir + "/")) {
      throw new Error(`walkRoots: extraRoot "${extra}" resolves outside workspace root`);
    }
    const depthOffset = relative(rootDir, extraAbs).split("/").filter(Boolean).length;
    const extraEntries = await walkDirectory({
      rootDir: extraAbs,
      depthLimit: options.depthLimit,
    });
    for (const entry of extraEntries) {
      if (seen.has(entry.path)) continue;
      seen.add(entry.path);
      const workspaceRel = relative(rootDir, entry.path).replace(/\\/g, "/");
      results.push({
        path: entry.path,
        relativePath: workspaceRel,
        isDirectory: entry.isDirectory,
        depth: entry.depth + depthOffset,
      });
    }
  }

  return results;
}
