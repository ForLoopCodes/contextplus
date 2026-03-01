import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Ollama } from "ollama";
import {
  SearchIndex,
  fetchEmbedding,
  getEmbeddingBatchSize,
} from "../../build/core/embeddings.js";

describe("embeddings", () => {
  describe("getEmbeddingBatchSize", () => {
    it("returns a GPU-safe value between 5 and 10", () => {
      const value = getEmbeddingBatchSize();
      assert.ok(value >= 5 && value <= 10);
    });
  });

  describe("SearchIndex", () => {
    it("creates an instance", () => {
      const index = new SearchIndex();
      assert.ok(index);
    });

    it("has zero documents initially", () => {
      const index = new SearchIndex();
      assert.equal(index.getDocumentCount(), 0);
    });

    it("index method exists", () => {
      const index = new SearchIndex();
      assert.equal(typeof index.index, "function");
    });

    it("search method exists", () => {
      const index = new SearchIndex();
      assert.equal(typeof index.search, "function");
    });

    it("getDocumentCount method exists", () => {
      const index = new SearchIndex();
      assert.equal(typeof index.getDocumentCount, "function");
    });
  });

  describe("fetchEmbedding", () => {
    it("splits failing batches and preserves embedding order", async () => {
      const originalEmbed = Ollama.prototype.embed;
      const calls = [];
      Ollama.prototype.embed = async function ({ input }) {
        const batch = Array.isArray(input) ? input : [input];
        calls.push(batch.map((value) => value.length));
        if (batch.length > 1)
          throw new Error("the input length exceeds the context length");
        return { embeddings: batch.map((value) => [value.length]) };
      };

      try {
        const inputs = ["alpha", "beta", "gamma", "delta", "epsilon"];
        const vectors = await fetchEmbedding(inputs);
        assert.deepEqual(vectors, [[5], [4], [5], [5], [7]]);
        assert.ok(calls.some((batch) => batch.length > 1));
        assert.ok(calls.some((batch) => batch.length === 1));
      } finally {
        Ollama.prototype.embed = originalEmbed;
      }
    });

    it("shrinks oversized single inputs until they fit context", async () => {
      const originalEmbed = Ollama.prototype.embed;
      const seenLengths = [];
      Ollama.prototype.embed = async function ({ input }) {
        const batch = Array.isArray(input) ? input : [input];
        seenLengths.push(batch[0].length);
        if (batch[0].length > 400)
          throw new Error("input length exceeds context length");
        return { embeddings: [[batch[0].length]] };
      };

      try {
        const vectors = await fetchEmbedding("x".repeat(2048));
        assert.equal(vectors.length, 1);
        assert.ok(vectors[0][0] <= 400);
        assert.ok(seenLengths.length > 1);
      } finally {
        Ollama.prototype.embed = originalEmbed;
      }
    });
  });
});
