// Test: CWE-78 command injection via targetPath in static analysis
// Verifies that shell metacharacters in targetPath cannot be used for injection

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdir, writeFile, rm, readFile } from "fs/promises";
import { resolve, join } from "path";

const { runStaticAnalysis } =
  await import("../../build/tools/static-analysis.js");

const FIXTURE = resolve("test/_injection_fixtures");
const SENTINEL = join(FIXTURE, "pwned.txt");

before(async () => {
  await mkdir(FIXTURE, { recursive: true });
  await writeFile(
    join(FIXTURE, "safe.py"),
    "# Safe python file\n# FEATURE: test\nprint('hello')\n",
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("CWE-78: command injection via targetPath", () => {
  it("should not execute injected commands via $() with .py extension", async () => {
    // This payload ends in .py so it matches the Python linter
    // The $() will be interpreted by the shell in exec()
    const maliciousPath = `$(echo INJECTED > ${SENTINEL}).py`;
    try {
      await runStaticAnalysis({ rootDir: FIXTURE, targetPath: maliciousPath });
    } catch {
      // errors are acceptable – injection must not succeed
    }

    let injected = false;
    try {
      await readFile(SENTINEL, "utf-8");
      injected = true;
    } catch {
      injected = false;
    }
    assert.strictEqual(injected, false, "Command injection via $() succeeded – sentinel file was created");
  });

  it("should not execute injected commands via backticks with .py extension", async () => {
    const maliciousPath = "`echo INJECTED > " + SENTINEL + "`.py";
    try {
      await runStaticAnalysis({ rootDir: FIXTURE, targetPath: maliciousPath });
    } catch {
      // errors are acceptable – injection must not succeed
    }

    let injected = false;
    try {
      await readFile(SENTINEL, "utf-8");
      injected = true;
    } catch {
      injected = false;
    }
    assert.strictEqual(injected, false, "Command injection via backticks succeeded – sentinel file was created");
  });

  it("should not execute injected commands via semicolon ending with .py", async () => {
    // Craft: foo; echo INJECTED > sentinel; echo.py
    const maliciousPath = `foo; echo INJECTED > ${SENTINEL}; echo.py`;
    try {
      await runStaticAnalysis({ rootDir: FIXTURE, targetPath: maliciousPath });
    } catch {
      // errors are acceptable – injection must not succeed
    }

    let injected = false;
    try {
      await readFile(SENTINEL, "utf-8");
      injected = true;
    } catch {
      injected = false;
    }
    assert.strictEqual(injected, false, "Command injection via semicolon succeeded – sentinel file was created");
  });

  it("should not execute injected commands via pipe ending with .py", async () => {
    const maliciousPath = `safe.py | tee ${SENTINEL} | cat foo.py`;
    try {
      await runStaticAnalysis({ rootDir: FIXTURE, targetPath: maliciousPath });
    } catch {
      // errors are acceptable – injection must not succeed
    }

    let injected = false;
    try {
      await readFile(SENTINEL, "utf-8");
      injected = true;
    } catch {
      injected = false;
    }
    assert.strictEqual(injected, false, "Command injection via pipe succeeded – sentinel file was created");
  });
});
