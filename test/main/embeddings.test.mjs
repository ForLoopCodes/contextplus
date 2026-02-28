import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SearchIndex,
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
});
