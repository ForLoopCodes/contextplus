import { describe, it, before, after } from "node:test";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const { getBlastRadius } = await import("../../build/tools/blast-radius.js");

const FIXTURE = resolve("test/_demo_blast_fixtures");

before(async () => {
  await mkdir(join(FIXTURE, "src"), { recursive: true });
  await writeFile(
    join(FIXTURE, "src", "math.ts"),
    [
      "// Core math utilities for arithmetic calculations across modules",
      "// FEATURE: Math Engine",
      "",
      "export function add(a: number, b: number): number { return a + b; }",
      "export function multiply(a: number, b: number): number { return a * b; }",
    ].join("\n"),
  );
  await writeFile(
    join(FIXTURE, "src", "calculator.ts"),
    [
      "// Calculator module consuming math utilities for user-facing operations",
      "// FEATURE: Calculator UI",
      "",
      'import { add, multiply } from "./math";',
      "",
      "export function sumAll(nums: number[]): number { return nums.reduce(add, 0); }",
      "export function productAll(nums: number[]): number { return nums.reduce(multiply, 1); }",
    ].join("\n"),
  );
  await writeFile(
    join(FIXTURE, "src", "report.ts"),
    [
      "// Report generator using math utilities for statistics section",
      "// FEATURE: Reporting",
      "",
      'import { add } from "./math";',
      "",
      "export function total(values: number[]): number { return values.reduce(add, 0); }",
    ].join("\n"),
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("DEMO: get_blast_radius", () => {
  it("INPUT: symbol='add', file_context='src/math.ts'", async () => {
    const input = {
      rootDir: FIXTURE,
      symbolName: "add",
      fileContext: "src/math.ts",
    };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getBlastRadius(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: symbol='multiply' (no file_context)", async () => {
    const input = { rootDir: FIXTURE, symbolName: "multiply" };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getBlastRadius(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: symbol='nonExistentFunc'", async () => {
    const input = { rootDir: FIXTURE, symbolName: "nonExistentFunc" };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getBlastRadius(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });
});
