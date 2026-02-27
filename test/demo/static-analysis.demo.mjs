import { describe, it, before, after } from "node:test";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const { runStaticAnalysis } =
  await import("../../build/tools/static-analysis.js");

const FIXTURE = resolve("test/_demo_lint_fixtures");

before(async () => {
  await mkdir(FIXTURE, { recursive: true });
  await writeFile(
    join(FIXTURE, "good.py"),
    [
      "# Clean Python file with no syntax errors present",
      "# FEATURE: Demo Scripts",
      "",
      "def greet(name):",
      '    return f"Hello, {name}!"',
      "",
      "print(greet('World'))",
    ].join("\n"),
  );
  await writeFile(
    join(FIXTURE, "bad.py"),
    [
      "# Python file with deliberate syntax error for demo",
      "# FEATURE: Demo Scripts",
      "",
      "def broken(",
      "    return 42",
    ].join("\n"),
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("DEMO: run_static_analysis", () => {
  it("INPUT: valid Python file", async () => {
    const input = { rootDir: FIXTURE, targetPath: "good.py" };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await runStaticAnalysis(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: Python file with syntax error", async () => {
    const input = { rootDir: FIXTURE, targetPath: "bad.py" };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await runStaticAnalysis(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });
});
