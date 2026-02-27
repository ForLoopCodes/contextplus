import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  createRestorePoint,
  restorePoint,
  listRestorePoints,
} from "../../build/git/shadow.js";
import { writeFile, mkdir, rm, readFile } from "fs/promises";
import { join } from "path";

const FIXTURE_DIR = join(process.cwd(), "test", "_shadow_fixtures");

async function setup() {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
  await mkdir(FIXTURE_DIR, { recursive: true });
}

async function cleanup() {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
}

describe("shadow", async () => {
  await setup();

  describe("listRestorePoints", () => {
    it("returns empty array when no restore points exist", async () => {
      const points = await listRestorePoints(FIXTURE_DIR);
      assert.ok(Array.isArray(points));
      assert.equal(points.length, 0);
    });
  });

  describe("createRestorePoint", () => {
    it("creates a restore point with id and timestamp", async () => {
      await writeFile(join(FIXTURE_DIR, "file1.txt"), "original content");
      const point = await createRestorePoint(
        FIXTURE_DIR,
        ["file1.txt"],
        "test backup",
      );
      assert.ok(point.id.startsWith("rp-"));
      assert.ok(point.timestamp > 0);
      assert.deepEqual(point.files, ["file1.txt"]);
      assert.equal(point.message, "test backup");
    });

    it("appears in listRestorePoints after creation", async () => {
      const points = await listRestorePoints(FIXTURE_DIR);
      assert.ok(points.length >= 1);
      assert.ok(points.some((p) => p.message === "test backup"));
    });

    it("can create multiple restore points", async () => {
      await writeFile(join(FIXTURE_DIR, "file2.txt"), "second file");
      await createRestorePoint(FIXTURE_DIR, ["file2.txt"], "backup 2");
      const points = await listRestorePoints(FIXTURE_DIR);
      assert.ok(points.length >= 2);
    });

    it("handles non-existent files gracefully", async () => {
      const point = await createRestorePoint(
        FIXTURE_DIR,
        ["nonexistent.txt"],
        "empty backup",
      );
      assert.ok(point.id);
    });
  });

  describe("restorePoint", () => {
    it("restores file contents from a backup", async () => {
      await writeFile(join(FIXTURE_DIR, "restore_test.txt"), "before change");
      const point = await createRestorePoint(
        FIXTURE_DIR,
        ["restore_test.txt"],
        "pre-change",
      );
      await writeFile(join(FIXTURE_DIR, "restore_test.txt"), "after change");
      const content1 = await readFile(
        join(FIXTURE_DIR, "restore_test.txt"),
        "utf-8",
      );
      assert.equal(content1, "after change");
      const restoredFiles = await restorePoint(FIXTURE_DIR, point.id);
      assert.ok(restoredFiles.includes("restore_test.txt"));
      const content2 = await readFile(
        join(FIXTURE_DIR, "restore_test.txt"),
        "utf-8",
      );
      assert.equal(content2, "before change");
    });

    it("throws for non-existent restore point", async () => {
      await assert.rejects(() => restorePoint(FIXTURE_DIR, "rp-nonexistent"), {
        message: /not found/,
      });
    });

    it("returns list of restored files", async () => {
      await writeFile(join(FIXTURE_DIR, "multi1.txt"), "a");
      await writeFile(join(FIXTURE_DIR, "multi2.txt"), "b");
      const point = await createRestorePoint(
        FIXTURE_DIR,
        ["multi1.txt", "multi2.txt"],
        "multi backup",
      );
      await writeFile(join(FIXTURE_DIR, "multi1.txt"), "changed");
      const restored = await restorePoint(FIXTURE_DIR, point.id);
      assert.ok(restored.length >= 2);
    });
  });

  after(cleanup);
});
