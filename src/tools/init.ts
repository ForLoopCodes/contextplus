// Project initializer creates contextplus directories and generates initial embeddings
// FEATURE: One-time workspace bootstrap for hubs embeddings config memories and search

import { mkdir, writeFile, access } from "fs/promises";
import { join, resolve } from "path";
import { getContextTree } from "./context-tree.js";
import { walkDirectory } from "../core/walker.js";
import { isSupportedFile } from "../core/parser.js";
import { refreshFileSearchEmbeddings } from "./semantic-search.js";
import { refreshIdentifierEmbeddings } from "./semantic-identifiers.js";

export interface InitOptions {
  rootDir: string;
  targetPath?: string;
  skipEmbeddings?: boolean;
}

interface InitResult {
  projectRoot: string;
  createdPaths: string[];
  contextTreePath: string;
  embeddingsGenerated: number;
}

async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeIfNotExists(path: string, content: string): Promise<void> {
  if (!(await fileExists(path))) {
    await writeFile(path, content, "utf-8");
  }
}

async function writeDefaultFiles(projectRoot: string): Promise<void> {
  const files: Record<string, string> = {
    [join(projectRoot, ".contextplus", "hubs", "README.md")]: "# Context+ Hubs\n\nUse markdown files with [[path/to/file]] links to group features.\n",
    [join(projectRoot, ".contextplus", "memories", "graph.json")]: '{"nodes":{},"edges":{}}',
    [join(projectRoot, ".contextplus", "external_memories", "sessions.json")]: "[]",
    [join(projectRoot, ".contextplus", "external_memories", "memories.json")]: "[]",
  };
  await Promise.all(Object.entries(files).map(([path, content]) => writeIfNotExists(path, content)));
}

async function writeContextTreeSnapshot(projectRoot: string): Promise<string> {
  const tree = await getContextTree({ rootDir: projectRoot, includeSymbols: true, maxTokens: 50_000 });
  const outputPath = join(projectRoot, ".contextplus", "config", "context-tree.txt");
  await writeFile(outputPath, `${tree}\n`, "utf-8");
  return outputPath;
}

async function generateInitialEmbeddings(projectRoot: string): Promise<number> {
  const entries = await walkDirectory({ rootDir: projectRoot, depthLimit: 0 });
  const files = entries.filter((e) => !e.isDirectory && isSupportedFile(e.path)).map((e) => e.relativePath);
  if (files.length === 0) return 0;
  const [fileCount, identifierCount] = await Promise.all([
    refreshFileSearchEmbeddings({ rootDir: projectRoot, relativePaths: files }),
    refreshIdentifierEmbeddings({ rootDir: projectRoot, relativePaths: files }),
  ]);
  return fileCount + identifierCount;
}

export async function initProject(options: InitOptions): Promise<InitResult> {
  const projectRoot = options.targetPath ? resolve(options.rootDir, options.targetPath) : resolve(options.rootDir);
  const directories = [
    join(projectRoot, ".contextplus"),
    join(projectRoot, ".contextplus", "hubs"),
    join(projectRoot, ".contextplus", "embeddings"),
    join(projectRoot, ".contextplus", "config"),
    join(projectRoot, ".contextplus", "memories"),
    join(projectRoot, ".contextplus", "memories", "nodes"),
    join(projectRoot, ".contextplus", "external_memories"),
  ];
  await Promise.all(directories.map((path) => ensureDirectory(path)));
  await writeDefaultFiles(projectRoot);
  const contextTreePath = await writeContextTreeSnapshot(projectRoot);
  const embeddingsGenerated = options.skipEmbeddings ? 0 : await generateInitialEmbeddings(projectRoot);
  return { projectRoot, createdPaths: directories, contextTreePath, embeddingsGenerated };
}

export function formatInitResult(result: InitResult): string {
  const lines = [
    `Initialized Context+ project at ${result.projectRoot}`,
    "Created:",
    ...result.createdPaths.map((path) => `- ${path}`),
    `Context tree snapshot: ${result.contextTreePath}`,
  ];
  if (result.embeddingsGenerated > 0) lines.push(`Generated ${result.embeddingsGenerated} initial embeddings`);
  return lines.join("\n");
}
