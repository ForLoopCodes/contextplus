import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const {
  parseWikiLinks,
  parseCrossLinks,
  extractFeatureTag,
  parseHubFile,
  discoverHubs,
  findOrphanedFiles,
  formatHubLink,
} = await import("../../build/core/hub.js");

const FIXTURE = resolve("test/_hub_fixtures");

before(async () => {
  await mkdir(join(FIXTURE, "src"), { recursive: true });

  await writeFile(
    join(FIXTURE, "auth.md"),
    [
      "# Authentication",
      "",
      "Main auth feature hub.",
      "",
      "- [[src/login.ts|Handles user login flow]]",
      "- [[src/session.ts]]",
      "- [[src/missing.ts]]",
      "",
      "@linked-to [[payments]]",
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "src", "login.ts"),
    [
      "// Login flow handler for username/password authentication",
      "// FEATURE: Authentication",
      "",
      'export function login(user: string, pass: string) { return "ok"; }',
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "src", "session.ts"),
    [
      "// Session management with JWT token refresh logic",
      "// FEATURE: Authentication",
      "",
      'export function createSession() { return "session-id"; }',
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "src", "orphan.ts"),
    [
      "// Orphaned file not linked to any hub",
      "// FEATURE: Unknown",
      "",
      "export const value = 42;",
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "no-links.md"),
    "# Just a readme\n\nNo wikilinks here.",
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("parseWikiLinks", () => {
  it("extracts simple wikilinks", () => {
    const links = parseWikiLinks("See [[src/foo.ts]] and [[src/bar.ts]].");
    assert.equal(links.length, 2);
    assert.equal(links[0].target, "src/foo.ts");
    assert.equal(links[1].target, "src/bar.ts");
  });

  it("extracts wikilinks with descriptions", () => {
    const links = parseWikiLinks("[[src/auth.ts|Auth handler module]]");
    assert.equal(links.length, 1);
    assert.equal(links[0].target, "src/auth.ts");
    assert.equal(links[0].description, "Auth handler module");
  });

  it("deduplicates repeated links", () => {
    const links = parseWikiLinks("[[a.ts]] and [[a.ts]] again.");
    assert.equal(links.length, 1);
  });

  it("returns empty for no links", () => {
    const links = parseWikiLinks("No links here.");
    assert.equal(links.length, 0);
  });
});

describe("parseCrossLinks", () => {
  it("extracts @linked-to tags", () => {
    const cl = parseCrossLinks(
      "@linked-to [[payments]]\n@linked-to [[billing]]",
      "src/foo.ts",
    );
    assert.equal(cl.length, 2);
    assert.equal(cl[0].hubName, "payments");
    assert.equal(cl[1].hubName, "billing");
    assert.equal(cl[0].sourceFile, "src/foo.ts");
  });

  it("returns empty when no cross-links", () => {
    const cl = parseCrossLinks("No cross links.", "x.ts");
    assert.equal(cl.length, 0);
  });
});

describe("extractFeatureTag", () => {
  it("extracts FEATURE: from JS-style header", () => {
    const tag = extractFeatureTag("// Something\n// FEATURE: Auth Logic");
    assert.equal(tag, "Auth Logic");
  });

  it("extracts FEATURE: from Python-style header", () => {
    const tag = extractFeatureTag(
      "# Processor module\n# FEATURE: Data Pipeline",
    );
    assert.equal(tag, "Data Pipeline");
  });

  it("returns null when no FEATURE tag", () => {
    const tag = extractFeatureTag(
      "// Just a normal header\n// Nothing special",
    );
    assert.equal(tag, null);
  });
});

describe("parseHubFile", () => {
  it("parses hub with links and cross-links", async () => {
    const hub = await parseHubFile(join(FIXTURE, "auth.md"));
    assert.equal(hub.title, "Authentication");
    assert.equal(hub.links.length, 3);
    assert.equal(hub.links[0].target, "src/login.ts");
    assert.equal(hub.links[0].description, "Handles user login flow");
    assert.equal(hub.crossLinks.length, 1);
    assert.equal(hub.crossLinks[0].hubName, "payments");
  });
});

describe("discoverHubs", () => {
  it("finds md files with wikilinks", async () => {
    const hubs = await discoverHubs(FIXTURE);
    assert.ok(hubs.includes("auth.md"));
  });

  it("excludes md files without wikilinks", async () => {
    const hubs = await discoverHubs(FIXTURE);
    assert.ok(!hubs.includes("no-links.md"));
  });
});

describe("findOrphanedFiles", () => {
  it("identifies files not linked to any hub", async () => {
    const allFiles = ["src/login.ts", "src/session.ts", "src/orphan.ts"];
    const orphans = await findOrphanedFiles(FIXTURE, allFiles);
    assert.ok(orphans.includes("src/orphan.ts"));
    assert.ok(!orphans.includes("src/login.ts"));
    assert.ok(!orphans.includes("src/session.ts"));
  });
});

describe("formatHubLink", () => {
  it("formats link with description", () => {
    const line = formatHubLink("src/auth.ts", "Auth handler");
    assert.equal(line, "- [[src/auth.ts|Auth handler]]");
  });

  it("formats link without description", () => {
    const line = formatHubLink("src/auth.ts", "");
    assert.equal(line, "- [[src/auth.ts]]");
  });
});
