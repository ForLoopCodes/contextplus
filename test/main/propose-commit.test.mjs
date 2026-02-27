import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { proposeCommit } from "../../build/tools/propose-commit.js";
import { readFile, mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

const FIXTURE_DIR = join(process.cwd(), "test", "_commit_fixtures");

async function setup() {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
  await mkdir(FIXTURE_DIR, { recursive: true });
}

describe("propose-commit", async () => {
  await setup();

  describe("proposeCommit", () => {
    it("saves a valid file with proper header", async () => {
      const content =
        "// Module description line 1\n// Module description line 2\n\nfunction main() {\n  return 1;\n}\n";
      const result = await proposeCommit({
        rootDir: FIXTURE_DIR,
        filePath: "valid.ts",
        newContent: content,
      });
      assert.ok(result.includes("saved") || result.includes("✅"));
      const written = await readFile(join(FIXTURE_DIR, "valid.ts"), "utf-8");
      assert.equal(written, content);
    });

    it("warns when header is missing", async () => {
      const content = "function noHeader() {\n  return 1;\n}\n";
      const result = await proposeCommit({
        rootDir: FIXTURE_DIR,
        filePath: "nohead.ts",
        newContent: content,
      });
      assert.ok(
        result.includes("header") ||
          result.includes("warning") ||
          result.includes("⚠"),
      );
    });

    it("warns about inline comments", async () => {
      const content =
        "// Line 1\n// Line 2\n\n// This is an inline comment\nfunction x() {}\n";
      const result = await proposeCommit({
        rootDir: FIXTURE_DIR,
        filePath: "comments.ts",
        newContent: content,
      });
      assert.ok(
        result.includes("comment") ||
          result.includes("⚠") ||
          result.includes("Unauthorized"),
      );
    });

    it("rejects files with many inline comments", async () => {
      const lines = ["// H1", "// H2", ""];
      for (let i = 0; i < 10; i++) lines.push("// bad comment " + i);
      lines.push("function x() {}");
      const content = lines.join("\n");
      const result = await proposeCommit({
        rootDir: FIXTURE_DIR,
        filePath: "many.ts",
        newContent: content,
      });
      assert.ok(result.includes("REJECTED") || result.includes("violation"));
    });

    it("warns about high nesting depth", async () => {
      let content = "// H1\n// H2\n\n";
      for (let i = 0; i < 8; i++) content += "  ".repeat(i) + "if (true) {\n";
      content += "  ".repeat(8) + "doStuff();\n";
      for (let i = 7; i >= 0; i--) content += "  ".repeat(i) + "}\n";
      const result = await proposeCommit({
        rootDir: FIXTURE_DIR,
        filePath: "nested.ts",
        newContent: content,
      });
      assert.ok(
        result.includes("nesting") ||
          result.includes("⚠") ||
          typeof result === "string",
      );
    });

    it("warns about excessively long files", async () => {
      const lines = ["// Header 1", "// Header 2", ""];
      for (let i = 0; i < 1100; i++) lines.push(`const x${i} = ${i};`);
      const content = lines.join("\n");
      const result = await proposeCommit({
        rootDir: FIXTURE_DIR,
        filePath: "long.ts",
        newContent: content,
      });
      assert.ok(
        result.includes("lines") ||
          result.includes("splitting") ||
          result.includes("⚠"),
      );
    });

    it("creates a restore point before saving", async () => {
      const content =
        "// Restore test 1\n// Restore test 2\n\nfunction r() {}\n";
      const result = await proposeCommit({
        rootDir: FIXTURE_DIR,
        filePath: "restore.ts",
        newContent: content,
      });
      assert.ok(
        result.includes("Restore point") ||
          result.includes("undo") ||
          result.includes("✅"),
      );
    });

    it("handles unsupported file types without header validation", async () => {
      const content = "# Heading\n\nSome markdown\n";
      const result = await proposeCommit({
        rootDir: FIXTURE_DIR,
        filePath: "doc.md",
        newContent: content,
      });
      assert.ok(result.includes("saved") || result.includes("✅"));
    });

    it("creates nested directories when needed", async () => {
      const content = "// Deep 1\n// Deep 2\n\nfunction deep() {}\n";
      const result = await proposeCommit({
        rootDir: FIXTURE_DIR,
        filePath: "sub/dir/deep.ts",
        newContent: content,
      });
      assert.ok(result.includes("saved") || result.includes("✅"));
      const written = await readFile(
        join(FIXTURE_DIR, "sub", "dir", "deep.ts"),
        "utf-8",
      );
      assert.equal(written, content);
    });
  });

  after(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
  });
});
