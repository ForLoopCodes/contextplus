// Unified search tool combining file and identifier semantic capabilities together
// FEATURE: Hybrid search routing with keyword semantic and combined modes

import { semanticIdentifierSearch } from "./semantic-identifiers.js";
import { semanticCodeSearch } from "./semantic-search.js";

export type SearchType = "identifier" | "file" | "hybrid";
export type SearchMode = "semantic" | "keyword" | "both";

export interface SearchOptions {
  rootDir: string;
  query: string;
  searchType?: SearchType;
  mode?: SearchMode;
  topK?: number;
  topCallsPerIdentifier?: number;
  includeKinds?: string[];
  semanticWeight?: number;
  keywordWeight?: number;
  minSemanticScore?: number;
  minKeywordScore?: number;
  minCombinedScore?: number;
  requireKeywordMatch?: boolean;
  requireSemanticMatch?: boolean;
}

interface WeightConfig {
  semanticWeight?: number;
  keywordWeight?: number;
  requireKeywordMatch?: boolean;
  requireSemanticMatch?: boolean;
}

function resolveModeWeights(options: SearchOptions): WeightConfig {
  if (options.mode === "semantic") {
    return {
      semanticWeight: 1,
      keywordWeight: 0,
      requireSemanticMatch: true,
      requireKeywordMatch: false,
    };
  }
  if (options.mode === "keyword") {
    return {
      semanticWeight: 0,
      keywordWeight: 1,
      requireSemanticMatch: false,
      requireKeywordMatch: true,
    };
  }
  return {
    semanticWeight: options.semanticWeight,
    keywordWeight: options.keywordWeight,
    requireSemanticMatch: options.requireSemanticMatch,
    requireKeywordMatch: options.requireKeywordMatch,
  };
}

async function runFileSearch(options: SearchOptions): Promise<string> {
  const weights = resolveModeWeights(options);
  return semanticCodeSearch({
    rootDir: options.rootDir,
    query: options.query,
    topK: options.topK,
    semanticWeight: weights.semanticWeight,
    keywordWeight: weights.keywordWeight,
    minSemanticScore: options.minSemanticScore,
    minKeywordScore: options.minKeywordScore,
    minCombinedScore: options.minCombinedScore,
    requireKeywordMatch: weights.requireKeywordMatch,
    requireSemanticMatch: weights.requireSemanticMatch,
  });
}

async function runIdentifierSearch(options: SearchOptions): Promise<string> {
  const weights = resolveModeWeights(options);
  return semanticIdentifierSearch({
    rootDir: options.rootDir,
    query: options.query,
    topK: options.topK,
    topCallsPerIdentifier: options.topCallsPerIdentifier,
    includeKinds: options.includeKinds,
    semanticWeight: weights.semanticWeight,
    keywordWeight: weights.keywordWeight,
  });
}

export async function searchCodebase(options: SearchOptions): Promise<string> {
  const searchType = options.searchType ?? "hybrid";
  if (searchType === "file") return runFileSearch(options);
  if (searchType === "identifier") return runIdentifierSearch(options);
  const [fileResults, identifierResults] = await Promise.all([
    runFileSearch(options),
    runIdentifierSearch(options),
  ]);
  return [
    `Hybrid search results for: "${options.query}"`,
    "",
    "File results:",
    fileResults,
    "",
    "Identifier results:",
    identifierResults,
  ].join("\n");
}
