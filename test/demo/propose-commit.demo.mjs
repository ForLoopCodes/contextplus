import { describe, it, before, after } from "node:test";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const { proposeCommit } = await import("../../build/tools/propose-commit.js");

const FIXTURE = resolve("test/_demo_commit_fixtures");

before(async () => {
  await mkdir(join(FIXTURE, "src"), { recursive: true });
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("DEMO: propose_commit", () => {
  it("INPUT: valid file with proper header + FEATURE tag", async () => {
    const input = {
      rootDir: FIXTURE,
      filePath: "src/valid.ts",
      newContent: [
        "// Payment processing module handling Stripe webhook events",
        "// FEATURE: Payment System",
        "",
        "export function processPayment(amount: number): boolean { return amount > 0; }",
      ].join("\n"),
    };
    console.log("\n--- INPUT ---");
    console.log(
      JSON.stringify(
        { ...input, newContent: input.newContent.split("\n") },
        null,
        2,
      ),
    );

    const output = await proposeCommit(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: file WITHOUT 2-line header", async () => {
    const input = {
      rootDir: FIXTURE,
      filePath: "src/no-header.ts",
      newContent: ["export function broken(): void {}"].join("\n"),
    };
    console.log("\n--- INPUT ---");
    console.log(
      JSON.stringify(
        { ...input, newContent: input.newContent.split("\n") },
        null,
        2,
      ),
    );

    const output = await proposeCommit(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: file with header but NO FEATURE tag", async () => {
    const input = {
      rootDir: FIXTURE,
      filePath: "src/no-feature.ts",
      newContent: [
        "// This module handles configuration loading from env vars",
        "// Uses dotenv under the hood for local development",
        "",
        "export function loadConfig(): Record<string, string> { return {}; }",
      ].join("\n"),
    };
    console.log("\n--- INPUT ---");
    console.log(
      JSON.stringify(
        { ...input, newContent: input.newContent.split("\n") },
        null,
        2,
      ),
    );

    const output = await proposeCommit(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: file with inline comments (violation)", async () => {
    const input = {
      rootDir: FIXTURE,
      filePath: "src/comments.ts",
      newContent: [
        "// Module with unauthorized inline comments scattered throughout code",
        "// FEATURE: Bad Example",
        "",
        "// This is not allowed",
        "export function bad(): void {}",
        "// Neither is this",
      ].join("\n"),
    };
    console.log("\n--- INPUT ---");
    console.log(
      JSON.stringify(
        { ...input, newContent: input.newContent.split("\n") },
        null,
        2,
      ),
    );

    const output = await proposeCommit(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });
});
