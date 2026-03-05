// Semantic navigate structural tests without Ollama dependency
// Tests exports and function signatures of the navigate tool

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ollama } from "ollama";

describe("semantic-navigate", () => {
  it("exports semanticNavigate as a function", async () => {
    const mod = await import("../../build/tools/semantic-navigate.js");
    assert.equal(typeof mod.semanticNavigate, "function");
  });

  it("semanticNavigate takes single options argument", async () => {
    const mod = await import("../../build/tools/semantic-navigate.js");
    assert.equal(mod.semanticNavigate.length, 1);
  });

  it("skips data files and navigates source files", async () => {
    const { semanticNavigate } = await import("../../build/tools/semantic-navigate.js");
    const rootDir = await mkdtemp(join(tmpdir(), "contextplus-semantic-navigate-"));
    const originalEmbed = Ollama.prototype.embed;
    const originalChat = Ollama.prototype.chat;

    Ollama.prototype.embed = async function ({ input }) {
      const batch = Array.isArray(input) ? input : [input];
      return { embeddings: batch.map(() => [1, 0, 0]) };
    };
    Ollama.prototype.chat = async function () {
      return { message: { content: JSON.stringify(["Source file"]) } };
    };

    try {
      await writeFile(join(rootDir, "app.ts"), [
        "// Semantic navigate fixture header line one two three four",
        "// FEATURE: semantic navigate fixture for source-only clustering output",
        "export const meaning = 42;",
        "",
      ].join("\n"));
      await writeFile(
        join(rootDir, "data.json"),
        JSON.stringify({ rows: Array.from({ length: 10000 }, (_, idx) => ({ id: idx, value: `cell_${idx}` })) }),
      );

      const result = await semanticNavigate({ rootDir, maxDepth: 2, maxClusters: 5 });
      assert.match(result, /app\.ts/);
      assert.doesNotMatch(result, /data\.json/);
    } finally {
      Ollama.prototype.embed = originalEmbed;
      Ollama.prototype.chat = originalChat;
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
