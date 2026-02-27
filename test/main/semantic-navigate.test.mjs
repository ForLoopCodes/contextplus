// Semantic navigate structural tests without Ollama dependency
// Tests exports and function signatures of the navigate tool

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("semantic-navigate", () => {
  it("exports semanticNavigate as a function", async () => {
    const mod = await import("../../build/tools/semantic-navigate.js");
    assert.equal(typeof mod.semanticNavigate, "function");
  });

  it("semanticNavigate takes single options argument", async () => {
    const mod = await import("../../build/tools/semantic-navigate.js");
    assert.equal(mod.semanticNavigate.length, 1);
  });
});
