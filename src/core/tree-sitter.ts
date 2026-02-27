// Web-tree-sitter based multi-language parser using WASM grammars
// Supports 36 languages via tree-sitter-wasms, extracts symbols from AST

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { CodeSymbol, SymbolKind } from "./parser.js";

type TSParser = any;
type TSLanguage = any;
type TSNode = any;

const GRAMMAR_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../node_modules/tree-sitter-wasms/out");

const EXT_TO_GRAMMAR: Record<string, string> = {
  ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "javascript",
  ".mjs": "javascript", ".cjs": "javascript", ".py": "python", ".rs": "rust",
  ".go": "go", ".java": "java", ".c": "c", ".h": "c", ".cpp": "cpp",
  ".hpp": "cpp", ".cc": "cpp", ".cs": "c_sharp", ".rb": "ruby", ".php": "php",
  ".swift": "swift", ".kt": "kotlin", ".kts": "kotlin", ".lua": "lua",
  ".dart": "dart", ".ex": "elixir", ".exs": "elixir", ".elm": "elm",
  ".ml": "ocaml", ".scala": "scala", ".sc": "scala", ".sol": "solidity",
  ".zig": "zig", ".vue": "vue", ".sh": "bash", ".bash": "bash", ".zsh": "bash",
  ".toml": "toml", ".yaml": "yaml", ".yml": "yaml", ".json": "json",
  ".html": "html", ".css": "css", ".m": "objc", ".re": "rescript",
};

const DEFINITION_TYPES: Record<string, Record<string, string>> = {
  typescript: {
    function_declaration: "function", method_definition: "method",
    class_declaration: "class", interface_declaration: "interface",
    enum_declaration: "enum", type_alias_declaration: "type",
    lexical_declaration: "const",
  },
  javascript: {
    function_declaration: "function", method_definition: "method",
    class_declaration: "class", variable_declaration: "const",
  },
  tsx: {
    function_declaration: "function", method_definition: "method",
    class_declaration: "class", interface_declaration: "interface",
    enum_declaration: "enum", type_alias_declaration: "type",
  },
  python: {
    function_definition: "function", class_definition: "class",
  },
  rust: {
    function_item: "function", struct_item: "struct",
    enum_item: "enum", trait_item: "trait", impl_item: "class",
  },
  go: {
    function_declaration: "function", method_declaration: "method",
    type_spec: "type",
  },
  java: {
    method_declaration: "method", class_declaration: "class",
    interface_declaration: "interface", enum_declaration: "enum",
  },
  c: {
    function_definition: "function", struct_specifier: "struct",
    enum_specifier: "enum",
  },
  cpp: {
    function_definition: "function", class_specifier: "class",
    struct_specifier: "struct", enum_specifier: "enum",
  },
  c_sharp: {
    method_declaration: "method", class_declaration: "class",
    interface_declaration: "interface", enum_declaration: "enum",
    struct_declaration: "struct",
  },
  ruby: {},
  lua: {},
  dart: {},
  elixir: {},
  php: {
    function_definition: "function", method_declaration: "method",
    class_declaration: "class", interface_declaration: "interface",
    enum_declaration: "enum",
  },
  swift: {
    function_declaration: "function", class_declaration: "class",
    struct_declaration: "struct", enum_declaration: "enum",
    protocol_declaration: "interface",
  },
  kotlin: {
    function_declaration: "function", class_declaration: "class",
    object_declaration: "class", interface_delegation: "interface",
  },

  scala: {
    function_definition: "function", class_definition: "class",
    trait_definition: "trait", object_definition: "class",
  },
  solidity: {
    function_definition: "function", contract_declaration: "class",
    struct_declaration: "struct", enum_declaration: "enum",
    event_definition: "export",
  },
  zig: {
    function_declaration: "function",
  },
  bash: {
    function_definition: "function",
  },
  ocaml: {
    let_binding: "function", type_binding: "type",
  },
};

let ParserClass: any = null;
const grammarCache = new Map<string, TSLanguage>();

async function initParser(): Promise<typeof ParserClass> {
  if (ParserClass) return ParserClass;

  const mod = await import("web-tree-sitter");
  const Parser = mod.default ?? mod;
  await Parser.init();
  ParserClass = Parser;
  return Parser;
}

async function loadGrammar(grammarName: string): Promise<TSLanguage | null> {
  if (grammarCache.has(grammarName)) return grammarCache.get(grammarName)!;

  try {
    const Parser = await initParser();
    const wasmPath = join(GRAMMAR_DIR, `tree-sitter-${grammarName}.wasm`);
    await readFile(wasmPath);
    const lang = await Parser.Language.load(wasmPath);
    grammarCache.set(grammarName, lang);
    return lang;
  } catch {
    return null;
  }
}

function extractName(node: TSNode, _kind: string): string {
  const nameNode = node.childForFieldName("name")
    ?? node.childForFieldName("declarator")
    ?? node.namedChildren?.find((c: TSNode) =>
      c.type === "identifier" || c.type === "type_identifier"
      || c.type === "property_identifier" || c.type === "simple_identifier"
    );

  if (nameNode) {
    if (nameNode.type === "function_declarator" || nameNode.type === "pointer_declarator") {
      const inner = nameNode.childForFieldName("declarator") ?? nameNode.namedChildren?.[0];
      if (inner) return inner.text;
    }
    return nameNode.text;
  }

  for (const child of node.namedChildren ?? []) {
    if (child.type === "variable_declarator" || child.type === "const_declaration") {
      const inner = child.childForFieldName("name");
      if (inner) return inner.text;
    }
  }

  return node.text.split(/[\s({]/)[0]?.trim() ?? "anonymous";
}

function extractSignature(node: TSNode): string {
  const lines = node.text.split("\n");
  const firstLine = lines[0].trim();
  return firstLine.length > 150 ? firstLine.substring(0, 150) + "..." : firstLine;
}

function mapKind(typeStr: string): SymbolKind {
  const kinds: Record<string, string> = {
    function: "function", method: "method", class: "class",
    struct: "struct", enum: "enum", interface: "interface",
    type: "type", trait: "trait", const: "const", variable: "variable",
    export: "export",
  };
  return (kinds[typeStr] ?? "function") as SymbolKind;
}

function walkTree(rootNode: TSNode, defTypes: Record<string, string>, maxDepth: number = 3): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  function visit(node: TSNode, depth: number, parent: CodeSymbol | null): void {
    if (depth > maxDepth) return;

    const kindStr = defTypes[node.type];
    if (kindStr) {
      const sym: CodeSymbol = {
        name: extractName(node, kindStr),
        kind: mapKind(kindStr),
        line: node.startPosition.row + 1,
        signature: extractSignature(node),
        children: [],
      };

      if (parent && depth > 0) {
        parent.children.push(sym);
      } else {
        symbols.push(sym);
      }

      for (const child of node.namedChildren ?? []) {
        visit(child, depth + 1, sym);
      }
      return;
    }

    for (const child of node.namedChildren ?? []) {
      visit(child, depth, parent);
    }
  }

  visit(rootNode, 0, null);
  return symbols;
}

export function getGrammarName(ext: string): string | null {
  return EXT_TO_GRAMMAR[ext.toLowerCase()] ?? null;
}

export async function parseWithTreeSitter(content: string, ext: string): Promise<CodeSymbol[] | null> {
  const grammarName = getGrammarName(ext);
  if (!grammarName) return null;

  const defTypes = DEFINITION_TYPES[grammarName];
  if (!defTypes) return null;

  const lang = await loadGrammar(grammarName);
  if (!lang) return null;

  let parser: TSParser | null = null;
  let tree: any = null;
  try {
    const Parser = await initParser();
    parser = new Parser();
    parser.setLanguage(lang);
    tree = parser.parse(content);
    return walkTree(tree.rootNode, defTypes);
  } catch {
    return null;
  } finally {
    tree?.delete?.();
    parser?.delete?.();
  }
}

export function getSupportedExtensions(): string[] {
  return Object.keys(EXT_TO_GRAMMAR);
}
