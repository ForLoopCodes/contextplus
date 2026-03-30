// Detailed function signature extractor without reading full file bodies
// Returns structural skeleton: signatures, params, return types only

import { analyzeFile, isSupportedFile, type FileAnalysis } from "../core/parser.js";
import { readFile, realpath } from "fs/promises";
import { resolve } from "path";

export interface SkeletonOptions {
  filePath: string;
  rootDir: string;
}

function formatLineRange(line: number, endLine: number): string {
  return endLine > line ? `L${line}-L${endLine}` : `L${line}`;
}

function formatSignatureBlock(analysis: FileAnalysis): string {
  const lines: string[] = [];

  if (analysis.header) {
    lines.push(`// ${analysis.header}`);
    lines.push("");
  }

  for (const sym of analysis.symbols) {
    lines.push(`[${sym.kind}] ${formatLineRange(sym.line, sym.endLine)} ${sym.signature};`);
    for (const child of sym.children) {
      lines.push(`  [${child.kind}] ${formatLineRange(child.line, child.endLine)} ${child.signature};`);
    }
    if (sym.children.length > 0) lines.push("");
  }

  return lines.join("\n");
}

async function assertInsideRoot(fullPath: string, rootDir: string): Promise<void> {
  const resolvedRoot = resolve(rootDir);
  const resolvedPath = resolve(fullPath);

  // Check the literal resolved path first (before symlink resolution)
  if (!resolvedPath.startsWith(resolvedRoot + "/") && resolvedPath !== resolvedRoot) {
    throw new Error(`Path escapes project root: ${resolvedPath}`);
  }

  // Also check after resolving symlinks to prevent symlink-based escapes
  try {
    const realRoot = await realpath(resolvedRoot);
    const realFile = await realpath(resolvedPath);
    if (!realFile.startsWith(realRoot + "/") && realFile !== realRoot) {
      throw new Error(`Path escapes project root after symlink resolution: ${realFile}`);
    }
  } catch (err) {
    // If realpath fails because path doesn't exist, the initial check is sufficient
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}

export async function getFileSkeleton(options: SkeletonOptions): Promise<string> {
  const fullPath = resolve(options.rootDir, options.filePath);

  await assertInsideRoot(fullPath, options.rootDir);

  if (!isSupportedFile(fullPath)) {
    const content = await readFile(fullPath, "utf-8");
    const preview = content.split("\n").slice(0, 20).join("\n");
    return `[Unsupported language, showing first 20 lines]\n\n${preview}`;
  }

  const analysis = await analyzeFile(fullPath);

  if (analysis.symbols.length === 0) {
    const content = await readFile(fullPath, "utf-8");
    const preview = content.split("\n").slice(0, 30).join("\n");
    return `[No symbols detected, showing first 30 lines]\n\n${preview}`;
  }

  return [
    `File: ${options.filePath} (${analysis.lineCount} lines)`,
    `Symbols: ${analysis.symbols.length} top-level definitions`,
    "",
    formatSignatureBlock(analysis),
  ].join("\n");
}
