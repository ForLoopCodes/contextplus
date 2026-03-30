// Project lint runner plus skill scoring for standards and hygiene
// FEATURE: Deterministic lint checks with per-file and global skill report

import { execFile } from "child_process";
import { stat, readFile } from "fs/promises";
import { extname, resolve } from "path";
import { promisify } from "util";
import { walkDirectory } from "../core/walker.js";

const execFileAsync = promisify(execFile);

export interface LintOptions {
  rootDir: string;
  targetPath?: string;
}

interface LintResult {
  tool: string;
  output: string;
  exitCode: number;
}

interface SkillIssue {
  file: string;
  line: number;
  reason: string;
}

interface SkillFileScore {
  file: string;
  score: number;
  issues: SkillIssue[];
}

const LINTER_MAP: Record<string, { cmd: string; args: string[] }> = {
  ".ts": { cmd: "npx", args: ["tsc", "--noEmit", "--pretty"] },
  ".tsx": { cmd: "npx", args: ["tsc", "--noEmit", "--pretty"] },
  ".js": { cmd: "npx", args: ["eslint", "--no-eslintrc", "--rule", '{"no-unused-vars":"warn"}'] },
  ".py": { cmd: "python", args: ["-m", "py_compile"] },
  ".rs": { cmd: "cargo", args: ["check", "--message-format=short"] },
  ".go": { cmd: "go", args: ["vet"] },
};

const COMMENT_PREFIX_BY_EXT: Record<string, string> = {
  ".ts": "//",
  ".tsx": "//",
  ".js": "//",
  ".jsx": "//",
  ".mjs": "//",
  ".cjs": "//",
  ".rs": "//",
  ".go": "//",
  ".java": "//",
  ".cs": "//",
  ".c": "//",
  ".cpp": "//",
  ".hpp": "//",
  ".h": "//",
  ".swift": "//",
  ".kt": "//",
  ".zig": "//",
  ".py": "#",
  ".rb": "#",
  ".lua": "--",
};

function toIntegerOr(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLineLength(line: string): number {
  return line.replace(/\t/g, "    ").length;
}

function hasDisallowedComment(line: string, prefix: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith(prefix)) return false;
  if (prefix === "#" && (trimmed.startsWith("#!") || trimmed.startsWith("#include"))) return false;
  return true;
}

function scoreFromIssues(issues: SkillIssue[]): number {
  return Math.max(0, 100 - issues.length * 5);
}

async function runCommand(cmd: string, args: string[], cwd: string): Promise<LintResult> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { cwd, timeout: 30_000, maxBuffer: 1024 * 512 });
    return { tool: cmd, output: `${stdout}${stderr}`.trim(), exitCode: 0 };
  } catch (error) {
    const err = error as { code?: number; stdout?: string; stderr?: string };
    return { tool: cmd, output: `${err.stdout ?? ""}${err.stderr ?? ""}`.trim(), exitCode: err.code ?? 1 };
  }
}

async function detectAvailableLinter(rootDir: string, ext: string): Promise<{ cmd: string; args: string[] } | null> {
  const config = LINTER_MAP[ext];
  if (!config) return null;
  if ([".ts", ".tsx"].includes(ext)) {
    try {
      await stat(resolve(rootDir, "tsconfig.json"));
      return config;
    } catch {
      return null;
    }
  }
  if (ext === ".rs") {
    try {
      await stat(resolve(rootDir, "Cargo.toml"));
      return config;
    } catch {
      return null;
    }
  }
  if (ext === ".go") {
    try {
      await stat(resolve(rootDir, "go.mod"));
      return config;
    } catch {
      return null;
    }
  }
  return config;
}

async function evaluateFileSkill(rootDir: string, file: string): Promise<SkillFileScore> {
  const absolutePath = resolve(rootDir, file);
  const ext = extname(file).toLowerCase();
  const prefix = COMMENT_PREFIX_BY_EXT[ext];
  if (!prefix) return { file, score: 100, issues: [] };
  const lines = (await readFile(absolutePath, "utf-8")).split("\n");
  const issues: SkillIssue[] = [];
  if (!lines[0]?.trim().startsWith(prefix)) issues.push({ file, line: 1, reason: "missing first header comment" });
  if (!lines[1]?.trim().startsWith(prefix)) issues.push({ file, line: 2, reason: "missing second header comment" });
  for (let i = 2; i < lines.length; i++) {
    if (hasDisallowedComment(lines[i], prefix)) issues.push({ file, line: i + 1, reason: "comment outside top header" });
    if (normalizeLineLength(lines[i]) > 160) issues.push({ file, line: i + 1, reason: "line too long" });
  }
  return { file, score: scoreFromIssues(issues), issues };
}

async function runSkillChecks(rootDir: string): Promise<string> {
  const entries = await walkDirectory({ rootDir, depthLimit: 0 });
  const files = entries.filter((entry) => !entry.isDirectory).map((entry) => entry.relativePath);
  const scores = await Promise.all(files.map((file) => evaluateFileSkill(rootDir, file)));
  const relevant = scores.filter((item) => item.issues.length > 0 || item.score < 100);
  const totalScore = scores.length === 0
    ? 100
    : Math.round((scores.reduce((sum, item) => sum + item.score, 0) / scores.length) * 10) / 10;
  const lines: string[] = [
    "Skill Report",
    `Project score: ${totalScore}/100`,
    `Files checked: ${scores.length}`,
    `Files needing fixes: ${relevant.length}`,
  ];
  if (relevant.length > 0) {
    lines.push("", "Files and lines needing fixes:");
    for (const item of relevant.sort((a, b) => a.file.localeCompare(b.file))) {
      lines.push(`- ${item.file} (${item.score}/100)`);
      for (const issue of item.issues.slice(0, 20)) lines.push(`  L${issue.line}: ${issue.reason}`);
      if (item.issues.length > 20) lines.push(`  ... ${item.issues.length - 20} more issue(s)`);
    }
  }
  return lines.join("\n");
}

export async function runLint(options: LintOptions): Promise<string> {
  const targetPath = options.targetPath ? resolve(options.rootDir, options.targetPath) : options.rootDir;
  const ext = extname(targetPath);
  if (ext) {
    const linter = await detectAvailableLinter(options.rootDir, ext);
    const skillReport = await runSkillChecks(options.rootDir);
    if (!linter) return [`No linter configured for ${ext}.`, "", skillReport].join("\n");
    const args = [...linter.args, ...([".js", ".ts", ".tsx", ".py"].includes(ext) ? [targetPath] : [])];
    const result = await runCommand(linter.cmd, args, options.rootDir);
    const lintBody = result.exitCode === 0 && !result.output
      ? "No lint issues found."
      : `Lint output (${result.tool}):\n\n${result.output.slice(0, 5000)}`;
    return [lintBody, "", skillReport].join("\n");
  }
  const lintSections: string[] = [];
  for (const extension of Object.keys(LINTER_MAP)) {
    const linter = await detectAvailableLinter(options.rootDir, extension);
    if (!linter) continue;
    const result = await runCommand(linter.cmd, linter.args, options.rootDir);
    if (result.output) lintSections.push(`[${result.tool}] ${extension}:\n${result.output.slice(0, 2000)}`);
  }
  const skillReport = await runSkillChecks(options.rootDir);
  return [
    lintSections.length > 0 ? lintSections.join("\n\n") : "No linters available or no lint output.",
    "",
    skillReport,
  ].join("\n");
}

export async function runStaticAnalysis(options: LintOptions): Promise<string> {
  return runLint(options);
}

export function getLintBatchSize(): number {
  return Math.max(1, toIntegerOr(process.env.CONTEXTPLUS_LINT_BATCH_SIZE, 4));
}
