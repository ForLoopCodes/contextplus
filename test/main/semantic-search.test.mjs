import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ollama } from "ollama";
import { invalidateSearchCache, semanticCodeSearch } from "../../build/tools/semantic-search.js";

describe("semantic-search", () => {
  describe("invalidateSearchCache", () => {
    it("is a function", () => {
      assert.equal(typeof invalidateSearchCache, "function");
    });

    it("does not throw when called", () => {
      assert.doesNotThrow(() => invalidateSearchCache());
    });

    it("can be called multiple times", () => {
      invalidateSearchCache();
      invalidateSearchCache();
      invalidateSearchCache();
      assert.ok(true);
    });
  });

  describe("semanticCodeSearch (structural)", () => {
    it("is exported as a function", async () => {
      const mod = await import("../../build/tools/semantic-search.js");
      assert.equal(typeof mod.semanticCodeSearch, "function");
    });

    it("has expected parameter signature (rootDir, query, topK)", async () => {
      const mod = await import("../../build/tools/semantic-search.js");
      assert.equal(mod.semanticCodeSearch.length, 1);
    });

    it("skips oversized data files and still indexes source files", async () => {
      const rootDir = await mkdtemp(join(tmpdir(), "contextplus-semantic-search-"));
      const originalEmbed = Ollama.prototype.embed;
      const previousSizeLimit = process.env.CONTEXTPLUS_MAX_EMBED_FILE_SIZE;

      Ollama.prototype.embed = async function ({ input }) {
        const batch = Array.isArray(input) ? input : [input];
        return { embeddings: batch.map((value) => [value.includes("greet") ? 1 : 0.25]) };
      };

      process.env.CONTEXTPLUS_MAX_EMBED_FILE_SIZE = "1024";

      try {
        await writeFile(join(rootDir, "app.ts"), [
          "// Semantic search fixture header line one two three four",
          "// FEATURE: semantic search fixture coverage for mixed data projects",
          "export function greet(name: string): string {",
          "  return `hello ${name}`;",
          "}",
          "",
        ].join("\n"));
        await writeFile(
          join(rootDir, "data.json"),
          JSON.stringify({
            rows: Array.from({ length: 50000 }, (_, idx) => ({ id: idx, value: `payload_${idx}` })),
          }),
        );

        invalidateSearchCache();
        const result = await semanticCodeSearch({ rootDir, query: "greet", topK: 3 });
        assert.match(result, /app\.ts/);
        assert.doesNotMatch(result, /data\.json/);
      } finally {
        if (previousSizeLimit === undefined) delete process.env.CONTEXTPLUS_MAX_EMBED_FILE_SIZE;
        else process.env.CONTEXTPLUS_MAX_EMBED_FILE_SIZE = previousSizeLimit;
        Ollama.prototype.embed = originalEmbed;
        await rm(rootDir, { recursive: true, force: true });
      }
    });
  });
});
