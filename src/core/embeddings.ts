// TF-IDF based local semantic search for file headers and symbols
// Zero external API calls, indexes 2-line headers with BM25 scoring

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

interface TermFrequency {
  [term: string]: number;
}

const BM25_K1 = 1.5;
const BM25_B = 0.75;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function splitCamelCase(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter((t) => t.length > 1);
}

function computeTF(tokens: string[]): TermFrequency {
  const tf: TermFrequency = {};
  for (const token of tokens) tf[token] = (tf[token] ?? 0) + 1;
  return tf;
}

export class SearchIndex {
  private documents: SearchDocument[] = [];
  private documentTFs: TermFrequency[] = [];
  private idf: TermFrequency = {};
  private avgDocLength = 0;

  index(docs: SearchDocument[]): void {
    this.documents = docs;
    const docFreq: TermFrequency = {};
    const allTFs: TermFrequency[] = [];

    let totalTokens = 0;
    for (const doc of docs) {
      const tokens = [
        ...tokenize(doc.header),
        ...doc.symbols.flatMap(splitCamelCase),
        ...tokenize(doc.content),
      ];
      const tf = computeTF(tokens);
      allTFs.push(tf);
      totalTokens += tokens.length;
      for (const term of new Set(tokens)) docFreq[term] = (docFreq[term] ?? 0) + 1;
    }

    this.documentTFs = allTFs;
    this.avgDocLength = docs.length > 0 ? totalTokens / docs.length : 0;

    const n = docs.length;
    for (const [term, df] of Object.entries(docFreq)) {
      this.idf[term] = Math.log((n - df + 0.5) / (df + 0.5) + 1);
    }
  }

  search(query: string, topK: number = 5): SearchResult[] {
    const queryTokens = [...tokenize(query), ...splitCamelCase(query)];
    const scores: { idx: number; score: number }[] = [];

    for (let i = 0; i < this.documents.length; i++) {
      const tf = this.documentTFs[i];
      const docLen = Object.values(tf).reduce((a, b) => a + b, 0);
      let score = 0;

      for (const term of queryTokens) {
        const termTF = tf[term] ?? 0;
        const termIDF = this.idf[term] ?? 0;
        score += termIDF * ((termTF * (BM25_K1 + 1)) / (termTF + BM25_K1 * (1 - BM25_B + (BM25_B * docLen) / this.avgDocLength)));
      }

      if (score > 0) scores.push({ idx: i, score });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ idx, score }) => {
        const doc = this.documents[idx];
        const querySet = new Set(queryTokens);
        return {
          path: doc.path,
          score: Math.round(score * 100) / 100,
          header: doc.header,
          matchedSymbols: doc.symbols.filter((s) => splitCamelCase(s).some((t) => querySet.has(t))),
        };
      });
  }

  getDocumentCount(): number {
    return this.documents.length;
  }
}
