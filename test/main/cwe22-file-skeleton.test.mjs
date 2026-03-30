// PoC: CWE-22 path traversal in getFileSkeleton
// Demonstrates that file_path with ../ can escape rootDir

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { getFileSkeleton } from "../../build/tools/file-skeleton.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join, resolve } from "path";
import { tmpdir } from "os";

const FIXTURE_DIR = join(tmpdir(), "cwe22-skel-test-" + process.pid);
const OUTSIDE_DIR = join(tmpdir(), "cwe22-skel-outside-" + process.pid);

describe("CWE-22: path traversal in getFileSkeleton", async () => {
  // Setup: create a confined rootDir and a file outside it
  await rm(FIXTURE_DIR, { recursive: true, force: true });
  await rm(OUTSIDE_DIR, { recursive: true, force: true });
  await mkdir(FIXTURE_DIR, { recursive: true });
  await mkdir(OUTSIDE_DIR, { recursive: true });
  await writeFile(join(OUTSIDE_DIR, "secret.txt"), "SENSITIVE_DATA_LEAKED\n");
  await writeFile(join(FIXTURE_DIR, "safe.txt"), "safe content\n");

  it("should reject path traversal with ../ that escapes rootDir", async () => {
    // Compute a relative path from FIXTURE_DIR to OUTSIDE_DIR/secret.txt
    const relativePath = "../cwe22-skel-outside-" + process.pid + "/secret.txt";

    // Verify the traversal actually resolves outside rootDir
    const resolved = resolve(FIXTURE_DIR, relativePath);
    assert.ok(!resolved.startsWith(FIXTURE_DIR + "/"), "Precondition: path resolves outside rootDir");

    // This should throw or reject, NOT return the file contents
    await assert.rejects(
      () => getFileSkeleton({ rootDir: FIXTURE_DIR, filePath: relativePath }),
      (err) => {
        return err instanceof Error;
      },
      "getFileSkeleton should reject paths that escape rootDir"
    );
  });

  it("should reject absolute paths outside rootDir", async () => {
    const absolutePath = join(OUTSIDE_DIR, "secret.txt");

    await assert.rejects(
      () => getFileSkeleton({ rootDir: FIXTURE_DIR, filePath: absolutePath }),
      (err) => err instanceof Error,
      "getFileSkeleton should reject absolute paths outside rootDir"
    );
  });

  it("should still allow valid relative paths within rootDir", async () => {
    const result = await getFileSkeleton({ rootDir: FIXTURE_DIR, filePath: "safe.txt" });
    assert.ok(result.includes("safe content") || result.includes("Unsupported"), "Should return content for valid paths");
  });

  after(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true }).catch(() => {});
    await rm(OUTSIDE_DIR, { recursive: true, force: true }).catch(() => {});
  });
});
