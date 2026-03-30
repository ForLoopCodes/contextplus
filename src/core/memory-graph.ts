// Graph memory persistence with markdown nodes SQLite vectors and relations
// FEATURE: Memory graph storage traversal ranking and automatic stale cleanup

import { mkdir, readFile, readdir, writeFile, rm } from "fs/promises";
import { basename, join } from "path";
import { fetchEmbedding } from "./embeddings.js";
import { deleteVector, getVector, listVectors, upsertVector } from "./vector-db.js";

export type NodeType = "concept" | "file" | "symbol" | "note";
export type RelationType = "relates_to" | "depends_on" | "implements" | "references" | "similar_to" | "contains";
export type MemorySearchMode = "semantic" | "keyword" | "both";

export interface MemoryNode {
  id: string;
  type: NodeType;
  label: string;
  content: string;
  embedding: number[];
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  metadata: Record<string, string>;
}

export interface MemoryEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationType;
  weight: number;
  createdAt: number;
  metadata: Record<string, string>;
}

export interface TraversalResult {
  node: MemoryNode;
  depth: number;
  pathRelations: string[];
  relevanceScore: number;
}

export interface GraphSearchResult {
  direct: TraversalResult[];
  neighbors: TraversalResult[];
  totalNodes: number;
  totalEdges: number;
}

interface MemoryNodeRecord {
  id: string;
  type: NodeType;
  label: string;
  contentPath: string;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  metadata: Record<string, string>;
}

interface MemoryEdgeRecord {
  id: string;
  source: string;
  target: string;
  relation: RelationType;
  weight: number;
  createdAt: number;
  metadata: Record<string, string>;
}

interface MemoryGraphStore {
  nodes: Record<string, MemoryNodeRecord>;
  edges: Record<string, MemoryEdgeRecord>;
}

export interface MemorySearchOptions {
  mode?: MemorySearchMode;
  edgeFilter?: RelationType[];
}

interface DeleteMemoryInput {
  nodeId?: string;
  edgeId?: string;
  sourceId?: string;
  targetId?: string;
  relation?: RelationType;
}

const CONTEXTPLUS_DIR = ".contextplus";
const MEMORIES_DIR = "memories";
const NODES_DIR = "nodes";
const GRAPH_FILE = "graph.json";
const MEMORY_VECTOR_NAMESPACE = "memory";
const DECAY_LAMBDA = 0.05;
const SIMILARITY_THRESHOLD = 0.72;
const STALE_THRESHOLD = 0.15;
const MAX_EXISTING_AUTO_LINK = 200;

const storeCache = new Map<string, MemoryGraphStore>();
const nodeCache = new Map<string, Map<string, string>>();
const savePending = new Set<string>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toSafeSlug(input: string): string {
  const base = input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return base || "node";
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function splitTerms(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((token) => token.length > 1);
}

function keywordCoverage(queryTerms: Set<string>, content: string): number {
  if (queryTerms.size === 0) return 0;
  const terms = new Set(splitTerms(content));
  let matched = 0;
  for (const term of queryTerms) if (terms.has(term)) matched += 1;
  return matched / queryTerms.size;
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function hashContent(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return hash.toString(36);
}

function decayWeight(edge: MemoryEdgeRecord): number {
  return edge.weight * Math.exp(-DECAY_LAMBDA * ((Date.now() - edge.createdAt) / 86_400_000));
}

function graphPath(rootDir: string): string {
  return join(rootDir, CONTEXTPLUS_DIR, MEMORIES_DIR, GRAPH_FILE);
}

function memoryNodesDir(rootDir: string): string {
  return join(rootDir, CONTEXTPLUS_DIR, MEMORIES_DIR, NODES_DIR);
}

function nodePath(rootDir: string, node: Pick<MemoryNodeRecord, "id" | "label">): string {
  return join(memoryNodesDir(rootDir), `${node.id}-${toSafeSlug(node.label)}.md`);
}

function nodeRelativePath(rootDir: string, node: Pick<MemoryNodeRecord, "id" | "label">): string {
  return normalizeRelativePath(join(CONTEXTPLUS_DIR, MEMORIES_DIR, NODES_DIR, basename(nodePath(rootDir, node))));
}

function nodeVectorKey(nodeId: string): string {
  return `node:${nodeId}`;
}

function getEdgesForNode(store: MemoryGraphStore, nodeId: string): MemoryEdgeRecord[] {
  return Object.values(store.edges).filter((edge) => edge.source === nodeId || edge.target === nodeId);
}

function getNeighborId(edge: MemoryEdgeRecord, nodeId: string): string {
  return edge.source === nodeId ? edge.target : edge.source;
}

function relationAllowed(relation: RelationType, edgeFilter?: RelationType[]): boolean {
  return !edgeFilter || edgeFilter.includes(relation);
}

function extractNodeBody(content: string): string {
  const marker = "\n\n## Content\n";
  const index = content.indexOf(marker);
  return index < 0 ? content : content.slice(index + marker.length).trim();
}

function parseNodeHeader(content: string): { label: string; type: NodeType; metadata: Record<string, string> } {
  const lines = content.split("\n");
  const label = lines[0]?.startsWith("# ") ? lines[0].slice(2).trim() : "Untitled";
  let type: NodeType = "note";
  const metadata: Record<string, string> = {};
  let inFrontmatter = false;
  for (const line of lines) {
    if (line.trim() === "---") {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (!inFrontmatter) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "type" && ["concept", "file", "symbol", "note"].includes(value)) type = value as NodeType;
    else if (key && value) metadata[key] = value;
  }
  return { label, type, metadata };
}

function formatNodeMarkdown(node: MemoryNodeRecord, content: string): string {
  const metadataLines = Object.entries(node.metadata).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}: ${value}`);
  return [
    `# ${node.label}`,
    "---",
    `id: ${node.id}`,
    `type: ${node.type}`,
    `created_at: ${node.createdAt}`,
    `updated_at: ${Date.now()}`,
    `last_accessed: ${node.lastAccessed}`,
    `access_count: ${node.accessCount}`,
    ...metadataLines,
    "---",
    "",
    "## Content",
    content.trimEnd(),
    "",
  ].join("\n");
}

async function ensureMemoryDirs(rootDir: string): Promise<void> {
  await mkdir(memoryNodesDir(rootDir), { recursive: true });
}

async function loadStore(rootDir: string): Promise<MemoryGraphStore> {
  const cached = storeCache.get(rootDir);
  if (cached) return cached;
  await ensureMemoryDirs(rootDir);
  try {
    const raw = JSON.parse(await readFile(graphPath(rootDir), "utf-8")) as Partial<MemoryGraphStore>;
    const store = {
      nodes: raw.nodes && typeof raw.nodes === "object" ? raw.nodes as Record<string, MemoryNodeRecord> : {},
      edges: raw.edges && typeof raw.edges === "object" ? raw.edges as Record<string, MemoryEdgeRecord> : {},
    };
    storeCache.set(rootDir, store);
    return store;
  } catch {
    const store = { nodes: {}, edges: {} };
    storeCache.set(rootDir, store);
    return store;
  }
}

async function persistStore(rootDir: string): Promise<void> {
  const store = storeCache.get(rootDir);
  if (!store) return;
  await ensureMemoryDirs(rootDir);
  await writeFile(graphPath(rootDir), JSON.stringify(store, null, 2), "utf-8");
}

function scheduleStoreSave(rootDir: string): void {
  const existing = saveTimers.get(rootDir);
  if (existing) clearTimeout(existing);
  savePending.add(rootDir);
  saveTimers.set(rootDir, setTimeout(() => {
    if (!savePending.has(rootDir)) return;
    void persistStore(rootDir).finally(() => savePending.delete(rootDir));
  }, 500));
}

async function loadNodeContent(rootDir: string, node: MemoryNodeRecord): Promise<string> {
  const cache = nodeCache.get(rootDir) ?? new Map<string, string>();
  nodeCache.set(rootDir, cache);
  if (cache.has(node.id)) return cache.get(node.id)!;
  try {
    const content = extractNodeBody(await readFile(join(rootDir, node.contentPath), "utf-8"));
    cache.set(node.id, content);
    return content;
  } catch {
    return "";
  }
}

async function writeNodeContent(rootDir: string, node: MemoryNodeRecord, content: string): Promise<void> {
  await ensureMemoryDirs(rootDir);
  const path = nodePath(rootDir, node);
  const previousPath = node.contentPath ? join(rootDir, node.contentPath) : "";
  node.contentPath = nodeRelativePath(rootDir, node);
  await writeFile(path, formatNodeMarkdown(node, content), "utf-8");
  if (previousPath && normalizeRelativePath(previousPath) !== normalizeRelativePath(path)) await rm(previousPath, { force: true });
  const cache = nodeCache.get(rootDir) ?? new Map<string, string>();
  cache.set(node.id, content);
  nodeCache.set(rootDir, cache);
}

async function getNodeVector(rootDir: string, nodeId: string): Promise<number[]> {
  return (await getVector(rootDir, MEMORY_VECTOR_NAMESPACE, nodeVectorKey(nodeId)))?.vector ?? [];
}

async function hydrateNode(rootDir: string, node: MemoryNodeRecord): Promise<MemoryNode> {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    content: await loadNodeContent(rootDir, node),
    embedding: await getNodeVector(rootDir, node.id),
    createdAt: node.createdAt,
    lastAccessed: node.lastAccessed,
    accessCount: node.accessCount,
    metadata: { ...node.metadata },
  };
}

async function upsertNodeEmbedding(rootDir: string, node: Pick<MemoryNodeRecord, "id" | "type" | "label">, content: string): Promise<number[]> {
  const text = `${node.label} ${content}`;
  const [embedding] = await fetchEmbedding(text);
  await upsertVector(rootDir, MEMORY_VECTOR_NAMESPACE, nodeVectorKey(node.id), hashContent(text), embedding, { type: node.type, label: node.label });
  return embedding;
}

async function removeStaleContentFiles(rootDir: string, validPaths: Set<string>): Promise<void> {
  await ensureMemoryDirs(rootDir);
  const entries = await readdir(memoryNodesDir(rootDir), { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map(async (entry) => {
      const relativePath = normalizeRelativePath(join(CONTEXTPLUS_DIR, MEMORIES_DIR, NODES_DIR, entry.name));
      if (!validPaths.has(relativePath)) await rm(join(memoryNodesDir(rootDir), entry.name), { force: true });
    }));
}

async function autoPrune(rootDir: string): Promise<void> {
  await pruneStaleLinks(rootDir, STALE_THRESHOLD);
}

async function removeNodeById(rootDir: string, store: MemoryGraphStore, nodeId: string): Promise<{ removedNodes: number; removedEdges: number }> {
  const node = store.nodes[nodeId];
  if (!node) return { removedNodes: 0, removedEdges: 0 };
  const removedEdgeIds = Object.values(store.edges)
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .map((edge) => edge.id);
  for (const edgeId of removedEdgeIds) delete store.edges[edgeId];
  delete store.nodes[nodeId];
  await deleteVector(rootDir, MEMORY_VECTOR_NAMESPACE, nodeVectorKey(nodeId));
  if (node.contentPath) await rm(join(rootDir, node.contentPath), { force: true });
  return { removedNodes: 1, removedEdges: removedEdgeIds.length };
}

async function collectNeighbors(
  rootDir: string,
  store: MemoryGraphStore,
  startNode: MemoryNode,
  queryEmbedding: number[],
  maxDepth: number,
  visited: Set<string>,
  edgeFilter?: RelationType[],
): Promise<TraversalResult[]> {
  const results: TraversalResult[] = [];
  const walk = async (nodeId: string, depth: number, path: string[]): Promise<void> => {
    if (depth > maxDepth) return;
    for (const edge of getEdgesForNode(store, nodeId)) {
      if (!relationAllowed(edge.relation, edgeFilter)) continue;
      const nextId = getNeighborId(edge, nodeId);
      if (visited.has(nextId)) continue;
      const record = store.nodes[nextId];
      if (!record) continue;
      visited.add(nextId);
      record.lastAccessed = Date.now();
      const node = await hydrateNode(rootDir, record);
      const relevance = Math.max(cosine(queryEmbedding, node.embedding), 0) * 0.6 + (decayWeight(edge) / Math.max(edge.weight, 0.01)) * 0.4;
      const pathRelations = [...path, `--[${edge.relation}]-->`, node.label];
      results.push({ node, depth, pathRelations, relevanceScore: Math.round(relevance * 1000) / 10 });
      await walk(nextId, depth + 1, pathRelations);
    }
  };
  await walk(startNode.id, 1, [startNode.label]);
  return results;
}

async function scoreNode(
  rootDir: string,
  node: MemoryNodeRecord,
  queryEmbedding: number[],
  queryTerms: Set<string>,
  mode: MemorySearchMode,
): Promise<{ node: MemoryNode; score: number }> {
  const hydrated = await hydrateNode(rootDir, node);
  const semanticScore = mode === "keyword" ? 0 : Math.max(cosine(queryEmbedding, hydrated.embedding), 0);
  const keywordScore = mode === "semantic" ? 0 : keywordCoverage(queryTerms, `${hydrated.label} ${hydrated.content} ${JSON.stringify(hydrated.metadata)}`);
  return {
    node: hydrated,
    score: mode === "semantic" ? semanticScore : mode === "keyword" ? keywordScore : semanticScore * 0.7 + keywordScore * 0.3,
  };
}

export async function pruneStaleLinks(rootDir: string, threshold: number = STALE_THRESHOLD): Promise<{ removed: number; remaining: number }> {
  const store = await loadStore(rootDir);
  const staleEdgeIds = Object.entries(store.edges).filter(([, edge]) => decayWeight(edge) < threshold).map(([edgeId]) => edgeId);
  for (const edgeId of staleEdgeIds) delete store.edges[edgeId];
  const orphanNodeIds = Object.keys(store.nodes)
    .filter((nodeId) => getEdgesForNode(store, nodeId).length === 0)
    .filter((nodeId) => store.nodes[nodeId].accessCount <= 1)
    .filter((nodeId) => Date.now() - store.nodes[nodeId].lastAccessed > 7 * 86_400_000);
  for (const nodeId of orphanNodeIds) await removeNodeById(rootDir, store, nodeId);
  if (staleEdgeIds.length > 0 || orphanNodeIds.length > 0) scheduleStoreSave(rootDir);
  return { removed: staleEdgeIds.length + orphanNodeIds.length, remaining: Object.keys(store.edges).length };
}

export async function upsertNode(rootDir: string, type: NodeType, label: string, content: string, metadata: Record<string, string> = {}): Promise<MemoryNode> {
  await autoPrune(rootDir);
  const store = await loadStore(rootDir);
  const existing = Object.values(store.nodes).find((node) => node.type === type && node.label === label);
  const now = Date.now();
  if (existing) {
    existing.lastAccessed = now;
    existing.accessCount += 1;
    existing.metadata = { ...existing.metadata, ...metadata };
    const embedding = await upsertNodeEmbedding(rootDir, existing, content);
    await writeNodeContent(rootDir, existing, content);
    scheduleStoreSave(rootDir);
    return { ...await hydrateNode(rootDir, existing), embedding };
  }
  const node: MemoryNodeRecord = {
    id: generateId("mn"),
    type,
    label,
    contentPath: "",
    createdAt: now,
    lastAccessed: now,
    accessCount: 1,
    metadata: { ...metadata },
  };
  store.nodes[node.id] = node;
  const embedding = await upsertNodeEmbedding(rootDir, node, content);
  await writeNodeContent(rootDir, node, content);
  scheduleStoreSave(rootDir);
  return { ...await hydrateNode(rootDir, node), embedding };
}

export async function updateMemoryContent(rootDir: string, nodeId: string, content: string, metadata: Record<string, string> = {}): Promise<MemoryNode | null> {
  await autoPrune(rootDir);
  const store = await loadStore(rootDir);
  const node = store.nodes[nodeId];
  if (!node) return null;
  node.lastAccessed = Date.now();
  node.accessCount += 1;
  node.metadata = { ...node.metadata, ...metadata };
  const embedding = await upsertNodeEmbedding(rootDir, node, content);
  await writeNodeContent(rootDir, node, content);
  scheduleStoreSave(rootDir);
  return { ...await hydrateNode(rootDir, node), embedding };
}

export async function createRelation(
  rootDir: string,
  sourceId: string,
  targetId: string,
  relation: RelationType,
  weight: number = 1,
  metadata: Record<string, string> = {},
): Promise<MemoryEdge | null> {
  await autoPrune(rootDir);
  const store = await loadStore(rootDir);
  if (!store.nodes[sourceId] || !store.nodes[targetId]) return null;
  const duplicate = Object.values(store.edges).find((edge) => edge.source === sourceId && edge.target === targetId && edge.relation === relation);
  if (duplicate) {
    duplicate.weight = weight;
    duplicate.metadata = { ...duplicate.metadata, ...metadata };
    scheduleStoreSave(rootDir);
    return { ...duplicate };
  }
  const edge: MemoryEdgeRecord = {
    id: generateId("me"),
    source: sourceId,
    target: targetId,
    relation,
    weight,
    createdAt: Date.now(),
    metadata: { ...metadata },
  };
  store.edges[edge.id] = edge;
  scheduleStoreSave(rootDir);
  return { ...edge };
}

export async function deleteMemory(rootDir: string, input: DeleteMemoryInput): Promise<{ removedNodes: number; removedEdges: number }> {
  await autoPrune(rootDir);
  const store = await loadStore(rootDir);
  let removedNodes = 0;
  let removedEdges = 0;
  if (input.nodeId) {
    const result = await removeNodeById(rootDir, store, input.nodeId);
    removedNodes += result.removedNodes;
    removedEdges += result.removedEdges;
  }
  if (input.edgeId && store.edges[input.edgeId]) {
    delete store.edges[input.edgeId];
    removedEdges += 1;
  }
  if (input.sourceId && input.targetId) {
    for (const edge of Object.values(store.edges)) {
      if (edge.source === input.sourceId && edge.target === input.targetId && (!input.relation || edge.relation === input.relation)) {
        delete store.edges[edge.id];
        removedEdges += 1;
      }
    }
  }
  if (removedNodes > 0 || removedEdges > 0) scheduleStoreSave(rootDir);
  return { removedNodes, removedEdges };
}

export async function searchGraph(rootDir: string, query: string, maxDepth: number = 1, topK: number = 5, options: MemorySearchOptions = {}): Promise<GraphSearchResult> {
  await autoPrune(rootDir);
  const store = await loadStore(rootDir);
  const nodes = Object.values(store.nodes);
  if (nodes.length === 0) return { direct: [], neighbors: [], totalNodes: 0, totalEdges: 0 };
  const [queryEmbedding] = await fetchEmbedding(query);
  const queryTerms = new Set(splitTerms(query));
  const mode = options.mode ?? "both";
  const scored = await Promise.all(nodes.map((node) => scoreNode(rootDir, node, queryEmbedding, queryTerms, mode)));
  const direct = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK))
    .map((item) => {
      const record = store.nodes[item.node.id];
      record.lastAccessed = Date.now();
      record.accessCount += 1;
      return {
        node: item.node,
        depth: 0,
        pathRelations: [],
        relevanceScore: Math.round(item.score * 1000) / 10,
      };
    });
  const visited = new Set<string>(direct.map((item) => item.node.id));
  const neighbors: TraversalResult[] = [];
  for (const hit of direct) neighbors.push(...await collectNeighbors(rootDir, store, hit.node, queryEmbedding, maxDepth, visited, options.edgeFilter));
  scheduleStoreSave(rootDir);
  return {
    direct,
    neighbors: neighbors.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, Math.max(1, topK) * 2),
    totalNodes: nodes.length,
    totalEdges: Object.keys(store.edges).length,
  };
}

export async function addInterlinkedContext(
  rootDir: string,
  items: Array<{ type: NodeType; label: string; content: string; metadata?: Record<string, string> }>,
  autoLink: boolean = true,
): Promise<{ nodes: MemoryNode[]; edges: MemoryEdge[] }> {
  await autoPrune(rootDir);
  const createdNodes: MemoryNode[] = [];
  for (const item of items) createdNodes.push(await upsertNode(rootDir, item.type, item.label, item.content, item.metadata ?? {}));
  const createdEdges: MemoryEdge[] = [];
  if (!autoLink || createdNodes.length === 0) return { nodes: createdNodes, edges: createdEdges };
  for (let i = 0; i < createdNodes.length; i++) {
    for (let j = i + 1; j < createdNodes.length; j++) {
      const similarity = cosine(createdNodes[i].embedding, createdNodes[j].embedding);
      if (similarity >= SIMILARITY_THRESHOLD) {
        const edge = await createRelation(rootDir, createdNodes[i].id, createdNodes[j].id, "similar_to", similarity);
        if (edge) createdEdges.push(edge);
      }
    }
  }
  const store = await loadStore(rootDir);
  const existingNodes = Object.values(store.nodes)
    .filter((node) => !createdNodes.some((created) => created.id === node.id))
    .slice(0, MAX_EXISTING_AUTO_LINK);
  for (const node of createdNodes) {
    for (const existing of existingNodes) {
      const candidate = await hydrateNode(rootDir, existing);
      const similarity = cosine(node.embedding, candidate.embedding);
      if (similarity >= SIMILARITY_THRESHOLD) {
        const edge = await createRelation(rootDir, node.id, candidate.id, "similar_to", similarity);
        if (edge) createdEdges.push(edge);
      }
    }
  }
  return { nodes: createdNodes, edges: createdEdges };
}

export async function retrieveWithTraversal(rootDir: string, startNodeId: string, maxDepth: number = 2, edgeFilter?: RelationType[]): Promise<TraversalResult[]> {
  await autoPrune(rootDir);
  const store = await loadStore(rootDir);
  const start = store.nodes[startNodeId];
  if (!start) return [];
  start.lastAccessed = Date.now();
  start.accessCount += 1;
  const startNode = await hydrateNode(rootDir, start);
  const results: TraversalResult[] = [{ node: startNode, depth: 0, pathRelations: [startNode.label], relevanceScore: 100 }];
  const visited = new Set<string>([startNode.id]);
  results.push(...await collectNeighbors(rootDir, store, startNode, startNode.embedding, maxDepth, visited, edgeFilter));
  scheduleStoreSave(rootDir);
  return results;
}

export async function getGraphStats(rootDir: string): Promise<{ nodes: number; edges: number; types: Record<string, number>; relations: Record<string, number> }> {
  await autoPrune(rootDir);
  const store = await loadStore(rootDir);
  const types: Record<string, number> = {};
  const relations: Record<string, number> = {};
  for (const node of Object.values(store.nodes)) types[node.type] = (types[node.type] ?? 0) + 1;
  for (const edge of Object.values(store.edges)) relations[edge.relation] = (relations[edge.relation] ?? 0) + 1;
  return { nodes: Object.keys(store.nodes).length, edges: Object.keys(store.edges).length, types, relations };
}

export async function reloadMemoryNodesFromFiles(rootDir: string): Promise<number> {
  const store = await loadStore(rootDir);
  let updated = 0;
  for (const node of Object.values(store.nodes)) {
    try {
      const raw = await readFile(join(rootDir, node.contentPath), "utf-8");
      const header = parseNodeHeader(raw);
      const content = extractNodeBody(raw);
      node.label = header.label;
      node.type = header.type;
      if (Object.keys(header.metadata).length > 0) node.metadata = { ...node.metadata, ...header.metadata };
      node.lastAccessed = Date.now();
      await upsertNodeEmbedding(rootDir, node, content);
      const cache = nodeCache.get(rootDir) ?? new Map<string, string>();
      cache.set(node.id, content);
      nodeCache.set(rootDir, cache);
      updated += 1;
    } catch {
    }
  }
  if (updated > 0) scheduleStoreSave(rootDir);
  return updated;
}

export async function rebuildMemoryVectors(rootDir: string): Promise<number> {
  const store = await loadStore(rootDir);
  let updated = 0;
  for (const node of Object.values(store.nodes)) {
    await upsertNodeEmbedding(rootDir, node, await loadNodeContent(rootDir, node));
    updated += 1;
  }
  return updated;
}

export async function clearMemoryGraph(rootDir: string): Promise<void> {
  const store = await loadStore(rootDir);
  for (const node of Object.values(store.nodes)) {
    await deleteVector(rootDir, MEMORY_VECTOR_NAMESPACE, nodeVectorKey(node.id));
    if (node.contentPath) await rm(join(rootDir, node.contentPath), { force: true });
  }
  store.nodes = {};
  store.edges = {};
  await removeStaleContentFiles(rootDir, new Set());
  scheduleStoreSave(rootDir);
}

export async function finalizeMemoryStore(rootDir: string): Promise<void> {
  const store = await loadStore(rootDir);
  await removeStaleContentFiles(rootDir, new Set(Object.values(store.nodes).map((node) => node.contentPath)));
  scheduleStoreSave(rootDir);
}

export async function getMemoryGraphEmbeddings(rootDir: string): Promise<number> {
  return (await listVectors(rootDir, MEMORY_VECTOR_NAMESPACE)).length;
}
