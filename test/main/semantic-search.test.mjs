import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { invalidateSearchCache } from "../../build/tools/semantic-search.js";

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
  });
});
