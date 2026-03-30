// Local checkpoint snapshots for file restore and iterative agent safety
// FEATURE: Undoable checkpoint lifecycle without rewriting existing git history

import { mkdir, readFile, readdir, rm, stat, writeFile } from "fs/promises";
import { dirname, join, relative, resolve } from "path";

export interface RestorePoint {
  id: string;
  timestamp: number;
  files: string[];
  message: string;
}

interface CheckpointManifest {
  checkpoints: RestorePoint[];
}

const CONTEXTPLUS_DIR = ".contextplus";
const CHECKPOINTS_DIR = "checkpoints";
const MANIFEST_FILE = "manifest.json";
const MAX_CHECKPOINTS = 120;

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function checkpointDir(rootDir: string): string {
  return join(rootDir, CONTEXTPLUS_DIR, CHECKPOINTS_DIR);
}

function manifestPath(rootDir: string): string {
  return join(checkpointDir(rootDir), MANIFEST_FILE);
}

function checkpointDataDir(rootDir: string, checkpointId: string): string {
  return join(checkpointDir(rootDir), checkpointId);
}

function backupFilePath(rootDir: string, checkpointId: string, filePath: string): string {
  return join(checkpointDataDir(rootDir, checkpointId), "files", normalizeFilePath(filePath));
}

async function ensureCheckpointRoot(rootDir: string): Promise<void> {
  await mkdir(checkpointDir(rootDir), { recursive: true });
}

async function loadManifest(rootDir: string): Promise<CheckpointManifest> {
  await ensureCheckpointRoot(rootDir);
  try {
    const data = JSON.parse(await readFile(manifestPath(rootDir), "utf-8")) as Partial<CheckpointManifest>;
    const checkpoints = Array.isArray(data.checkpoints) ? data.checkpoints : [];
    return { checkpoints };
  } catch {
    return { checkpoints: [] };
  }
}

async function saveManifest(rootDir: string, manifest: CheckpointManifest): Promise<void> {
  await ensureCheckpointRoot(rootDir);
  await writeFile(manifestPath(rootDir), JSON.stringify(manifest, null, 2), "utf-8");
}

async function checkpointFileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function pruneOldCheckpoints(rootDir: string, manifest: CheckpointManifest): Promise<void> {
  if (manifest.checkpoints.length <= MAX_CHECKPOINTS) return;
  const removed = manifest.checkpoints.splice(0, manifest.checkpoints.length - MAX_CHECKPOINTS);
  await Promise.all(removed.map((checkpoint) => rm(checkpointDataDir(rootDir, checkpoint.id), { recursive: true, force: true })));
}

export async function createRestorePoint(rootDir: string, files: string[], message: string): Promise<RestorePoint> {
  const normalizedFiles = Array.from(new Set(files.map(normalizeFilePath).filter(Boolean)));
  const id = `rp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = Date.now();
  const checkpoint: RestorePoint = { id, timestamp, files: normalizedFiles, message };
  await Promise.all(normalizedFiles.map(async (filePath) => {
    const sourcePath = resolve(rootDir, filePath);
    if (!await checkpointFileExists(sourcePath)) return;
    const backupPath = backupFilePath(rootDir, id, filePath);
    await mkdir(dirname(backupPath), { recursive: true });
    await writeFile(backupPath, await readFile(sourcePath));
  }));
  const manifest = await loadManifest(rootDir);
  manifest.checkpoints.push(checkpoint);
  manifest.checkpoints.sort((a, b) => a.timestamp - b.timestamp);
  await pruneOldCheckpoints(rootDir, manifest);
  await saveManifest(rootDir, manifest);
  return checkpoint;
}

export async function listRestorePoints(rootDir: string): Promise<RestorePoint[]> {
  const manifest = await loadManifest(rootDir);
  return manifest.checkpoints.slice().sort((a, b) => b.timestamp - a.timestamp);
}

export async function restorePoint(rootDir: string, pointId: string): Promise<string[]> {
  const manifest = await loadManifest(rootDir);
  const checkpoint = manifest.checkpoints.find((entry) => entry.id === pointId);
  if (!checkpoint) throw new Error(`Restore point ${pointId} not found`);
  const restored: string[] = [];
  await Promise.all(checkpoint.files.map(async (filePath) => {
    const backupPath = backupFilePath(rootDir, checkpoint.id, filePath);
    if (!await checkpointFileExists(backupPath)) return;
    const targetPath = resolve(rootDir, filePath);
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, await readFile(backupPath));
    restored.push(filePath);
  }));
  return restored.sort((a, b) => a.localeCompare(b));
}

export async function getCheckpointSummary(rootDir: string): Promise<string[]> {
  const checkpoints = await listRestorePoints(rootDir);
  return checkpoints.map((entry) => `${entry.id} | ${new Date(entry.timestamp).toISOString()} | ${entry.files.length} files | ${entry.message}`);
}

export async function cleanMissingCheckpointData(rootDir: string): Promise<number> {
  const manifest = await loadManifest(rootDir);
  const before = manifest.checkpoints.length;
  manifest.checkpoints = await manifest.checkpoints.reduce(async (promise, checkpoint) => {
    const acc = await promise;
    if (await checkpointFileExists(checkpointDataDir(rootDir, checkpoint.id))) acc.push(checkpoint);
    return acc;
  }, Promise.resolve([] as RestorePoint[]));
  if (manifest.checkpoints.length !== before) await saveManifest(rootDir, manifest);
  return before - manifest.checkpoints.length;
}

export async function listCheckpointFiles(rootDir: string, pointId: string): Promise<string[]> {
  const base = join(checkpointDataDir(rootDir, pointId), "files");
  if (!await checkpointFileExists(base)) return [];
  const result: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) await walk(entryPath);
      else result.push(normalizeFilePath(relative(base, entryPath)));
    }
  };
  await walk(base);
  return result.sort((a, b) => a.localeCompare(b));
}
