// Semantic project navigator using spectral clustering and Ollama labeling
// Browse codebase by meaning: embeds files, clusters vectors, generates labels

import { Ollama } from "ollama";
import { walkDirectory } from "../core/walker.js";
import { analyzeFile, flattenSymbols, isSupportedFile } from "../core/parser.js";
import { fetchEmbedding } from "../core/embeddings.js";
import { readFile } from "fs/promises";
import { spectralCluster, findPathPattern } from "../core/clustering.js";

export interface SemanticNavigateOptions {
  rootDir: string;
  maxDepth?: number;
  maxClusters?: number;
}

interface FileInfo {
  relativePath: string;
  header: string;
  content: string;
  symbolPreview: string[];
}

interface ClusterNode {
  label: string;
  pathPattern: string | null;
  files: FileInfo[];
  children: ClusterNode[];
}

const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? "llama3.2";
const MAX_FILES_PER_LEAF = 20;

const ollama = new Ollama({ host: process.env.OLLAMA_HOST });

async function fetchEmbeddings(inputs: string[]): Promise<number[][]> {
  return fetchEmbedding(inputs);
}

async function chatCompletion(prompt: string): Promise<string> {
  const response = await ollama.chat({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
    stream: false,
  });
  return response.message.content;
}

function extractHeader(content: string): string {
  const lines = content.split("\n");
  const headerLines: string[] = [];
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("--")) {
      headerLines.push(trimmed.replace(/^\/\/\s*|^#\s*|^--\s*/, ""));
    } else if (trimmed.length > 0) {
      break;
    }
  }
  return headerLines.join(" ").substring(0, 200);
}

function formatLineRange(line: number, endLine: number): string {
  return endLine > line ? `L${line}-L${endLine}` : `L${line}`;
}

async function labelSiblingClusters(clusters: { files: FileInfo[]; pathPattern: string | null }[]): Promise<string[]> {
  if (clusters.length === 0) return [];
  if (clusters.length === 1) {
    const pp = clusters[0].pathPattern;
    if (pp) return [pp];
    return [clusters[0].files.map((f) => f.relativePath.split("/").pop()).join(", ").substring(0, 40)];
  }

  const clusterDescriptions = clusters.map((c, i) => {
    const fileList = c.files.map((f) => `${f.relativePath}: ${f.header || "no description"}`).join("\n  ");
    const pattern = c.pathPattern ? ` (pattern: ${c.pathPattern})` : "";
    return `Cluster ${i + 1}${pattern}:\n  ${fileList}`;
  });

  const prompt = `You are labeling clusters of code files. For each cluster below, produce EXACTLY one JSON array of objects, each with:
- "overarchingTheme": a sentence about the cluster's theme
- "distinguishingFeature": what makes this cluster unique vs siblings  
- "label": EXACTLY 2 words describing the cluster

${clusterDescriptions.join("\n\n")}

Respond with ONLY a JSON array of ${clusters.length} objects. No other text.`;

  try {
    const response = await chatCompletion(prompt);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return clusters.map((_, i) => `Cluster ${i + 1}`);
    const labels = JSON.parse(jsonMatch[0]) as { label: string }[];
    return labels.map((l, i) => {
      const pp = clusters[i].pathPattern;
      const base = l.label || `Cluster ${i + 1}`;
      return pp ? `${base} (${pp})` : base;
    });
  } catch {
    return clusters.map((c, i) => c.pathPattern ?? `Cluster ${i + 1}`);
  }
}

async function buildHierarchy(files: FileInfo[], vectors: number[][], maxClusters: number, depth: number, maxDepth: number): Promise<ClusterNode> {
  if (files.length <= MAX_FILES_PER_LEAF || depth >= maxDepth) {
    return {
      label: "",
      pathPattern: findPathPattern(files.map((f) => f.relativePath)),
      files,
      children: [],
    };
  }

  const clusterResults = spectralCluster(vectors, maxClusters);

  if (clusterResults.length <= 1) {
    return {
      label: "",
      pathPattern: findPathPattern(files.map((f) => f.relativePath)),
      files,
      children: [],
    };
  }

  const childMetas = clusterResults.map((cluster) => ({
    files: cluster.indices.map((i) => files[i]),
    vectors: cluster.indices.map((i) => vectors[i]),
    pathPattern: findPathPattern(cluster.indices.map((i) => files[i].relativePath)),
  }));

  const labels = await labelSiblingClusters(childMetas.map((c) => ({ files: c.files, pathPattern: c.pathPattern })));

  const children: ClusterNode[] = [];
  for (let i = 0; i < childMetas.length; i++) {
    const child = await buildHierarchy(childMetas[i].files, childMetas[i].vectors, maxClusters, depth + 1, maxDepth);
    child.label = labels[i];
    children.push(child);
  }

  return {
    label: "",
    pathPattern: findPathPattern(files.map((f) => f.relativePath)),
    files: [],
    children,
  };
}

function renderClusterTree(node: ClusterNode, indent: number = 0): string {
  const pad = "  ".repeat(indent);
  let result = "";

  if (node.label) {
    result += `${pad}[${node.label}]\n`;
  }

  if (node.children.length > 0) {
    for (const child of node.children) {
      result += renderClusterTree(child, indent + 1);
    }
  } else {
    for (const file of node.files) {
      const label = file.header ? ` - ${file.header}` : "";
      const symbols = file.symbolPreview.length > 0 ? ` | symbols: ${file.symbolPreview.join(", ")}` : "";
      result += `${pad}  ${file.relativePath}${label}${symbols}\n`;
    }
  }

  return result;
}

export async function semanticNavigate(options: SemanticNavigateOptions): Promise<string> {
  const maxClusters = options.maxClusters ?? 20;
  const maxDepth = options.maxDepth ?? 3;

  const entries = await walkDirectory({ rootDir: options.rootDir, depthLimit: 0 });
  const fileEntries = entries.filter((e) => !e.isDirectory && isSupportedFile(e.path));

  if (fileEntries.length === 0) return "No supported source files found in the project.";

  const files: FileInfo[] = [];
  for (const entry of fileEntries) {
    try {
      const content = await readFile(entry.path, "utf-8");
      let header = extractHeader(content);
      let symbolPreview: string[] = [];
      try {
        const analysis = await analyzeFile(entry.path);
        if (analysis.header) header = analysis.header;
        symbolPreview = flattenSymbols(analysis.symbols)
          .slice(0, 3)
          .map((s) => `${s.name}@${formatLineRange(s.line, s.endLine)}`);
      } catch {
      }
      files.push({
        relativePath: entry.relativePath,
        header,
        content: content.substring(0, 500),
        symbolPreview,
      });
    } catch {
    }
  }

  if (files.length === 0) return "Could not read any source files.";

  const embedTexts = files.map((f) => `${f.header} ${f.relativePath} ${f.content}`);

  let vectors: number[][];
  try {
    vectors = await fetchEmbeddings(embedTexts);
  } catch (err) {
    return `Ollama not available for embeddings: ${err instanceof Error ? err.message : String(err)}\nMake sure Ollama is running or signed in (ollama signin) with model ${EMBED_MODEL}.`;
  }

  if (files.length <= MAX_FILES_PER_LEAF) {
    let fileLabels: string[];
    try {
      const prompt = `For each file below, produce a 3-7 word description. Return ONLY a JSON array of strings.\n\n${files.map((f) => `${f.relativePath}: ${f.header}`).join("\n")}`;
      const response = await chatCompletion(prompt);
      const match = response.match(/\[[\s\S]*\]/);
      fileLabels = match ? JSON.parse(match[0]) : files.map((f) => f.header);
    } catch {
      fileLabels = files.map((f) => f.header);
    }

    const lines = [`Semantic Navigator: ${files.length} files\n`];
    for (let i = 0; i < files.length; i++) {
      const symbols = files[i].symbolPreview.length > 0 ? ` | symbols: ${files[i].symbolPreview.join(", ")}` : "";
      lines.push(`  ${files[i].relativePath} - ${fileLabels[i] || files[i].header}${symbols}`);
    }
    return lines.join("\n");
  }

  const tree = await buildHierarchy(files, vectors, maxClusters, 0, maxDepth);
  tree.label = "Project";

  return `Semantic Navigator: ${files.length} files organized by meaning\n\n${renderClusterTree(tree)}`;
}
