// PoC test for CWE-22: Path traversal in shadow restore system
// FEATURE: Security regression test for path traversal in createRestorePoint / restorePoint

import { describe, it, after, before } from "node:test";
import assert from "node:assert/strict";
import {
  createRestorePoint,
  restorePoint,
} from "../../build/git/shadow.js";
import { writeFile, mkdir, rm, readFile, access } from "fs/promises";
import { join, resolve } from "path";

const FIXTURE_DIR = join(process.cwd(), "test", "_shadow_traversal_fixtures");
const OUTSIDE_DIR = join(process.cwd(), "test", "_shadow_traversal_outside");

async function setup() {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
  await rm(OUTSIDE_DIR, { recursive: true, force: true });
  await mkdir(FIXTURE_DIR, { recursive: true });
  await mkdir(OUTSIDE_DIR, { recursive: true });
}

async function cleanup() {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
  await rm(OUTSIDE_DIR, { recursive: true, force: true });
}

describe("shadow path traversal (CWE-22)", async () => {
  await setup();

  describe("createRestorePoint rejects traversal paths", () => {
    it("rejects file paths containing ../", async () => {
      // Create a sensitive file outside rootDir
      const secretPath = join(OUTSIDE_DIR, "secret.txt");
      await writeFile(secretPath, "TOP SECRET DATA");

      // Attempt to read it via path traversal
      // The relative traversal from FIXTURE_DIR to OUTSIDE_DIR:
      const traversalPath = "../_shadow_traversal_outside/secret.txt";

      // Verify the traversal would actually resolve outside rootDir
      const resolved = resolve(FIXTURE_DIR, traversalPath);
      assert.ok(!resolved.startsWith(FIXTURE_DIR + "/"), 
        `Traversal path should resolve outside rootDir: ${resolved}`);

      // This should throw or reject the traversal path
      await assert.rejects(
        () => createRestorePoint(FIXTURE_DIR, [traversalPath], "traversal attempt"),
        (err) => {
          // Accept any error that indicates the path was rejected
          return err instanceof Error && /outside|traversal|invalid|path/i.test(err.message);
        },
        "createRestorePoint should reject paths that traverse outside rootDir"
      );
    });
  });

  describe("restorePoint rejects traversal paths in manifest", () => {
    it("does not write files outside rootDir during restore", async () => {
      // First, create a legitimate restore point
      const testFile = "legit.txt";
      await writeFile(join(FIXTURE_DIR, testFile), "legit content");
      const point = await createRestorePoint(FIXTURE_DIR, [testFile], "legit backup");

      // Now manually tamper with the manifest to inject a traversal path
      const manifestPath = join(FIXTURE_DIR, ".mcp_data", "restore-points.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));

      // Add a traversal file to the existing restore point
      const traversalFile = "../_shadow_traversal_outside/pwned.txt";
      const tamperedPoint = {
        id: `rp-tampered-${Date.now()}`,
        timestamp: Date.now(),
        files: [traversalFile],
        message: "tampered"
      };

      // Create backup content for the tampered point
      const backupDir = join(FIXTURE_DIR, ".mcp_data", "backups", tamperedPoint.id);
      await mkdir(backupDir, { recursive: true });
      const backupFileName = traversalFile.replace(/[\\/]/g, "__");
      await writeFile(join(backupDir, backupFileName), "MALICIOUS CONTENT");

      // Save the tampered manifest
      manifest.push(tamperedPoint);
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      // Attempt restore — should reject the traversal path
      await assert.rejects(
        () => restorePoint(FIXTURE_DIR, tamperedPoint.id),
        (err) => {
          return err instanceof Error && /outside|traversal|invalid|path/i.test(err.message);
        },
        "restorePoint should reject paths that traverse outside rootDir"
      );

      // Verify the file was NOT written outside rootDir
      const pwnedPath = join(OUTSIDE_DIR, "pwned.txt");
      await assert.rejects(
        () => access(pwnedPath),
        "File should not have been written outside rootDir"
      );
    });
  });

  after(cleanup);
});
