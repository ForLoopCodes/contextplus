// Local semantic search using TF-IDF over file headers and symbol names
// Zero API calls, matches concepts by vocabulary similarity scoring

import { walkDirectory } from "../core/walker.js";
import { analyzeFile, isSupportedFile } from "../core/parser.js";
import { SearchIndex, type SearchDocument } from "../core/embeddings.js";

export interface SemanticSearchOptions {
  rootDir: string;
  query: string;
  topK?: number;
}

let cachedIndex: SearchIndex | null = null;
let cachedRootDir: string | null = null;
let lastIndexTime = 0;

const INDEX_TTL_MS = 30000;

async function buildIndex(rootDir: string): Promise<SearchIndex> {
  if (cachedIndex && cachedRootDir === rootDir && Date.now() - lastIndexTime < INDEX_TTL_MS) {
    return cachedIndex;
  }

  const entries = await walkDirectory({ rootDir, depthLimit: 0 });
  const files = entries.filter((e) => !e.isDirectory && isSupportedFile(e.path));

  const docs: SearchDocument[] = [];
  for (const file of files) {
    try {
      const analysis = await analyzeFile(file.path);
      docs.push({
        path: file.relativePath,
        header: analysis.header,
        symbols: analysis.symbols.flatMap((s) => [s.name, ...s.children.map((c) => c.name)]),
        content: analysis.symbols.map((s) => s.signature).join(" "),
      });
    } catch {
      /* skip unreadable */
    }
  }

  const index = new SearchIndex();
  index.index(docs);
  cachedIndex = index;
  cachedRootDir = rootDir;
  lastIndexTime = Date.now();

  return index;
}

export async function semanticCodeSearch(options: SemanticSearchOptions): Promise<string> {
  const index = await buildIndex(options.rootDir);
  const results = index.search(options.query, options.topK ?? 5);

  if (results.length === 0) return "No matching files found for the given query.";

  const lines: string[] = [`Top ${results.length} semantic matches for: "${options.query}"\n`];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`${i + 1}. ${r.path} (score: ${r.score})`);
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
