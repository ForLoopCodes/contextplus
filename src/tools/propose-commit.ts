// Checkpoint write guard validates files and creates local undo snapshots
// FEATURE: Safe file writes with validation warnings and checkpoint metadata

import { mkdir, writeFile } from "fs/promises";
import { dirname, extname, resolve } from "path";
import { createRestorePoint } from "../git/shadow.js";
import { isSupportedFile } from "../core/parser.js";

export interface CheckpointOptions {
  rootDir: string;
  filePath: string;
  newContent: string;
}

interface ValidationIssue {
  rule: string;
  message: string;
  line?: number;
}

const COMMENT_PREFIX_BY_EXT: Record<string, string> = {
  ".ts": "//",
  ".tsx": "//",
  ".js": "//",
  ".jsx": "//",
  ".mjs": "//",
  ".cjs": "//",
  ".rs": "//",
  ".go": "//",
  ".c": "//",
  ".cpp": "//",
  ".java": "//",
  ".cs": "//",
  ".swift": "//",
  ".kt": "//",
  ".zig": "//",
  ".py": "#",
  ".rb": "#",
  ".lua": "--",
};

function validateHeader(lines: string[], ext: string): ValidationIssue[] {
  const prefix = COMMENT_PREFIX_BY_EXT[ext];
  if (!prefix) return [];
  const issues: ValidationIssue[] = [];
  if (!lines[0]?.trim().startsWith(prefix)) {
    issues.push({ rule: "header", message: `line 1 must start with ${prefix}` });
  }
  if (!lines[1]?.trim().startsWith(prefix)) {
    issues.push({ rule: "header", message: `line 2 must start with ${prefix}` });
  }
  return issues;
}

function validateNoInlineComments(lines: string[], ext: string): ValidationIssue[] {
  const prefix = COMMENT_PREFIX_BY_EXT[ext];
  if (!prefix) return [];
  const issues: ValidationIssue[] = [];
  for (let i = 2; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith(prefix)) continue;
    if (prefix === "#" && (trimmed.startsWith("#!") || trimmed.startsWith("#include"))) continue;
    issues.push({ rule: "no-comments", message: "comment outside header", line: i + 1 });
  }
  return issues;
}

function validateAbstraction(lines: string[]): ValidationIssue[] {
  let nesting = 0;
  let maxNesting = 0;
  for (const line of lines) {
    nesting += (line.match(/{/g) ?? []).length;
    nesting -= (line.match(/}/g) ?? []).length;
    if (nesting > maxNesting) maxNesting = nesting;
  }
  const issues: ValidationIssue[] = [];
  if (maxNesting > 6) issues.push({ rule: "nesting", message: `nesting depth ${maxNesting} exceeds recommended 4` });
  if (lines.length > 1000) issues.push({ rule: "file-length", message: `file length ${lines.length} exceeds recommended 1000` });
  return issues;
}

function formatIssues(issues: ValidationIssue[]): string[] {
  return issues.map((issue) => `${issue.line ? `L${issue.line} ` : ""}[${issue.rule}] ${issue.message}`);
}

export async function checkpoint(options: CheckpointOptions): Promise<string> {
  const fullPath = resolve(options.rootDir, options.filePath);
  const lines = options.newContent.split("\n");
  const ext = extname(fullPath).toLowerCase();
  const issues = [
    ...(isSupportedFile(fullPath) ? validateHeader(lines, ext) : []),
    ...(isSupportedFile(fullPath) ? validateNoInlineComments(lines, ext) : []),
    ...validateAbstraction(lines),
  ];
  const commentViolations = issues.filter((issue) => issue.rule === "no-comments");
  if (commentViolations.length > 5) {
    return [
      `REJECTED: ${issues.length} validation issues`,
      ...formatIssues(issues.slice(0, 12)),
      issues.length > 12 ? `... ${issues.length - 12} more issues` : "",
    ].filter(Boolean).join("\n");
  }
  const restorePoint = await createRestorePoint(options.rootDir, [options.filePath], `Checkpoint before writing ${options.filePath}`);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, options.newContent, "utf-8");
  return [
    `✅ File saved: ${options.filePath}`,
    `Restore point: ${restorePoint.id}`,
    ...(issues.length > 0 ? ["⚠ Warnings:", ...formatIssues(issues)] : ["Warnings: none"]),
  ].join("\n");
}

export async function proposeCommit(options: CheckpointOptions): Promise<string> {
  return checkpoint(options);
}
