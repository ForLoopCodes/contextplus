import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Ollama } from "ollama";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

    it("re-embeds when content changes beyond first 8000 characters", async () => {
      const originalEmbed = Ollama.prototype.embed;
      const rootDir = await mkdtemp(join(tmpdir(), "contextplus-embed-"));
      let callCount = 0;
      Ollama.prototype.embed = async function ({ input }) {
        const batch = Array.isArray(input) ? input : [input];
        for (const value of batch) {
          if (value.length > 8000)
            throw new Error("input length exceeds context length");
        }
        callCount += batch.length;
        return { embeddings: batch.map(() => [1, 0, 0]) };
      };

      try {
        const index = new SearchIndex();
        const sharedPrefix = "x".repeat(8500);
        const firstDoc = [{
          path: "src/long.ts",
          header: "header",
          symbols: ["alpha"],
          content: `${sharedPrefix} tail_one`,
        }];
        const secondDoc = [{
          path: "src/long.ts",
          header: "header",
          symbols: ["alpha"],
          content: `${sharedPrefix} tail_two`,
        }];

        await index.index(firstDoc, rootDir);
        const firstPassCalls = callCount;
        assert.ok(firstPassCalls > 0);

        callCount = 0;
        await index.index(secondDoc, rootDir);
        assert.ok(callCount > 0);
      } finally {
        Ollama.prototype.embed = originalEmbed;
        await rm(rootDir, { recursive: true, force: true });
      }
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

    it("splits oversized text into chunks and merges vectors", async () => {
      const originalEmbed = Ollama.prototype.embed;
      const tailMarker = "__tail_marker__";
      const seenLengths = [];

      Ollama.prototype.embed = async function ({ input }) {
        const batch = Array.isArray(input) ? input : [input];
        for (const value of batch) {
          seenLengths.push(value.length);
          if (value.length > 8000)
            throw new Error("input length exceeds context length");
        }
        return {
          embeddings: batch.map((value) => [value.includes(tailMarker) ? 10 : 1]),
        };
      };

      try {
        const vectors = await fetchEmbedding(`${"a".repeat(9000)}${tailMarker}${"b".repeat(1000)}`);
        assert.equal(vectors.length, 1);
        assert.ok(vectors[0][0] > 1);
        assert.ok(seenLengths.every((length) => length <= 8000));
        assert.ok(seenLengths.length > 1);
      } finally {
        Ollama.prototype.embed = originalEmbed;
      }
    });

    it("keeps shrinking under strict context limits beyond eight retries", async () => {
      const originalEmbed = Ollama.prototype.embed;
      const seenLengths = [];

      Ollama.prototype.embed = async function ({ input }) {
        const batch = Array.isArray(input) ? input : [input];
        seenLengths.push(...batch.map((value) => value.length));
        if (batch.some((value) => value.length > 20)) {
          throw new Error("input length exceeds context length");
        }
        return { embeddings: batch.map((value) => [value.length]) };
      };

      try {
        const vectors = await fetchEmbedding("x".repeat(8000));
        assert.equal(vectors.length, 1);
        assert.ok(vectors[0][0] <= 20);
        assert.ok(seenLengths.length > 9);
      } finally {
        Ollama.prototype.embed = originalEmbed;
      }
    });

    it("forwards configured embed runtime options to Ollama", async () => {
      const originalEmbed = Ollama.prototype.embed;
      const previousEnv = {
        CONTEXTPLUS_EMBED_NUM_GPU: process.env.CONTEXTPLUS_EMBED_NUM_GPU,
        CONTEXTPLUS_EMBED_MAIN_GPU: process.env.CONTEXTPLUS_EMBED_MAIN_GPU,
        CONTEXTPLUS_EMBED_NUM_THREAD: process.env.CONTEXTPLUS_EMBED_NUM_THREAD,
        CONTEXTPLUS_EMBED_NUM_BATCH: process.env.CONTEXTPLUS_EMBED_NUM_BATCH,
        CONTEXTPLUS_EMBED_NUM_CTX: process.env.CONTEXTPLUS_EMBED_NUM_CTX,
        CONTEXTPLUS_EMBED_LOW_VRAM: process.env.CONTEXTPLUS_EMBED_LOW_VRAM,
      };
      const requests = [];

      process.env.CONTEXTPLUS_EMBED_NUM_GPU = "1";
      process.env.CONTEXTPLUS_EMBED_MAIN_GPU = "0";
      process.env.CONTEXTPLUS_EMBED_NUM_THREAD = "6";
      process.env.CONTEXTPLUS_EMBED_NUM_BATCH = "64";
      process.env.CONTEXTPLUS_EMBED_NUM_CTX = "4096";
      process.env.CONTEXTPLUS_EMBED_LOW_VRAM = "true";

      Ollama.prototype.embed = async function (request) {
        requests.push(request);
        const batch = Array.isArray(request.input) ? request.input : [request.input];
        return { embeddings: batch.map((value) => [value.length]) };
      };

      try {
        const vectors = await fetchEmbedding("gpu options probe");
        assert.equal(vectors.length, 1);
        assert.ok(requests.length > 0);
        assert.deepEqual(requests[0].options, {
          num_gpu: 1,
          main_gpu: 0,
          num_thread: 6,
          num_batch: 64,
          num_ctx: 4096,
          low_vram: true,
        });
      } finally {
        Ollama.prototype.embed = originalEmbed;
        for (const [key, value] of Object.entries(previousEnv)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    });
  });
});
