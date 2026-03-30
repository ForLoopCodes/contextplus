// Memory tool wrappers exposing graph operations updates and contextual traversal
// FEATURE: Project memory APIs with auto-pruning and typed output formatting

import type { MemorySearchMode, NodeType, RelationType, TraversalResult } from "../core/memory-graph.js";
import {
  addInterlinkedContext,
  createRelation,
  deleteMemory,
  getGraphStats,
  reloadMemoryNodesFromFiles,
  retrieveWithTraversal,
  searchGraph,
  updateMemoryContent,
  upsertNode,
  pruneStaleLinks,
} from "../core/memory-graph.js";

export interface CreateMemoryOptions {
  rootDir: string;
  type: NodeType;
  label: string;
  content: string;
  metadata?: Record<string, string>;
}

export interface CreateRelationOptions {
  rootDir: string;
  sourceId: string;
  targetId: string;
  relation: RelationType;
  weight?: number;
  metadata?: Record<string, string>;
}

export interface SearchMemoryOptions {
  rootDir: string;
  query: string;
  maxDepth?: number;
  topK?: number;
  edgeFilter?: RelationType[];
  mode?: MemorySearchMode;
}

export interface BulkMemoryOptions {
  rootDir: string;
  items: Array<{ type: NodeType; label: string; content: string; metadata?: Record<string, string> }>;
  autoLink?: boolean;
}

export interface ExploreMemoryOptions {
  rootDir: string;
  startNodeId: string;
  maxDepth?: number;
  edgeFilter?: RelationType[];
}

export interface UpdateMemoryOptions {
  rootDir: string;
  nodeId: string;
  content: string;
  metadata?: Record<string, string>;
}

export interface DeleteMemoryOptions {
  rootDir: string;
  nodeId?: string;
  edgeId?: string;
  sourceId?: string;
  targetId?: string;
  relation?: RelationType;
}

function summarizeTraversal(result: TraversalResult): string {
  return [
    `  [${result.node.type}] ${result.node.label} (depth ${result.depth}, score ${result.relevanceScore})`,
    `    Content: ${result.node.content.slice(0, 120)}${result.node.content.length > 120 ? "..." : ""}`,
    result.pathRelations.length > 1 ? `    Path: ${result.pathRelations.join(" ")}` : "",
    `    ID: ${result.node.id} | Accessed: ${result.node.accessCount}`,
  ].filter(Boolean).join("\n");
}

export async function toolCreateMemory(options: CreateMemoryOptions): Promise<string> {
  const node = await upsertNode(options.rootDir, options.type, options.label, options.content, options.metadata ?? {});
  const stats = await getGraphStats(options.rootDir);
  return [
    `✅ Memory saved: ${node.label}`,
    `ID: ${node.id}`,
    `Type: ${node.type}`,
    `Access count: ${node.accessCount}`,
    `Graph: ${stats.nodes} nodes, ${stats.edges} edges`,
  ].join("\n");
}

export async function toolCreateRelation(options: CreateRelationOptions): Promise<string> {
  const edge = await createRelation(
    options.rootDir,
    options.sourceId,
    options.targetId,
    options.relation,
    options.weight,
    options.metadata,
  );
  if (!edge) return `❌ Failed: node not found for relation (${options.sourceId} -> ${options.targetId})`;
  const stats = await getGraphStats(options.rootDir);
  return [
    `✅ Relation saved: ${options.sourceId} --[${edge.relation}]--> ${options.targetId}`,
    `Edge ID: ${edge.id}`,
    `Weight: ${edge.weight}`,
    `Graph: ${stats.nodes} nodes, ${stats.edges} edges`,
  ].join("\n");
}

export async function toolSearchMemory(options: SearchMemoryOptions): Promise<string> {
  const result = await searchGraph(options.rootDir, options.query, options.maxDepth, options.topK, {
    mode: options.mode,
    edgeFilter: options.edgeFilter,
  });
  if (result.direct.length === 0) {
    return `No memory nodes found for "${options.query}". Graph: ${result.totalNodes} nodes, ${result.totalEdges} edges.`;
  }
  const sections = [
    `Memory search: "${options.query}"`,
    `Graph: ${result.totalNodes} nodes, ${result.totalEdges} edges`,
    "",
    "Direct matches:",
    ...result.direct.map(summarizeTraversal),
  ];
  if (result.neighbors.length > 0) sections.push("", "Linked neighbors:", ...result.neighbors.map(summarizeTraversal));
  return sections.join("\n");
}

export async function toolBulkMemory(options: BulkMemoryOptions): Promise<string> {
  const result = await addInterlinkedContext(options.rootDir, options.items, options.autoLink ?? true);
  const stats = await getGraphStats(options.rootDir);
  const lines = [
    `✅ Bulk memory completed: ${result.nodes.length} nodes`,
    `Similarity edges created: ${result.edges.length}`,
    "",
    "Nodes:",
    ...result.nodes.map((node) => `  [${node.type}] ${node.label} -> ${node.id}`),
  ];
  if (result.edges.length > 0) lines.push("", "Edges:", ...result.edges.map((edge) => `  ${edge.source} --[${edge.relation}:${Math.round(edge.weight * 100) / 100}]--> ${edge.target}`));
  lines.push("", `Graph total: ${stats.nodes} nodes, ${stats.edges} edges`);
  return lines.join("\n");
}

export async function toolExploreMemory(options: ExploreMemoryOptions): Promise<string> {
  const result = await retrieveWithTraversal(options.rootDir, options.startNodeId, options.maxDepth, options.edgeFilter);
  if (result.length === 0) return `❌ Node not found: ${options.startNodeId}`;
  return [`Traversal from ${result[0].node.label} (depth ${options.maxDepth ?? 2})`, "", ...result.map(summarizeTraversal)].join("\n");
}

export async function toolUpdateMemory(options: UpdateMemoryOptions): Promise<string> {
  const node = await updateMemoryContent(options.rootDir, options.nodeId, options.content, options.metadata ?? {});
  if (!node) return `Node not found: ${options.nodeId}`;
  return [`Memory updated: ${node.label}`, `ID: ${node.id}`, `Type: ${node.type}`, `Access count: ${node.accessCount}`].join("\n");
}

export async function toolDeleteMemory(options: DeleteMemoryOptions): Promise<string> {
  const result = await deleteMemory(options.rootDir, {
    nodeId: options.nodeId,
    edgeId: options.edgeId,
    sourceId: options.sourceId,
    targetId: options.targetId,
    relation: options.relation,
  });
  return ["Delete memory completed", `Removed nodes: ${result.removedNodes}`, `Removed edges: ${result.removedEdges}`].join("\n");
}

export async function toolRefreshMemoryFromFiles(rootDir: string): Promise<string> {
  return `Memory refresh completed. Updated nodes: ${await reloadMemoryNodesFromFiles(rootDir)}`;
}

export async function toolUpsertMemoryNode(options: CreateMemoryOptions): Promise<string> {
  return toolCreateMemory(options);
}

export async function toolSearchMemoryGraph(options: SearchMemoryOptions): Promise<string> {
  return toolSearchMemory(options);
}

export async function toolPruneStaleLinks(options: { rootDir: string; threshold?: number }): Promise<string> {
  const result = await pruneStaleLinks(options.rootDir, options.threshold);
  return ["🧹 Pruning complete", `Removed: ${result.removed}`, `Remaining edges: ${result.remaining}`].join("\n");
}

export async function toolAddInterlinkedContext(options: BulkMemoryOptions): Promise<string> {
  return toolBulkMemory(options);
}

export async function toolRetrieveWithTraversal(options: ExploreMemoryOptions): Promise<string> {
  return toolExploreMemory(options);
}
