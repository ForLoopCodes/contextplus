// Spectral clustering with eigengap heuristic for tuning-free cluster counts
// Builds affinity matrix, normalized Laplacian, k-means on eigenvectors

import { Matrix, EigenvalueDecomposition } from "ml-matrix";

export interface ClusterResult {
  indices: number[];
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

function buildAffinityMatrix(vectors: number[][]): Matrix {
  const n = vectors.length;
  const data = new Array(n);
  for (let i = 0; i < n; i++) {
    data[i] = new Array(n);
    data[i][i] = 0;
    for (let j = i + 1; j < n; j++) {
      const sim = Math.max(0, cosine(vectors[i], vectors[j]));
      data[i][j] = sim;
    }
    for (let j = 0; j < i; j++) {
      data[i][j] = data[j][i];
    }
  }
  return new Matrix(data);
}

function normalizedLaplacian(affinity: Matrix): Matrix {
  const n = affinity.rows;
  const degrees = new Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) sum += affinity.get(i, j);
    }
    degrees[i] = sum;
  }

  const data = new Array(n);
  for (let i = 0; i < n; i++) {
    data[i] = new Array(n);
    for (let j = 0; j < n; j++) {
      if (i === j) {
        data[i][j] = 1;
      } else {
        const di = degrees[i];
        const dj = degrees[j];
        data[i][j] = (di > 1e-10 && dj > 1e-10) ? -affinity.get(i, j) / Math.sqrt(di * dj) : 0;
      }
    }
  }
  return new Matrix(data);
}

function findOptimalK(eigenvalues: number[], maxK: number): number {
  const sorted = [...eigenvalues].sort((a, b) => a - b);
  if (sorted.length <= 2) return Math.min(2, sorted.length);

  let bestGap = 0;
  let bestK = 2;
  const limit = Math.min(maxK, sorted.length - 1);

  for (let k = 2; k <= limit; k++) {
    const gap = sorted[k] - sorted[k - 1];
    if (gap > bestGap) {
      bestGap = gap;
      bestK = k;
    }
  }
  return bestK;
}

function kMeans(data: number[][], k: number): number[] {
  const n = data.length;
  const dim = data[0].length;
  const centroids: number[][] = [];
  const used = new Set<number>();

  centroids.push([...data[0]]);
  used.add(0);
  for (let c = 1; c < k; c++) {
    let bestIdx = 0;
    let bestDist = -1;
    for (let i = 0; i < n; i++) {
      if (used.has(i)) continue;
      let minDist = Infinity;
      for (const cen of centroids) {
        let d = 0;
        for (let d2 = 0; d2 < dim; d2++) d += (data[i][d2] - cen[d2]) ** 2;
        minDist = Math.min(minDist, d);
      }
      if (minDist > bestDist) { bestDist = minDist; bestIdx = i; }
    }
    centroids.push([...data[bestIdx]]);
    used.add(bestIdx);
  }

  const assignments = new Array(n).fill(0);

  for (let iter = 0; iter < 50; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestDist = Infinity;
      let bestC = 0;
      for (let c = 0; c < k; c++) {
        let dist = 0;
        for (let d = 0; d < dim; d++) dist += (data[i][d] - centroids[c][d]) ** 2;
        if (dist < bestDist) { bestDist = dist; bestC = c; }
      }
      if (assignments[i] !== bestC) { assignments[i] = bestC; changed = true; }
    }
    if (!changed) break;
    for (let c = 0; c < k; c++) {
      const members: number[] = [];
      for (let i = 0; i < n; i++) if (assignments[i] === c) members.push(i);
      if (members.length === 0) continue;
      for (let d = 0; d < dim; d++) {
        let sum = 0;
        for (const m of members) sum += data[m][d];
        centroids[c][d] = sum / members.length;
      }
    }
  }
  return assignments;
}

export function spectralCluster(vectors: number[][], maxClusters: number = 20): ClusterResult[] {
  const n = vectors.length;
  if (n <= 1) return [{ indices: Array.from({ length: n }, (_, i) => i) }];
  if (n <= maxClusters) return vectors.map((_, i) => ({ indices: [i] }));

  const affinity = buildAffinityMatrix(vectors);
  const laplacian = normalizedLaplacian(affinity);
  const eigen = new EigenvalueDecomposition(laplacian);

  const eigenvalues = eigen.realEigenvalues;
  const eigenvectors = eigen.eigenvectorMatrix;

  const k = findOptimalK(eigenvalues, Math.min(maxClusters, Math.max(2, Math.floor(Math.sqrt(n)))));

  const sortedIndices = eigenvalues
    .map((v: number, i: number) => ({ v, i }))
    .sort((a: { v: number }, b: { v: number }) => a.v - b.v)
    .map((x: { i: number }) => x.i);

  const embedding: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < k; j++) row.push(eigenvectors.get(i, sortedIndices[j]));
    const norm = Math.sqrt(row.reduce((s, v) => s + v * v, 0));
    if (norm > 1e-10) for (let d = 0; d < row.length; d++) row[d] /= norm;
    embedding.push(row);
  }

  const assignments = kMeans(embedding, k);

  const clusters: Map<number, number[]> = new Map();
  for (let i = 0; i < n; i++) {
    const c = assignments[i];
    if (!clusters.has(c)) clusters.set(c, []);
    clusters.get(c)!.push(i);
  }

  return Array.from(clusters.values()).map((indices) => ({ indices }));
}

export function findPathPattern(paths: string[]): string | null {
  if (paths.length <= 1) return null;

  const parts = paths.map((p) => p.split("/"));
  let commonPrefix = "";
  const minLen = Math.min(...parts.map((p) => p.length));
  for (let i = 0; i < minLen - 1; i++) {
    if (parts.every((p) => p[i] === parts[0][i])) {
      commonPrefix += parts[0][i] + "/";
    } else {
      break;
    }
  }

  const suffixes = paths.map((p) => p.split("/").pop()!);
  const allSameSuffix = suffixes.every((s) => s === suffixes[0]);

  if (commonPrefix && allSameSuffix) return `${commonPrefix}${suffixes[0]}`;
  if (commonPrefix) return `${commonPrefix}*`;
  if (allSameSuffix) return `*/${suffixes[0]}`;
  return null;
}
