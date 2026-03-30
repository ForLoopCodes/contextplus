// Detailed AST analysis tool using tree-sitter for code understanding
// Extracts imports, exports, dependencies, and call graph from source files

import { readFile } from "fs/promises";
import { resolve, extname } from "path";
import { parseWithTreeSitter, getGrammarName } from "../core/tree-sitter.js";

interface ImportInfo { source: string; names: string[]; line: number; }
interface ExportInfo { name: string; kind: string; line: number; }
interface CallInfo { caller: string; callee: string; line: number; }
interface StructureResult {
  file: string;
  language: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  calls: CallInfo[];
  symbolCount: number;
  lineCount: number;
}

function extractImports(content: string, lang: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split("\n");

  if (lang === "typescript" || lang === "tsx" || lang === "javascript") {
    const importRe = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    const requireRe = /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    for (let i = 0; i < lines.length; i++) {
      for (const re of [importRe, requireRe]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(lines[i])) !== null) {
          const names = (m[1] ?? m[2] ?? "").split(",").map(n => n.trim()).filter(Boolean);
          imports.push({ source: m[3], names, line: i + 1 });
        }
      }
    }
  } else if (lang === "python") {
    const fromRe = /from\s+([\w.]+)\s+import\s+(.+)/;
    const importRe = /^import\s+([\w.,\s]+)/;
    for (let i = 0; i < lines.length; i++) {
      const fromMatch = lines[i].match(fromRe);
      if (fromMatch) {
        const names = fromMatch[2].split(",").map(n => n.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        imports.push({ source: fromMatch[1], names, line: i + 1 });
        continue;
      }
      const impMatch = lines[i].match(importRe);
      if (impMatch) {
        const modules = impMatch[1].split(",").map(n => n.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        imports.push({ source: modules.join(", "), names: modules, line: i + 1 });
      }
    }
  } else if (lang === "go") {
    const singleRe = /import\s+"([^"]+)"/;
    const multiStart = /import\s*\(/;
    let inMulti = false;
    for (let i = 0; i < lines.length; i++) {
      if (multiStart.test(lines[i])) { inMulti = true; continue; }
      if (inMulti) {
        if (lines[i].includes(")")) { inMulti = false; continue; }
        const m = lines[i].match(/"([^"]+)"/);
        if (m) imports.push({ source: m[1], names: [m[1].split("/").pop() ?? m[1]], line: i + 1 });
        continue;
      }
      const single = lines[i].match(singleRe);
      if (single) imports.push({ source: single[1], names: [single[1].split("/").pop() ?? single[1]], line: i + 1 });
    }
  } else if (lang === "rust") {
    const useRe = /use\s+([\w:]+)(?:::\{([^}]+)\})?;/g;
    for (let i = 0; i < lines.length; i++) {
      useRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = useRe.exec(lines[i])) !== null) {
        const base = m[1];
        const names = m[2] ? m[2].split(",").map(n => n.trim()).filter(Boolean) : [base.split("::").pop() ?? base];
        imports.push({ source: base, names, line: i + 1 });
      }
    }
  }
  return imports;
}

function extractExports(content: string, lang: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split("\n");

  if (lang === "typescript" || lang === "tsx" || lang === "javascript") {
    const exportRe = /export\s+(?:(default)\s+)?(?:(function|class|const|let|var|interface|type|enum)\s+)?(\w+)?/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(exportRe);
      if (m) exports.push({ name: m[3] ?? (m[1] ? "default" : "unknown"), kind: m[2] ?? "default", line: i + 1 });
    }
  } else if (lang === "python") {
    const defRe = /^(def|class|async\s+def)\s+(\w+)/;
    const allRe = /__all__\s*=\s*\[([^\]]+)\]/;
    for (let i = 0; i < lines.length; i++) {
      const allMatch = lines[i].match(allRe);
      if (allMatch) {
        const names = allMatch[1].split(",").map(n => n.trim().replace(/['"]/g, "")).filter(Boolean);
        names.forEach(name => exports.push({ name, kind: "export", line: i + 1 }));
        continue;
      }
      const defMatch = lines[i].match(defRe);
      if (defMatch && !lines[i].startsWith("  ") && !lines[i].startsWith("\t")) {
        exports.push({ name: defMatch[2], kind: defMatch[1].includes("class") ? "class" : "function", line: i + 1 });
      }
    }
  } else if (lang === "go") {
    const pubRe = /^(?:func|type|var|const)\s+([A-Z]\w*)/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(pubRe);
      if (m) exports.push({ name: m[1], kind: lines[i].startsWith("func") ? "function" : "type", line: i + 1 });
    }
  } else if (lang === "rust") {
    const pubRe = /pub(?:\s*\([^)]*\))?\s+(fn|struct|enum|trait|type|mod|const)\s+(\w+)/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(pubRe);
      if (m) exports.push({ name: m[2], kind: m[1], line: i + 1 });
    }
  }
  return exports;
}

function extractCalls(content: string, lang: string): CallInfo[] {
  const calls: CallInfo[] = [];
  const lines = content.split("\n");
  let currentFn = "module";

  const fnStartRe = lang === "python"
    ? /^(?:def|async\s+def)\s+(\w+)/
    : lang === "go"
      ? /^func\s+(?:\([^)]+\)\s+)?(\w+)/
      : lang === "rust"
        ? /fn\s+(\w+)/
        : /(?:function|async\s+function)\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/;

  const callRe = /(\w+)\s*\(/g;

  for (let i = 0; i < lines.length; i++) {
    const fnMatch = lines[i].match(fnStartRe);
    if (fnMatch) currentFn = fnMatch[1] ?? fnMatch[2] ?? currentFn;

    callRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = callRe.exec(lines[i])) !== null) {
      const callee = m[1];
      if (callee && !["if", "for", "while", "switch", "catch", "function", "return"].includes(callee)) {
        calls.push({ caller: currentFn, callee, line: i + 1 });
      }
    }
  }
  return calls;
}

export async function getCodeStructure(opts: { rootDir: string; filePath: string }): Promise<string> {
  const fullPath = resolve(opts.rootDir, opts.filePath);
  const ext = extname(fullPath);
  const lang = getGrammarName(ext);

  if (!lang) return `Unsupported file type: ${ext}. Supported: .ts, .js, .py, .go, .rs, .java, etc.`;

  let content: string;
  try {
    content = await readFile(fullPath, "utf-8");
  } catch {
    return `File not found: ${opts.filePath}`;
  }

  const symbols = await parseWithTreeSitter(content, ext) ?? [];
  const imports = extractImports(content, lang);
  const exports = extractExports(content, lang);
  const calls = extractCalls(content, lang);
  const lineCount = content.split("\n").length;

  const result: StructureResult = {
    file: opts.filePath,
    language: lang,
    imports,
    exports,
    calls: calls.slice(0, 50),
    symbolCount: symbols.length,
    lineCount,
  };

  const lines: string[] = [
    `# Code Structure: ${result.file}`,
    `Language: ${result.language} | Lines: ${result.lineCount} | Symbols: ${result.symbolCount}`,
    "",
  ];

  if (result.imports.length > 0) {
    lines.push(`## Imports (${result.imports.length})`);
    result.imports.forEach(i => lines.push(`  L${i.line}: ${i.source} -> ${i.names.join(", ")}`));
    lines.push("");
  }

  if (result.exports.length > 0) {
    lines.push(`## Exports (${result.exports.length})`);
    result.exports.forEach(e => lines.push(`  L${e.line}: ${e.kind} ${e.name}`));
    lines.push("");
  }

  if (result.calls.length > 0) {
    lines.push(`## Call Graph (top ${result.calls.length})`);
    const grouped = new Map<string, string[]>();
    result.calls.forEach(c => {
      if (!grouped.has(c.caller)) grouped.set(c.caller, []);
      grouped.get(c.caller)!.push(c.callee);
    });
    grouped.forEach((callees, caller) => {
      const unique = [...new Set(callees)];
      lines.push(`  ${caller} -> ${unique.join(", ")}`);
    });
  }

  return lines.join("\n");
}
