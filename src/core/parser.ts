// Multi-language symbol extraction with tree-sitter AST + regex fallback
// Supports 36 languages via WASM grammars, regex fallback for unsupported

import { readFile } from "fs/promises";
import { extname } from "path";
import { parseWithTreeSitter, getSupportedExtensions } from "./tree-sitter.js";

export enum SymbolKind {
  Function = "function",
  Class = "class",
  Method = "method",
  Enum = "enum",
  Interface = "interface",
  Struct = "struct",
  Type = "type",
  Trait = "trait",
  Const = "const",
  Variable = "variable",
  Export = "export",
}

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  line: number;
  endLine: number;
  signature: string;
  children: CodeSymbol[];
}

export interface SymbolLocation {
  name: string;
  kind: SymbolKind;
  line: number;
  endLine: number;
  signature: string;
  parentName?: string;
}

export interface FileAnalysis {
  path: string;
  header: string;
  symbols: CodeSymbol[];
  lineCount: number;
}

const LANG_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".cs": "csharp",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".rb": "ruby",
  ".swift": "swift",
  ".kt": "kotlin",
  ".lua": "lua",
  ".zig": "zig",
};

const TS_PATTERNS: RegExp[] = [
  /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^\n{]+))?/,
  /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/,
  /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/,
  /^(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s<>]+)?/,
  /^(?:export\s+)?type\s+(\w+)\s*(?:<[^>]*>)?\s*=/,
  /^(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=/,
];

const PY_PATTERNS: RegExp[] = [
  /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\S+))?/,
  /^class\s+(\w+)(?:\(([^)]*)\))?/,
];

const RS_PATTERNS: RegExp[] = [
  /^(?:pub(?:\(crate\))?\s+)?(?:async\s+)?fn\s+(\w+)(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*([^\n{]+))?/,
  /^(?:pub(?:\(crate\))?\s+)?struct\s+(\w+)(?:<[^>]*>)?/,
  /^(?:pub(?:\(crate\))?\s+)?enum\s+(\w+)(?:<[^>]*>)?/,
  /^(?:pub(?:\(crate\))?\s+)?trait\s+(\w+)(?:<[^>]*>)?/,
  /^impl(?:<[^>]*>)?\s+(\w+)/,
];

const GO_PATTERNS: RegExp[] = [
  /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*(?:\(([^)]*)\)|(\w+)))?/,
  /^type\s+(\w+)\s+struct/,
  /^type\s+(\w+)\s+interface/,
];

const JAVA_PATTERNS: RegExp[] = [
  /^(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?(?:final\s+)?(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*\(/,
  /^(?:public|private|protected)?\s*(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/,
  /^(?:public|private|protected)?\s*(?:abstract\s+)?interface\s+(\w+)/,
  /^(?:public|private|protected)?\s*enum\s+(\w+)/,
];

function detectLanguage(filePath: string): string | null {
  return LANG_MAP[extname(filePath).toLowerCase()] ?? null;
}

function extractHeader(lines: string[]): string {
  const headerLines: string[] = [];
  for (const line of lines.slice(0, 10)) {
    const stripped = line.replace(/^\/\/\s?|^#\s?|^--\s?|^\*\s?|^\/\*\*?\s?|\*\/$/g, "").trim();
    if (stripped && !stripped.startsWith("!") && !stripped.startsWith("use ") && !stripped.startsWith("import ")) {
      headerLines.push(stripped);
      if (headerLines.length >= 2) break;
    }
  }
  return headerLines.join(" | ");
}

function matchPatterns(line: string, patterns: RegExp[], kindMap: SymbolKind[]): CodeSymbol | null {
  for (let i = 0; i < patterns.length; i++) {
    const match = line.match(patterns[i]);
    if (match?.[1]) {
      return {
        name: match[1],
        kind: kindMap[i] ?? SymbolKind.Function,
        line: 0,
        endLine: 0,
        signature: line.trim().replace(/\s*\{?\s*$/, ""),
        children: [],
      };
    }
  }
  return null;
}

function findBraceBlockEnd(lines: string[], startIndex: number): number {
  let depth = 0;
  let seenOpening = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        seenOpening = true;
      } else if (ch === "}" && seenOpening) {
        depth--;
        if (depth <= 0) return i + 1;
      }
    }
  }

  return startIndex + 1;
}

function findIndentBlockEnd(lines: string[], startIndex: number, baseIndent: number): number {
  for (let i = startIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const indent = raw.length - raw.trimStart().length;
    if (indent <= baseIndent) return i;
  }
  return lines.length;
}

function parseTypeScript(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const kindMap = [SymbolKind.Function, SymbolKind.Class, SymbolKind.Enum, SymbolKind.Interface, SymbolKind.Type, SymbolKind.Const];
  let currentClass: CodeSymbol | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    if (indent === 0 || trimmed.startsWith("export ")) {
      const sym = matchPatterns(trimmed, TS_PATTERNS, kindMap);
      if (sym) {
        sym.line = i + 1;
        if ([SymbolKind.Function, SymbolKind.Class, SymbolKind.Interface, SymbolKind.Enum].includes(sym.kind)) {
          sym.endLine = findBraceBlockEnd(lines, i);
        } else {
          sym.endLine = i + 1;
        }
        if (sym.kind === SymbolKind.Class) currentClass = sym;
        else currentClass = null;
        symbols.push(sym);
        continue;
      }
    }

    if (currentClass && indent >= 2) {
      const methodMatch = trimmed.match(
        /^(?:public|private|protected|static|async|readonly|\s)*\s*(?:get|set\s+)?(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^\n{]+))?/,
      );
      if (methodMatch?.[1] && !["if", "for", "while", "switch", "return", "throw", "new", "delete"].includes(methodMatch[1])) {
        currentClass.children.push({
          name: methodMatch[1],
          kind: SymbolKind.Method,
          line: i + 1,
          endLine: findBraceBlockEnd(lines, i),
          signature: trimmed.replace(/\s*\{?\s*$/, ""),
          children: [],
        });
      }
    }
  }
  return symbols;
}

function parsePython(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const kindMap = [SymbolKind.Function, SymbolKind.Class];
  let currentClass: CodeSymbol | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    if (indent === 0) {
      const sym = matchPatterns(trimmed, PY_PATTERNS, kindMap);
      if (sym) {
        sym.line = i + 1;
        sym.endLine = findIndentBlockEnd(lines, i, indent);
        if (sym.kind === SymbolKind.Class) currentClass = sym;
        else currentClass = null;
        symbols.push(sym);
      }
    } else if (currentClass && indent >= 4 && trimmed.startsWith("def ")) {
      const methodMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(\S+))?/);
      if (methodMatch?.[1]) {
        currentClass.children.push({
          name: methodMatch[1],
          kind: SymbolKind.Method,
          line: i + 1,
          endLine: findIndentBlockEnd(lines, i, indent),
          signature: trimmed.replace(/\s*:\s*$/, ""),
          children: [],
        });
      }
    }
  }
  return symbols;
}

function parseRust(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const kindMap = [SymbolKind.Function, SymbolKind.Struct, SymbolKind.Enum, SymbolKind.Trait, SymbolKind.Class];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const sym = matchPatterns(trimmed, RS_PATTERNS, kindMap);
    if (sym) {
      sym.line = i + 1;
      sym.endLine = findBraceBlockEnd(lines, i);
      symbols.push(sym);
    }
  }
  return symbols;
}

function parseGo(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const kindMap = [SymbolKind.Function, SymbolKind.Struct, SymbolKind.Interface];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const sym = matchPatterns(trimmed, GO_PATTERNS, kindMap);
    if (sym) {
      sym.line = i + 1;
      sym.endLine = findBraceBlockEnd(lines, i);
      symbols.push(sym);
    }
  }
  return symbols;
}

function parseJava(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const kindMap = [SymbolKind.Method, SymbolKind.Class, SymbolKind.Interface, SymbolKind.Enum];
  let currentClass: CodeSymbol | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;

    if (indent <= 0) {
      const sym = matchPatterns(trimmed, JAVA_PATTERNS, kindMap);
      if (sym && (sym.kind === SymbolKind.Class || sym.kind === SymbolKind.Interface || sym.kind === SymbolKind.Enum)) {
        sym.line = i + 1;
        sym.endLine = findBraceBlockEnd(lines, i);
        currentClass = sym;
        symbols.push(sym);
      }
    } else if (currentClass && indent >= 2) {
      const sym = matchPatterns(trimmed, JAVA_PATTERNS, kindMap);
      if (sym && sym.kind === SymbolKind.Method) {
        sym.line = i + 1;
        sym.endLine = findBraceBlockEnd(lines, i);
        currentClass.children.push(sym);
      }
    }
  }
  return symbols;
}

function parseGeneric(lines: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const genericPatterns = [
    /^(?:pub\s+)?(?:export\s+)?(?:async\s+)?(?:fn|func|function|def)\s+(\w+)/,
    /^(?:pub\s+)?(?:export\s+)?(?:class|struct)\s+(\w+)/,
    /^(?:pub\s+)?(?:export\s+)?(?:enum|interface|type|trait)\s+(\w+)/,
  ];
  const kindMap = [SymbolKind.Function, SymbolKind.Class, SymbolKind.Enum];

  for (let i = 0; i < lines.length; i++) {
    const sym = matchPatterns(lines[i].trimStart(), genericPatterns, kindMap);
    if (sym) {
      sym.line = i + 1;
      sym.endLine = findBraceBlockEnd(lines, i);
      symbols.push(sym);
    }
  }
  return symbols;
}

export async function analyzeFile(filePath: string): Promise<FileAnalysis> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const ext = extname(filePath).toLowerCase();

  let symbols: CodeSymbol[] | null = null;
  try {
    symbols = await parseWithTreeSitter(content, ext);
  } catch {
    symbols = null;
  }

  if (!symbols) {
    const lang = detectLanguage(filePath);
    const parsers: Record<string, (l: string[]) => CodeSymbol[]> = {
      typescript: parseTypeScript,
      javascript: parseTypeScript,
      python: parsePython,
      rust: parseRust,
      go: parseGo,
      java: parseJava,
      csharp: parseJava,
      kotlin: parseJava,
    };
    symbols = (parsers[lang ?? ""] ?? parseGeneric)(lines);
  }

  return {
    path: filePath,
    header: extractHeader(lines),
    symbols,
    lineCount: lines.length,
  };
}

export function formatSymbol(sym: CodeSymbol, indent: number = 0): string {
  const prefix = "  ".repeat(indent);
  const kindLabel = sym.kind === SymbolKind.Method ? "method" : sym.kind;
  const lineLabel = sym.endLine > sym.line ? `L${sym.line}-L${sym.endLine}` : `L${sym.line}`;
  let result = `${prefix}${kindLabel}: ${sym.name} (${lineLabel})`;

  if (sym.kind === SymbolKind.Function || sym.kind === SymbolKind.Method) {
    result = `${prefix}${kindLabel}: ${sym.signature} (${lineLabel})`;
  }

  for (const child of sym.children) {
    result += "\n" + formatSymbol(child, indent + 1);
  }
  return result;
}

export function isSupportedFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  if (detectLanguage(filePath) !== null) return true;
  return getSupportedExtensions().includes(ext);
}

export function flattenSymbols(symbols: CodeSymbol[], parentName?: string): SymbolLocation[] {
  const out: SymbolLocation[] = [];
  for (const sym of symbols) {
    out.push({
      name: sym.name,
      kind: sym.kind,
      line: sym.line,
      endLine: sym.endLine,
      signature: sym.signature,
      parentName,
    });
    if (sym.children.length > 0) {
      out.push(...flattenSymbols(sym.children, sym.name));
    }
  }
  return out;
}
