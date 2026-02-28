// Ollama-powered semantic search over file headers and symbol names
// Uses vector embeddings with cosine similarity for concept matching

import { walkDirectory } from "../core/walker.js";
import { analyzeFile, isSupportedFile } from "../core/parser.js";
import { SearchIndex, type SearchDocument, type SearchQueryOptions } from "../core/embeddings.js";
import { readFile } from "fs/promises";
import { extname } from "path";

export interface SemanticSearchOptions {
  rootDir: string;
  query: string;
  topK?: number;
  semanticWeight?: number;
  keywordWeight?: number;
  minSemanticScore?: number;
  minKeywordScore?: number;
  minCombinedScore?: number;
  requireKeywordMatch?: boolean;
  requireSemanticMatch?: boolean;
}

let cachedIndex: SearchIndex | null = null;
let cachedRootDir: string | null = null;
let lastIndexTime = 0;

const INDEX_TTL_MS = 60000;
const TEXT_INDEX_EXTENSIONS = new Set([".md", ".txt", ".json", ".jsonc", ".yaml", ".yml", ".toml", ".lock", ".env"]);
const MAX_TEXT_DOC_CHARS = 4000;

function isTextIndexCandidate(filePath: string): boolean {
  return TEXT_INDEX_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function extractPlainTextHeader(content: string): string {
  const lines = content.split("\n");
  const headerLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    headerLines.push(trimmed.slice(0, 120));
    if (headerLines.length >= 2) break;
  }
  return headerLines.join(" | ");
}

async function buildIndex(rootDir: string): Promise<SearchIndex> {
  if (cachedIndex && cachedRootDir === rootDir && Date.now() - lastIndexTime < INDEX_TTL_MS) {
    return cachedIndex;
  }

  const entries = await walkDirectory({ rootDir, depthLimit: 0 });
  const files = entries.filter((e) => !e.isDirectory);

  const docs: SearchDocument[] = [];
  for (const file of files) {
    if (isSupportedFile(file.path)) {
      try {
        const analysis = await analyzeFile(file.path);
        docs.push({
          path: file.relativePath,
          header: analysis.header,
          symbols: analysis.symbols.flatMap((s) => [s.name, ...s.children.map((c) => c.name)]),
          content: analysis.symbols.map((s) => s.signature).join(" "),
        });
      } catch {
      }
      continue;
    }

    if (!isTextIndexCandidate(file.path)) continue;

    try {
      const raw = await readFile(file.path, "utf-8");
      const content = raw.slice(0, MAX_TEXT_DOC_CHARS);
      docs.push({
        path: file.relativePath,
        header: extractPlainTextHeader(content),
        symbols: [],
        content,
      });
    } catch {
    }
  }

  const index = new SearchIndex();
  await index.index(docs, rootDir);
  cachedIndex = index;
  cachedRootDir = rootDir;
  lastIndexTime = Date.now();

  return index;
}

export async function semanticCodeSearch(options: SemanticSearchOptions): Promise<string> {
  const index = await buildIndex(options.rootDir);
  const searchOptions: SearchQueryOptions = {
    topK: options.topK,
    semanticWeight: options.semanticWeight,
    keywordWeight: options.keywordWeight,
    minSemanticScore: options.minSemanticScore,
    minKeywordScore: options.minKeywordScore,
    minCombinedScore: options.minCombinedScore,
    requireKeywordMatch: options.requireKeywordMatch,
    requireSemanticMatch: options.requireSemanticMatch,
  };
  const results = await index.search(options.query, searchOptions);

  if (results.length === 0) return "No matching files found for the given query.";

  const lines: string[] = [`Top ${results.length} hybrid matches for: "${options.query}"\n`];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`${i + 1}. ${r.path} (${r.score}% total)`);
    lines.push(`   Semantic: ${r.semanticScore}% | Keyword: ${r.keywordScore}%`);
    if (r.header) lines.push(`   Header: ${r.header}`);
    if (r.matchedSymbols.length > 0) lines.push(`   Matched symbols: ${r.matchedSymbols.join(", ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function invalidateSearchCache(): void {
  cachedIndex = null;
  cachedRootDir = null;
  lastIndexTime = 0;
}
