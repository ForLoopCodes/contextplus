import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("semantic-identifiers", () => {
  it("exports semanticIdentifierSearch as a function", async () => {
    const mod = await import("../../build/tools/semantic-identifiers.js");
    assert.equal(typeof mod.semanticIdentifierSearch, "function");
  });

  it("exports invalidateIdentifierSearchCache as a function", async () => {
    const mod = await import("../../build/tools/semantic-identifiers.js");
    assert.equal(typeof mod.invalidateIdentifierSearchCache, "function");
  });

  it("semanticIdentifierSearch uses single options parameter", async () => {
    const mod = await import("../../build/tools/semantic-identifiers.js");
    assert.equal(mod.semanticIdentifierSearch.length, 1);
  });
});
