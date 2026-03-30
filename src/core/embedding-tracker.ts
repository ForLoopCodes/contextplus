// Background file watcher for incremental embedding updates on source changes
// Init-once pattern: starts on first tool use (lazy) or server boot (eager)

import { watch, type FSWatcher } from "fs";
import { refreshFileSearchEmbeddings } from "../tools/semantic-search.js";
import { refreshIdentifierEmbeddings } from "../tools/semantic-identifiers.js";

export interface EmbeddingTrackerOptions {
  rootDir: string;
  debounceMs?: number;
  maxFilesPerTick?: number;
}

export interface EmbeddingTrackerController {
  ensureStarted: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

export interface EmbeddingTrackerControllerOptions extends EmbeddingTrackerOptions {
  mode?: string;
  starter?: (options: EmbeddingTrackerOptions) => () => void;
}

const FILES_PER_TICK = { min: 5, max: 10, default: 8 };
const DEBOUNCE_MS = { min: 500, default: 1500 };
const MAX_PENDING = 50;
const QUIET_REFRESH_DELAY = 100;

const IGNORE_PREFIXES = [".mcp_data/", ".contextplus/", ".git/", "node_modules/", "build/", "dist/", "landing/.next/"];

const normalize = (path: string): string => path.replace(/\\/g, "/").replace(/^\/+/, "");
const shouldTrack = (path: string): boolean => path ? !IGNORE_PREFIXES.some((p) => path.startsWith(p)) : false;
const clampInt = (v: number | undefined, min: number, max: number, def: number): number =>
  Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v!))) : def;

export function parseEmbeddingTrackerMode(value: string | undefined): "off" | "lazy" | "eager" {
  if (!value) return "lazy";
  const v = value.trim().toLowerCase();
  if (["false", "0", "no", "off", "disabled", "none"].includes(v)) return "off";
  if (["eager", "startup", "boot"].includes(v)) return "eager";
  return "lazy";
}

export function startEmbeddingTracker(options: EmbeddingTrackerOptions): () => void {
  const pending = new Set<string>();
  const debounceMs = clampInt(options.debounceMs, DEBOUNCE_MS.min, 10000, DEBOUNCE_MS.default);
  const filesPerTick = clampInt(options.maxFilesPerTick, FILES_PER_TICK.min, FILES_PER_TICK.max, FILES_PER_TICK.default);

  let watcher: FSWatcher | null = null;
  let timer: NodeJS.Timeout | null = null;
  let processing = false;
  let closed = false;
  let errorCount = 0;

  const schedule = (delay = debounceMs): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), delay);
    timer.unref();
  };

  const flush = async (): Promise<void> => {
    if (closed || processing || pending.size === 0) return;
    processing = true;

    const batch = Array.from(pending).slice(0, filesPerTick);
    for (const f of batch) pending.delete(f);

    try {
      await Promise.all([
        refreshFileSearchEmbeddings({ rootDir: options.rootDir, relativePaths: batch }),
        refreshIdentifierEmbeddings({ rootDir: options.rootDir, relativePaths: batch }),
      ]);
      errorCount = 0;
    } catch {
      if (++errorCount <= 3) console.error(`Embedding refresh failed (attempt ${errorCount}/3)`);
    } finally {
      processing = false;
      if (pending.size > 0) schedule(QUIET_REFRESH_DELAY);
    }
  };

  try {
    watcher = watch(options.rootDir, { recursive: true }, (_, fileName) => {
      if (closed || !fileName) return;
      const rel = normalize(String(fileName));
      if (shouldTrack(rel) && pending.size < MAX_PENDING) {
        pending.add(rel);
        schedule();
      }
    });
    watcher.on("error", () => { });
  } catch {
    return () => { };
  }

  return () => {
    closed = true;
    if (timer) clearTimeout(timer);
    watcher?.close();
    watcher = null;
  };
}

export function createEmbeddingTrackerController(options: EmbeddingTrackerControllerOptions): EmbeddingTrackerController {
  const { mode: rawMode, starter = startEmbeddingTracker, ...trackerOpts } = options;
  const mode = parseEmbeddingTrackerMode(rawMode);

  let running = false;
  let stopFn = () => { };

  const ensureStarted = (): void => {
    if (running || mode === "off") return;
    stopFn = starter(trackerOpts);
    running = true;
  };

  if (mode === "eager") ensureStarted();

  return {
    ensureStarted,
    stop: () => {
      if (!running) return;
      running = false;
      const s = stopFn;
      stopFn = () => { };
      s();
    },
    isRunning: () => running,
  };
}
