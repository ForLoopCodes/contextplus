// Static analysis runner using native linters and compilers
// Delegates dead code detection to deterministic tools, not LLM guessing

import { exec } from "child_process";
import { stat } from "fs/promises";
import { resolve, extname } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface StaticAnalysisOptions {
  rootDir: string;
  targetPath?: string;
}

interface LintResult {
  tool: string;
  output: string;
  exitCode: number;
}

const LINTER_MAP: Record<string, { cmd: string; args: string[] }> = {
  ".ts": { cmd: "npx", args: ["tsc", "--noEmit", "--pretty"] },
  ".tsx": { cmd: "npx", args: ["tsc", "--noEmit", "--pretty"] },
  ".js": { cmd: "npx", args: ["eslint", "--no-eslintrc", "--rule", '{"no-unused-vars": "warn"}'] },
  ".py": { cmd: "python", args: ["-m", "py_compile"] },
  ".rs": { cmd: "cargo", args: ["check", "--message-format=short"] },
  ".go": { cmd: "go", args: ["vet"] },
};

async function runCommand(cmd: string, args: string[], cwd: string): Promise<LintResult> {
  const fullCmd = `${cmd} ${args.join(" ")}`;
  try {
    const { stdout, stderr } = await execAsync(fullCmd, { cwd, timeout: 30000, maxBuffer: 1024 * 512 });
    return { tool: cmd, output: (stdout + stderr).trim(), exitCode: 0 };
  } catch (err: any) {
    return { tool: cmd, output: (err.stdout ?? "") + (err.stderr ?? ""), exitCode: err.code ?? 1 };
  }
}

async function detectAvailableLinter(rootDir: string, ext: string): Promise<{ cmd: string; args: string[] } | null> {
  const config = LINTER_MAP[ext];
  if (!config) return null;

  if (ext === ".ts" || ext === ".tsx") {
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

export async function runStaticAnalysis(options: StaticAnalysisOptions): Promise<string> {
  const targetPath = options.targetPath ? resolve(options.rootDir, options.targetPath) : options.rootDir;
  const ext = extname(targetPath);

  if (ext) {
    const linter = await detectAvailableLinter(options.rootDir, ext);
    if (!linter) return `No linter configured for ${ext} files.`;

    const args = [...linter.args];
    if ([".js", ".ts", ".tsx"].includes(ext)) args.push(targetPath);
    else if (ext === ".py") args.push(targetPath);

    const result = await runCommand(linter.cmd, args, options.rootDir);

    if (result.exitCode === 0 && !result.output) return "No issues found. Code is clean.";
    return `Static analysis (${result.tool}):\n\n${result.output.substring(0, 5000)}`;
  }

  const results: string[] = [];
  for (const [fileExt] of Object.entries(LINTER_MAP)) {
    const linter = await detectAvailableLinter(options.rootDir, fileExt);
    if (!linter) continue;

    const result = await runCommand(linter.cmd, linter.args, options.rootDir);
    if (result.output) {
      results.push(`[${result.tool}] ${fileExt} files:\n${result.output.substring(0, 2000)}`);
    }
  }

  return results.length > 0 ? results.join("\n\n") : "No linters available or no issues found.";
}
