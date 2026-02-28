import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("embedding-tracker", () => {
  it("exports startEmbeddingTracker", async () => {
    const mod = await import("../../build/core/embedding-tracker.js");
    assert.equal(typeof mod.startEmbeddingTracker, "function");
  });

  it("startEmbeddingTracker takes one options argument", async () => {
    const mod = await import("../../build/core/embedding-tracker.js");
    assert.equal(mod.startEmbeddingTracker.length, 1);
  });
});
