// File-system embedding tracker for realtime cache refresh on source changes
// FEATURE: Incremental embedding updates for changed files and identifiers

import { watch, type FSWatcher } from "fs";
import { refreshFileSearchEmbeddings } from "../tools/semantic-search.js";
import { refreshIdentifierEmbeddings } from "../tools/semantic-identifiers.js";

export interface EmbeddingTrackerOptions {
  rootDir: string;
  debounceMs?: number;
  maxFilesPerTick?: number;
}

const MIN_FILES_PER_TICK = 5;
const MAX_FILES_PER_TICK = 10;
const DEFAULT_FILES_PER_TICK = 8;
const DEFAULT_DEBOUNCE_MS = 700;

const IGNORE_PREFIXES = [
  ".mcp_data/",
  ".git/",
  "node_modules/",
  "build/",
  "dist/",
  "landing/.next/",
];

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function shouldTrack(path: string): boolean {
  if (!path) return false;
  return !IGNORE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function clampFilesPerTick(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_FILES_PER_TICK;
  return Math.max(MIN_FILES_PER_TICK, Math.min(MAX_FILES_PER_TICK, Math.floor(value ?? DEFAULT_FILES_PER_TICK)));
}

function clampDebounceMs(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_DEBOUNCE_MS;
  return Math.max(100, Math.floor(value ?? DEFAULT_DEBOUNCE_MS));
}

export function startEmbeddingTracker(options: EmbeddingTrackerOptions): () => void {
  const pendingFiles = new Set<string>();
  const debounceMs = clampDebounceMs(options.debounceMs);
  const maxFilesPerTick = clampFilesPerTick(options.maxFilesPerTick);

  let watcher: FSWatcher | null = null;
  let timer: NodeJS.Timeout | null = null;
  let isProcessing = false;
  let closed = false;

  const schedule = (delay: number = debounceMs): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void flushPending();
    }, delay);
  };

  const flushPending = async (): Promise<void> => {
    if (closed || isProcessing) return;
    if (pendingFiles.size === 0) return;

    isProcessing = true;
    const batch = Array.from(pendingFiles).slice(0, maxFilesPerTick);
    for (const file of batch) pendingFiles.delete(file);

    try {
      const [fileEmbeds, identifierEmbeds] = await Promise.all([
        refreshFileSearchEmbeddings({ rootDir: options.rootDir, relativePaths: batch }),
        refreshIdentifierEmbeddings({ rootDir: options.rootDir, relativePaths: batch }),
      ]);
      if (fileEmbeds > 0 || identifierEmbeds > 0) {
        console.error(
          `Embedding tracker refreshed ${batch.length} file(s) | file-vectors=${fileEmbeds}, identifier-vectors=${identifierEmbeds}`,
        );
      }
    } catch (error) {
      console.error("Embedding tracker refresh failed:", error);
    } finally {
      isProcessing = false;
      if (pendingFiles.size > 0) schedule(100);
    }
  };

  try {
    watcher = watch(options.rootDir, { recursive: true }, (_eventType, fileName) => {
      if (closed || !fileName) return;
      const relativePath = normalizeRelativePath(String(fileName));
      if (!shouldTrack(relativePath)) return;
      pendingFiles.add(relativePath);
      schedule();
    });
  } catch (error) {
    console.error("Embedding tracker disabled: file watching is unavailable.", error);
    return () => { };
  }

  watcher.on("error", (error) => {
    console.error("Embedding tracker watcher error:", error);
  });

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    watcher?.close();
    watcher = null;
  };
}
