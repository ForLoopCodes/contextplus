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
  header: string;
  matchedSymbols: string[];
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

  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    const [queryVec] = await fetchEmbedding(query);
    const scores: { idx: number; score: number }[] = [];

    for (let i = 0; i < this.vectors.length; i++) {
      if (!this.vectors[i]) continue;
      const score = cosine(queryVec, this.vectors[i]);
      if (score > 0.1) scores.push({ idx: i, score });
    }

    const queryTerms = new Set(splitCamelCase(query));
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ idx, score }) => {
        const doc = this.documents[idx];
        return {
          path: doc.path,
          score: Math.round(score * 1000) / 10,
          header: doc.header,
          matchedSymbols: doc.symbols.filter((s) => splitCamelCase(s).some((t) => queryTerms.has(t))),
        };
      });
  }

  getDocumentCount(): number {
    return this.documents.length;
  }
}
