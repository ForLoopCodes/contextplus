// Spectral clustering and path pattern tests
// Tests eigengap clustering, k-means, and file path pattern detection

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spectralCluster, findPathPattern } from "../../build/core/clustering.js";

describe("clustering", () => {
  describe("spectralCluster", () => {
    it("returns single cluster for 1 vector", () => {
      const result = spectralCluster([[1, 0, 0]]);
      assert.equal(result.length, 1);
      assert.deepEqual(result[0].indices, [0]);
    });

    it("returns individual clusters when n <= maxClusters", () => {
      const vectors = [
        [1, 0],
        [0, 1],
        [0.5, 0.5],
      ];
      const result = spectralCluster(vectors, 20);
      assert.equal(result.length, 3);
    });

    it("clusters similar vectors together", () => {
      const vectors = [
        [1, 0, 0],
        [0.9, 0.1, 0],
        [0.95, 0.05, 0],
        [0, 1, 0],
        [0.1, 0.9, 0],
        [0.05, 0.95, 0],
      ];
      const result = spectralCluster(vectors, 2);
      assert.ok(result.length >= 1);
      const allIndices = result.flatMap((c) => c.indices).sort();
      assert.deepEqual(allIndices, [0, 1, 2, 3, 4, 5]);
    });

    it("respects maxClusters parameter", () => {
      const vectors = Array.from({ length: 50 }, (_, i) => [
        Math.cos(i),
        Math.sin(i),
        i / 50,
      ]);
      const result = spectralCluster(vectors, 5);
      assert.ok(result.length <= 5);
      assert.ok(result.length >= 1);
    });

    it("covers all indices exactly once", () => {
      const n = 30;
      const vectors = Array.from({ length: n }, (_, i) => [
        Math.cos(i * 0.5),
        Math.sin(i * 0.5),
        i / n,
      ]);
      const result = spectralCluster(vectors, 10);
      const allIndices = result.flatMap((c) => c.indices).sort((a, b) => a - b);
      assert.equal(allIndices.length, n);
      assert.deepEqual(
        allIndices,
        Array.from({ length: n }, (_, i) => i),
      );
    });

    it("handles identical vectors", () => {
      const vectors = [
        [1, 0, 0],
        [1, 0, 0],
        [1, 0, 0],
      ];
      const result = spectralCluster(vectors, 20);
      assert.ok(result.length >= 1);
    });
  });

  describe("findPathPattern", () => {
    it("returns null for single path", () => {
      assert.equal(findPathPattern(["src/index.ts"]), null);
    });

    it("finds common prefix", () => {
      const result = findPathPattern([
        "src/core/parser.ts",
        "src/core/walker.ts",
      ]);
      assert.equal(result, "src/core/*");
    });

    it("finds common suffix", () => {
      const result = findPathPattern(["src/types.ts", "lib/types.ts"]);
      assert.equal(result, "*/types.ts");
    });

    it("finds both prefix and suffix", () => {
      const result = findPathPattern(["test/a/index.ts", "test/b/index.ts"]);
      assert.equal(result, "test/index.ts");
    });

    it("returns null when no common pattern", () => {
      const result = findPathPattern([
        "src/app.ts",
        "lib/utils.js",
        "test/main.py",
      ]);
      assert.equal(result, null);
    });

    it("returns null for empty array", () => {
      const result = findPathPattern([]);
      assert.equal(result, null);
    });
  });
});
