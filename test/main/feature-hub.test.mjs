import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const { getFeatureHub } = await import("../../build/tools/feature-hub.js");

const FIXTURE = resolve("test/_fhub_fixtures");

before(async () => {
  await mkdir(join(FIXTURE, "src"), { recursive: true });

  await writeFile(
    join(FIXTURE, "auth.md"),
    [
      "# Authentication",
      "",
      "- [[src/login.ts|Login flow handler]]",
      "- [[src/session.ts|Token refresh logic]]",
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "src", "login.ts"),
    [
      "// Login flow handler for username/password authentication",
      "// FEATURE: Authentication",
      "",
      'export function login(user: string) { return "ok"; }',
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "src", "session.ts"),
    [
      "// Session management with JWT token refresh logic",
      "// FEATURE: Authentication",
      "",
      'export function createSession() { return "sid"; }',
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "src", "orphan.ts"),
    [
      "// Orphaned utility with no hub linkage",
      "// FEATURE: None",
      "",
      "export const x = 1;",
    ].join("\n"),
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("getFeatureHub", () => {
  it("lists all hubs when no args provided", async () => {
    const result = await getFeatureHub({ rootDir: FIXTURE });
    assert.ok(result.includes("auth.md"));
    assert.ok(result.includes("Feature Hubs"));
  });

  it("returns bundled skeletons for a specific hub", async () => {
    const result = await getFeatureHub({
      rootDir: FIXTURE,
      hubPath: "auth.md",
    });
    assert.ok(result.includes("Authentication"));
    assert.ok(result.includes("src/login.ts"));
    assert.ok(result.includes("src/session.ts"));
  });

  it("shows description for linked files", async () => {
    const result = await getFeatureHub({
      rootDir: FIXTURE,
      hubPath: "auth.md",
    });
    assert.ok(result.includes("Login flow handler"));
  });

  it("finds hub by feature name", async () => {
    const result = await getFeatureHub({
      rootDir: FIXTURE,
      featureName: "auth",
    });
    assert.ok(result.includes("Authentication"));
  });

  it("shows orphaned files", async () => {
    const result = await getFeatureHub({ rootDir: FIXTURE, showOrphans: true });
    assert.ok(result.includes("orphan.ts"));
  });

  it("reports no hub found for unknown feature", async () => {
    const result = await getFeatureHub({
      rootDir: FIXTURE,
      featureName: "nonexistent",
    });
    assert.ok(result.includes("No hub found"));
  });

  it("reports missing linked files", async () => {
    await writeFile(
      join(FIXTURE, "broken.md"),
      "# Broken\n\n- [[src/does-not-exist.ts]]",
    );
    const result = await getFeatureHub({
      rootDir: FIXTURE,
      hubPath: "broken.md",
    });
    assert.ok(
      result.includes("Missing Links") || result.includes("does-not-exist"),
    );
    await rm(join(FIXTURE, "broken.md"));
  });
});
