import { describe, it, before, after } from "node:test";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const { getContextTree } = await import("../../build/tools/context-tree.js");

const FIXTURE = resolve("test/_demo_ctx_fixtures");

before(async () => {
  await mkdir(join(FIXTURE, "src", "utils"), { recursive: true });
  await writeFile(
    join(FIXTURE, "src", "app.ts"),
    [
      "// Main application entry point with server bootstrap",
      "// FEATURE: Core Application",
      "",
      "export function startServer(port: number): void {}",
      "export function stopServer(): void {}",
    ].join("\n"),
  );
  await writeFile(
    join(FIXTURE, "src", "utils", "helpers.ts"),
    [
      "// Shared utility functions for string and date formatting",
      "// FEATURE: Core Utilities",
      "",
      "export function formatDate(d: Date): string { return d.toISOString(); }",
      "export function slugify(text: string): string { return text.toLowerCase(); }",
    ].join("\n"),
  );
  await writeFile(
    join(FIXTURE, "src", "auth.ts"),
    [
      "// JWT authentication middleware for protected routes",
      "// FEATURE: Authentication",
      "",
      "export interface AuthConfig { secret: string; ttl: number; }",
      "export function verifyToken(token: string): boolean { return true; }",
    ].join("\n"),
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("DEMO: get_context_tree", () => {
  it("INPUT: rootDir, depth_limit=2, include_symbols=true", async () => {
    const input = {
      rootDir: FIXTURE,
      depthLimit: 2,
      includeSymbols: true,
      maxTokens: 5000,
    };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getContextTree(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: rootDir, depth_limit=1, include_symbols=false", async () => {
    const input = {
      rootDir: FIXTURE,
      depthLimit: 1,
      includeSymbols: false,
      maxTokens: 5000,
    };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getContextTree(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });
});
