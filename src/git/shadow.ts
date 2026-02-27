// Shadow git branch manager for safe AI change tracking
// Creates restore points on hidden branch without polluting main history

import { simpleGit, type SimpleGit } from "simple-git";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";

const SHADOW_BRANCH = "mcp-shadow-history";
const DATA_DIR = ".mcp_data";

export interface RestorePoint {
  id: string;
  timestamp: number;
  files: string[];
  message: string;
}

async function ensureDataDir(rootDir: string): Promise<string> {
  const dataPath = join(rootDir, DATA_DIR);
  await mkdir(dataPath, { recursive: true });
  return dataPath;
}

async function loadManifest(rootDir: string): Promise<RestorePoint[]> {
  const manifestPath = join(rootDir, DATA_DIR, "restore-points.json");
  try {
    return JSON.parse(await readFile(manifestPath, "utf-8"));
  } catch {
    return [];
  }
}

async function saveManifest(rootDir: string, points: RestorePoint[]): Promise<void> {
  const dataPath = await ensureDataDir(rootDir);
  await writeFile(join(dataPath, "restore-points.json"), JSON.stringify(points, null, 2));
}

export async function createRestorePoint(rootDir: string, files: string[], message: string): Promise<RestorePoint> {
  const dataPath = await ensureDataDir(rootDir);
  const id = `rp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const backupDir = join(dataPath, "backups", id);
  await mkdir(backupDir, { recursive: true });

  for (const file of files) {
    const fullPath = join(rootDir, file);
    try {
      const content = await readFile(fullPath, "utf-8");
      const backupPath = join(backupDir, file.replace(/[\\/]/g, "__"));
      await writeFile(backupPath, content);
    } catch {
    }
  }

  const point: RestorePoint = { id, timestamp: Date.now(), files, message };
  const manifest = await loadManifest(rootDir);
  manifest.push(point);
  if (manifest.length > 100) manifest.splice(0, manifest.length - 100);
  await saveManifest(rootDir, manifest);

  return point;
}

export async function restorePoint(rootDir: string, pointId: string): Promise<string[]> {
  const manifest = await loadManifest(rootDir);
  const point = manifest.find((p) => p.id === pointId);
  if (!point) throw new Error(`Restore point ${pointId} not found`);

  const backupDir = join(rootDir, DATA_DIR, "backups", pointId);
  const restoredFiles: string[] = [];

  for (const file of point.files) {
    const backupPath = join(backupDir, file.replace(/[\\/]/g, "__"));
    try {
      const content = await readFile(backupPath, "utf-8");
      const targetPath = join(rootDir, file);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, content);
      restoredFiles.push(file);
    } catch {
    }
  }

  return restoredFiles;
}

export async function listRestorePoints(rootDir: string): Promise<RestorePoint[]> {
  return loadManifest(rootDir);
}

export async function shadowCommit(rootDir: string, message: string): Promise<boolean> {
  try {
    const git: SimpleGit = simpleGit(rootDir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return false;

    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const stashResult = await git.stash(["push", "-m", `mcp-shadow: ${message}`]);

    if (!stashResult.includes("No local changes")) {
      try {
        const branchExists = await git.branch(["-l", SHADOW_BRANCH]);
        if (!branchExists.all.includes(SHADOW_BRANCH)) {
          await git.branch([SHADOW_BRANCH]);
        }
        await git.checkout(SHADOW_BRANCH);
        await git.stash(["pop"]);
        await git.add(".");
        await git.commit(`[MCP Shadow] ${message}`);
        await git.checkout(currentBranch);
      } catch (e) {
        await git.checkout(currentBranch);
        try { await git.stash(["pop"]); } catch { }
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}
