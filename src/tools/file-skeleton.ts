// Detailed function signature extractor without reading full file bodies
// Returns structural skeleton: signatures, params, return types only

import { analyzeFile, isSupportedFile, type FileAnalysis } from "../core/parser.js";
import { readFile } from "fs/promises";
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

export async function getFileSkeleton(options: SkeletonOptions): Promise<string> {
  const fullPath = resolve(options.rootDir, options.filePath);

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
