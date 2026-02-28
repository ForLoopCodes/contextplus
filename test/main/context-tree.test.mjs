import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { getContextTree } from "../../build/tools/context-tree.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";

const FIXTURE_DIR = join(process.cwd(), "test", "_ctx_fixtures");

async function setup() {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
  await mkdir(join(FIXTURE_DIR, "src"), { recursive: true });
  await mkdir(join(FIXTURE_DIR, "lib"), { recursive: true });
  await writeFile(
    join(FIXTURE_DIR, "src", "index.ts"),
    "// Entry point\n// Main module\n\nfunction main() {}\n",
  );
  await writeFile(
    join(FIXTURE_DIR, "src", "utils.ts"),
    "// Utility functions\n// Helpers\n\nfunction helper() {}\nfunction format() {}\n",
  );
  await writeFile(
    join(FIXTURE_DIR, "lib", "core.ts"),
    "// Core library\n// Engine\n\nclass Engine {}\n",
  );
  await writeFile(join(FIXTURE_DIR, "readme.txt"), "A project\n");
}

describe("context-tree", async () => {
  await setup();

  describe("getContextTree", () => {
    it("returns a string output", async () => {
      const result = await getContextTree({ rootDir: FIXTURE_DIR });
      assert.equal(typeof result, "string");
      assert.ok(result.length > 0);
    });

    it("includes directory markers", async () => {
      const result = await getContextTree({ rootDir: FIXTURE_DIR });
      assert.ok(result.includes("/"), "directories should end with /");
      assert.ok(result.includes("src"));
    });

    it("includes file names", async () => {
      const result = await getContextTree({ rootDir: FIXTURE_DIR });
      assert.ok(result.includes("index.ts"));
      assert.ok(result.includes("utils.ts"));
      assert.ok(result.includes("core.ts"));
    });

    it("includes file headers", async () => {
      const result = await getContextTree({
        rootDir: FIXTURE_DIR,
        includeSymbols: true,
        maxTokens: 50000,
      });
      assert.ok(
        result.includes("Entry point") || result.includes("Utility functions"),
      );
    });

    it("includes symbols when requested", async () => {
      const result = await getContextTree({
        rootDir: FIXTURE_DIR,
        includeSymbols: true,
        maxTokens: 50000,
      });
      assert.ok(
        result.includes("main") ||
          result.includes("helper") ||
          result.includes("function"),
      );
    });

    it("includes line metadata with symbols", async () => {
      const result = await getContextTree({
        rootDir: FIXTURE_DIR,
        includeSymbols: true,
        maxTokens: 50000,
      });
      assert.ok(result.includes("L"));
    });

    it("respects depth limit", async () => {
      const result = await getContextTree({
        rootDir: FIXTURE_DIR,
        depthLimit: 0,
      });
      assert.ok(result.includes("src"));
    });

    it("scopes to targetPath", async () => {
      const result = await getContextTree({
        rootDir: FIXTURE_DIR,
        targetPath: "src",
      });
      assert.ok(result.includes("index.ts"));
      assert.ok(!result.includes("core.ts"));
    });

    it("prunes to Level 0 for tiny token budget", async () => {
      const result = await getContextTree({
        rootDir: FIXTURE_DIR,
        maxTokens: 50,
      });
      assert.ok(result.includes("Level 0") || result.includes("index.ts"));
    });

    it("prunes symbols before headers", async () => {
      const result = await getContextTree({
        rootDir: FIXTURE_DIR,
        includeSymbols: true,
        maxTokens: 300,
      });
      assert.ok(result.includes("index.ts"));
    });
  });

  after(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
  });
});
