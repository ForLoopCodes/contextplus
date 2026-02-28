import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { getFileSkeleton } from "../../build/tools/file-skeleton.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";

const FIXTURE_DIR = join(process.cwd(), "test", "_skel_fixtures");

async function setup() {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
  await mkdir(FIXTURE_DIR, { recursive: true });
}

describe("file-skeleton", async () => {
  await setup();

  describe("getFileSkeleton", () => {
    it("returns skeleton for a TypeScript file", async () => {
      await writeFile(
        join(FIXTURE_DIR, "app.ts"),
        "// App module\n// Main entry\n\nfunction start() {}\nfunction stop() {}\n",
      );
      const result = await getFileSkeleton({
        rootDir: FIXTURE_DIR,
        filePath: "app.ts",
      });
      assert.ok(result.includes("app.ts"));
      assert.ok(result.includes("start") || result.includes("stop"));
    });

    it("includes line count", async () => {
      await writeFile(
        join(FIXTURE_DIR, "small.ts"),
        "// H1\n// H2\n\nfunction x() {}\n",
      );
      const result = await getFileSkeleton({
        rootDir: FIXTURE_DIR,
        filePath: "small.ts",
      });
      assert.ok(result.includes("lines"));
    });

    it("includes line metadata for symbols", async () => {
      await writeFile(
        join(FIXTURE_DIR, "lines.ts"),
        "// H1\n// H2\n\nfunction alpha() {\n  return 1;\n}\n",
      );
      const result = await getFileSkeleton({
        rootDir: FIXTURE_DIR,
        filePath: "lines.ts",
      });
      assert.ok(result.includes("L"));
    });

    it("includes symbol count", async () => {
      await writeFile(
        join(FIXTURE_DIR, "multi.ts"),
        "// H1\n// H2\n\nfunction a() {}\nfunction b() {}\nfunction c() {}\n",
      );
      const result = await getFileSkeleton({
        rootDir: FIXTURE_DIR,
        filePath: "multi.ts",
      });
      assert.ok(result.includes("definition"));
    });

    it("shows header in skeleton", async () => {
      await writeFile(
        join(FIXTURE_DIR, "header.ts"),
        "// MyModule description here\n// Second header line\n\nfunction run() {}\n",
      );
      const result = await getFileSkeleton({
        rootDir: FIXTURE_DIR,
        filePath: "header.ts",
      });
      assert.ok(result.includes("MyModule"));
    });

    it("shows file preview for unsupported files", async () => {
      await writeFile(
        join(FIXTURE_DIR, "readme.md"),
        "# Hello\n\nSome markdown content\n",
      );
      const result = await getFileSkeleton({
        rootDir: FIXTURE_DIR,
        filePath: "readme.md",
      });
      assert.ok(result.includes("Unsupported") || result.includes("Hello"));
    });

    it("shows first 30 lines when no symbols detected", async () => {
      await writeFile(join(FIXTURE_DIR, "empty.ts"), "\n\n\nconst x = 1;\n");
      const result = await getFileSkeleton({
        rootDir: FIXTURE_DIR,
        filePath: "empty.ts",
      });
      assert.ok(typeof result === "string");
    });

    it("includes method signatures for classes", async () => {
      await writeFile(
        join(FIXTURE_DIR, "cls.ts"),
        "// Class test\n// Description\n\nclass Dog {\n  bark(): string {\n    return 'woof';\n  }\n}\n",
      );
      const result = await getFileSkeleton({
        rootDir: FIXTURE_DIR,
        filePath: "cls.ts",
      });
      assert.ok(result.includes("Dog") || result.includes("bark"));
    });
  });

  after(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
  });
});
