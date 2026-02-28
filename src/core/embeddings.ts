// Ollama-powered vector embedding engine with cosine similarity search
// Indexes file headers and symbols, caches embeddings to disk for speed

import { Ollama } from "ollama";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface SearchDocument {
  path: string;
  header: string;
  symbols: string[];
  content: string;
}

export interface SearchResult {
  path: string;
  score: number;
  semanticScore: number;
  keywordScore: number;
  header: string;
  matchedSymbols: string[];
}

export interface SearchQueryOptions {
  topK?: number;
  semanticWeight?: number;
  keywordWeight?: number;
  minSemanticScore?: number;
  minKeywordScore?: number;
  minCombinedScore?: number;
  requireKeywordMatch?: boolean;
  requireSemanticMatch?: boolean;
}

interface ResolvedSearchQueryOptions {
  topK: number;
  semanticWeight: number;
  keywordWeight: number;
  minSemanticScore: number;
  minKeywordScore: number;
  minCombinedScore: number;
  requireKeywordMatch: boolean;
  requireSemanticMatch: boolean;
}

interface EmbeddingCache {
  [path: string]: { hash: string; vector: number[] };
}

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const CACHE_DIR = ".mcp_data";
const CACHE_FILE = "embeddings-cache.json";

const ollama = new Ollama();

export async function fetchEmbedding(input: string | string[]): Promise<number[][]> {
  const inputs = Array.isArray(input) ? input : [input];
  const response = await ollama.embed({ model: EMBED_MODEL, input: inputs });
  return response.embeddings;
}

function hashContent(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return h.toString(36);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function splitCamelCase(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter((t) => t.length > 1);
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeThreshold(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  if (value > 1) return clamp01(value / 100);
  return clamp01(value);
}

function normalizeWeight(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return fallback;
  return value;
}

function normalizeTopK(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function resolveSearchOptions(optionsOrTopK?: number | SearchQueryOptions): ResolvedSearchQueryOptions {
  const raw = typeof optionsOrTopK === "number" ? { topK: optionsOrTopK } : (optionsOrTopK ?? {});
  return {
    topK: normalizeTopK(raw.topK, 5),
    semanticWeight: normalizeWeight(raw.semanticWeight, 0.72),
    keywordWeight: normalizeWeight(raw.keywordWeight, 0.28),
    minSemanticScore: normalizeThreshold(raw.minSemanticScore, 0),
    minKeywordScore: normalizeThreshold(raw.minKeywordScore, 0),
    minCombinedScore: normalizeThreshold(raw.minCombinedScore, 0.1),
    requireKeywordMatch: raw.requireKeywordMatch ?? false,
    requireSemanticMatch: raw.requireSemanticMatch ?? false,
  };
}

function getTermCoverage(queryTerms: Set<string>, docTerms: Set<string>): number {
  if (queryTerms.size === 0) return 0;
  let matched = 0;
  for (const term of queryTerms) {
    if (docTerms.has(term)) matched++;
  }
  return matched / queryTerms.size;
}

function getMatchedSymbols(symbols: string[], queryTerms: Set<string>): string[] {
  if (queryTerms.size === 0) return [];
  return symbols.filter((symbol) => splitCamelCase(symbol).some((term) => queryTerms.has(term)));
}

function computeKeywordScore(query: string, queryTerms: Set<string>, doc: SearchDocument, matchedSymbols: string[]): number {
  if (queryTerms.size === 0) return 0;
  const docText = `${doc.path} ${doc.header} ${doc.symbols.join(" ")} ${doc.content}`;
  const docTerms = new Set(splitCamelCase(docText));
  const queryLower = query.trim().toLowerCase();
  const phraseBoost = queryLower.length > 0 && docText.toLowerCase().includes(queryLower) ? 0.15 : 0;
  const symbolTerms = new Set(splitCamelCase(matchedSymbols.join(" ")));
  const termCoverage = getTermCoverage(queryTerms, docTerms);
  const symbolCoverage = getTermCoverage(queryTerms, symbolTerms);
  return clamp01(termCoverage * 0.65 + symbolCoverage * 0.2 + phraseBoost);
}

function computeCombinedScore(semanticScore: number, keywordScore: number, options: ResolvedSearchQueryOptions): number {
  const semanticComponent = Math.max(semanticScore, 0);
  const totalWeight = options.semanticWeight + options.keywordWeight;
  if (totalWeight <= 0) return semanticComponent;
  return clamp01((options.semanticWeight * semanticComponent + options.keywordWeight * keywordScore) / totalWeight);
}

async function loadCache(rootDir: string): Promise<EmbeddingCache> {
  try {
    return JSON.parse(await readFile(join(rootDir, CACHE_DIR, CACHE_FILE), "utf-8"));
  } catch {
    return {};
  }
}

async function saveCache(rootDir: string, cache: EmbeddingCache): Promise<void> {
  await mkdir(join(rootDir, CACHE_DIR), { recursive: true });
  await writeFile(join(rootDir, CACHE_DIR, CACHE_FILE), JSON.stringify(cache));
}

export class SearchIndex {
  private documents: SearchDocument[] = [];
  private vectors: number[][] = [];
  async index(docs: SearchDocument[], rootDir: string): Promise<void> {
    this.documents = docs;
    const cache = await loadCache(rootDir);
    const uncached: { idx: number; text: string; hash: string }[] = [];

    this.vectors = new Array(docs.length);

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      const text = `${doc.header} ${doc.symbols.join(" ")} ${doc.content}`;
      const hash = hashContent(text);

      if (cache[doc.path]?.hash === hash) {
        this.vectors[i] = cache[doc.path].vector;
      } else {
        uncached.push({ idx: i, text, hash });
      }
    }

    if (uncached.length > 0) {
      const batchSize = 32;
      for (let b = 0; b < uncached.length; b += batchSize) {
        const batch = uncached.slice(b, b + batchSize);
        const embeddings = await fetchEmbedding(batch.map((u) => u.text));
        for (let j = 0; j < batch.length; j++) {
          this.vectors[batch[j].idx] = embeddings[j];
          cache[docs[batch[j].idx].path] = { hash: batch[j].hash, vector: embeddings[j] };
        }
      }
      await saveCache(rootDir, cache);
    }
  }

  async search(query: string, optionsOrTopK?: number | SearchQueryOptions): Promise<SearchResult[]> {
    const options = resolveSearchOptions(optionsOrTopK);
    const [queryVec] = await fetchEmbedding(query);
    const queryTerms = new Set(splitCamelCase(query));
    const scores: { idx: number; score: number; semanticScore: number; keywordScore: number; matchedSymbols: string[] }[] = [];

    for (let i = 0; i < this.vectors.length; i++) {
      if (!this.vectors[i]) continue;
      const doc = this.documents[i];
      const semanticScore = cosine(queryVec, this.vectors[i]);
      const matchedSymbols = getMatchedSymbols(doc.symbols, queryTerms);
      const keywordScore = computeKeywordScore(query, queryTerms, doc, matchedSymbols);
      const score = computeCombinedScore(semanticScore, keywordScore, options);

      if (options.requireSemanticMatch && semanticScore <= 0) continue;
      if (options.requireKeywordMatch && keywordScore <= 0) continue;
      if (Math.max(semanticScore, 0) < options.minSemanticScore) continue;
      if (keywordScore < options.minKeywordScore) continue;
      if (score < options.minCombinedScore) continue;

      scores.push({ idx: i, score, semanticScore, keywordScore, matchedSymbols });
    }

    return scores
      .sort((a, b) => b.score - a.score || b.keywordScore - a.keywordScore || b.semanticScore - a.semanticScore)
      .slice(0, options.topK)
      .map(({ idx, score, semanticScore, keywordScore, matchedSymbols }) => {
        const doc = this.documents[idx];
        return {
          path: doc.path,
          score: Math.round(score * 1000) / 10,
          semanticScore: Math.round(Math.max(semanticScore, 0) * 1000) / 10,
          keywordScore: Math.round(keywordScore * 1000) / 10,
          header: doc.header,
          matchedSymbols,
        };
      });
  }

  getDocumentCount(): number {
    return this.documents.length;
  }
}
