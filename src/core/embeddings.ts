// Ollama-powered vector embedding engine with cosine similarity search
// Indexes file headers and symbols, caches embeddings to disk for speed

import { Ollama } from "ollama";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface SearchDocument {
  path: string;
  header: string;
  symbols: string[];
  symbolEntries?: SymbolSearchEntry[];
  content: string;
}

export interface SymbolSearchEntry {
  name: string;
  kind?: string;
  line: number;
  endLine?: number;
  signature?: string;
}

export interface SearchResult {
  path: string;
  score: number;
  semanticScore: number;
  keywordScore: number;
  header: string;
  matchedSymbols: string[];
  matchedSymbolLocations: string[];
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

export interface EmbeddingCache {
  [path: string]: { hash: string; vector: number[] };
}

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const CACHE_DIR = ".mcp_data";
const CACHE_FILE = "embeddings-cache.json";
const MIN_EMBED_BATCH_SIZE = 5;
const MAX_EMBED_BATCH_SIZE = 10;
const DEFAULT_EMBED_BATCH_SIZE = 8;
const MIN_EMBED_INPUT_CHARS = 256;
const SINGLE_INPUT_SHRINK_FACTOR = 0.75;
const MAX_SINGLE_INPUT_RETRIES = 8;

const ollama = new Ollama({ host: process.env.OLLAMA_HOST });

function toIntegerOr(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getEmbeddingBatchSize(): number {
  const requested = toIntegerOr(process.env.CONTEXTPLUS_EMBED_BATCH_SIZE, DEFAULT_EMBED_BATCH_SIZE);
  return Math.min(MAX_EMBED_BATCH_SIZE, Math.max(MIN_EMBED_BATCH_SIZE, requested));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isContextLengthError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("input length exceeds context length")
    || (message.includes("context") && message.includes("exceed"));
}

function shrinkEmbeddingInput(input: string): string {
  if (input.length <= MIN_EMBED_INPUT_CHARS) return input;
  const nextLength = Math.max(MIN_EMBED_INPUT_CHARS, Math.floor(input.length * SINGLE_INPUT_SHRINK_FACTOR));
  if (nextLength >= input.length) return input.slice(0, input.length - 1);
  return input.slice(0, nextLength);
}

async function embedSingleAdaptive(input: string): Promise<number[]> {
  let candidate = input;

  for (let attempt = 0; attempt <= MAX_SINGLE_INPUT_RETRIES; attempt++) {
    try {
      const response = await ollama.embed({ model: EMBED_MODEL, input: [candidate] });
      if (!response.embeddings[0]) throw new Error("Missing embedding vector in Ollama response");
      return response.embeddings[0];
    } catch (error) {
      if (!isContextLengthError(error)) throw error;
      const nextCandidate = shrinkEmbeddingInput(candidate);
      if (nextCandidate.length === candidate.length) throw error;
      candidate = nextCandidate;
    }
  }

  throw new Error("Unable to embed oversized input after adaptive retries");
}

async function embedBatchAdaptive(batch: string[]): Promise<number[][]> {
  try {
    const response = await ollama.embed({ model: EMBED_MODEL, input: batch });
    if (response.embeddings.length !== batch.length) {
      throw new Error(`Embedding response size mismatch: expected ${batch.length}, got ${response.embeddings.length}`);
    }
    return response.embeddings;
  } catch (error) {
    if (!isContextLengthError(error)) throw error;
    if (batch.length === 1) {
      return [await embedSingleAdaptive(batch[0])];
    }
    const middle = Math.ceil(batch.length / 2);
    const left = await embedBatchAdaptive(batch.slice(0, middle));
    const right = await embedBatchAdaptive(batch.slice(middle));
    return [...left, ...right];
  }
}

export async function fetchEmbedding(input: string | string[]): Promise<number[][]> {
  const inputs = Array.isArray(input) ? input : [input];
  if (inputs.length === 0) return [];

  const batchSize = getEmbeddingBatchSize();
  const embeddings: number[][] = [];

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    embeddings.push(...await embedBatchAdaptive(batch));
  }

  return embeddings;
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
  return loadEmbeddingCache(rootDir, CACHE_FILE);
}

async function saveCache(rootDir: string, cache: EmbeddingCache): Promise<void> {
  await saveEmbeddingCache(rootDir, cache, CACHE_FILE);
}

export async function ensureMcpDataDir(rootDir: string): Promise<void> {
  await mkdir(join(rootDir, CACHE_DIR), { recursive: true });
}

export async function loadEmbeddingCache(rootDir: string, fileName: string): Promise<EmbeddingCache> {
  try {
    return JSON.parse(await readFile(join(rootDir, CACHE_DIR, fileName), "utf-8"));
  } catch {
    return {};
  }
}

export async function saveEmbeddingCache(rootDir: string, cache: EmbeddingCache, fileName: string): Promise<void> {
  await ensureMcpDataDir(rootDir);
  await writeFile(join(rootDir, CACHE_DIR, fileName), JSON.stringify(cache));
}

function formatLineRange(line: number, endLine?: number): string {
  if (endLine && endLine > line) return `L${line}-L${endLine}`;
  return `L${line}`;
}

function getMatchedSymbolEntries(symbols: SymbolSearchEntry[], queryTerms: Set<string>): SymbolSearchEntry[] {
  if (queryTerms.size === 0) return [];
  return symbols.filter((symbol) => splitCamelCase(symbol.name).some((term) => queryTerms.has(term)));
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
      const batchSize = getEmbeddingBatchSize();
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
    const scores: {
      idx: number;
      score: number;
      semanticScore: number;
      keywordScore: number;
      matchedSymbols: string[];
      matchedSymbolLocations: string[];
    }[] = [];

    for (let i = 0; i < this.vectors.length; i++) {
      if (!this.vectors[i]) continue;
      const doc = this.documents[i];
      const semanticScore = cosine(queryVec, this.vectors[i]);
      const matchedEntries = doc.symbolEntries ? getMatchedSymbolEntries(doc.symbolEntries, queryTerms) : [];
      const matchedSymbols = matchedEntries.length > 0
        ? matchedEntries.map((entry) => entry.name)
        : getMatchedSymbols(doc.symbols, queryTerms);
      const matchedSymbolLocations = matchedEntries.map((entry) => `${entry.name}@${formatLineRange(entry.line, entry.endLine)}`);
      const keywordScore = computeKeywordScore(query, queryTerms, doc, matchedSymbols);
      const score = computeCombinedScore(semanticScore, keywordScore, options);

      if (options.requireSemanticMatch && semanticScore <= 0) continue;
      if (options.requireKeywordMatch && keywordScore <= 0) continue;
      if (Math.max(semanticScore, 0) < options.minSemanticScore) continue;
      if (keywordScore < options.minKeywordScore) continue;
      if (score < options.minCombinedScore) continue;

      scores.push({ idx: i, score, semanticScore, keywordScore, matchedSymbols, matchedSymbolLocations });
    }

    return scores
      .sort((a, b) => b.score - a.score || b.keywordScore - a.keywordScore || b.semanticScore - a.semanticScore)
      .slice(0, options.topK)
      .map(({ idx, score, semanticScore, keywordScore, matchedSymbols, matchedSymbolLocations }) => {
        const doc = this.documents[idx];
        return {
          path: doc.path,
          score: Math.round(score * 1000) / 10,
          semanticScore: Math.round(Math.max(semanticScore, 0) * 1000) / 10,
          keywordScore: Math.round(keywordScore * 1000) / 10,
          header: doc.header,
          matchedSymbols,
          matchedSymbolLocations,
        };
      });
  }

  getDocumentCount(): number {
    return this.documents.length;
  }
}
