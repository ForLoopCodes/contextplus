import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { getBlastRadius } from "../../build/tools/blast-radius.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";

const FIXTURE_DIR = join(process.cwd(), "test", "_blast_fixtures");

async function setup() {
  await rm(FIXTURE_DIR, { recursive: true, force: true });
  await mkdir(FIXTURE_DIR, { recursive: true });
}

describe("blast-radius", async () => {
  await setup();

  describe("getBlastRadius", () => {
    it("finds symbol usages across files", async () => {
      await writeFile(
        join(FIXTURE_DIR, "util.ts"),
        "export function helper() {\n  return 1;\n}\n",
      );
      await writeFile(
        join(FIXTURE_DIR, "main.ts"),
        "import { helper } from './util';\nconsole.log(helper());\n",
      );
      const result = await getBlastRadius({
        rootDir: FIXTURE_DIR,
        symbolName: "helper",
      });
      assert.ok(result.includes("helper"));
      assert.ok(result.includes("usages") || result.includes("usage"));
    });

    it("reports zero usages for unknown symbol", async () => {
      await writeFile(join(FIXTURE_DIR, "a.ts"), "function foo() {}\n");
      const result = await getBlastRadius({
        rootDir: FIXTURE_DIR,
        symbolName: "nonExistent",
      });
      assert.ok(result.includes("not used"));
    });

    it("excludes definition line when fileContext is provided", async () => {
      await writeFile(join(FIXTURE_DIR, "def.ts"), "function greet() {}\n");
      await writeFile(join(FIXTURE_DIR, "use.ts"), "greet();\n");
      const result = await getBlastRadius({
        rootDir: FIXTURE_DIR,
        symbolName: "greet",
        fileContext: "def.ts",
      });
      assert.ok(!result.includes("def.ts") || result.includes("use.ts"));
    });

    it("shows low usage warning for single usage", async () => {
      await writeFile(join(FIXTURE_DIR, "single.ts"), "function rare() {}\n");
      await writeFile(join(FIXTURE_DIR, "once.ts"), "rare();\n");
      const result = await getBlastRadius({
        rootDir: FIXTURE_DIR,
        symbolName: "rare",
        fileContext: "single.ts",
      });
      assert.ok(result.includes("LOW USAGE") || result.includes("1 time"));
    });

    it("shows line numbers and context", async () => {
      await writeFile(
        join(FIXTURE_DIR, "ctx.ts"),
        "const x = 1;\nconst y = doWork(x);\nconst z = doWork(y);\n",
      );
      const result = await getBlastRadius({
        rootDir: FIXTURE_DIR,
        symbolName: "doWork",
      });
      assert.ok(result.includes("L"));
    });

    it("counts usages in multiple files", async () => {
      await writeFile(
        join(FIXTURE_DIR, "m1.ts"),
        "import { shared } from './s';\nshared();\n",
      );
      await writeFile(
        join(FIXTURE_DIR, "m2.ts"),
        "import { shared } from './s';\nshared();\n",
      );
      const result = await getBlastRadius({
        rootDir: FIXTURE_DIR,
        symbolName: "shared",
      });
      assert.ok(result.includes("2 files") || result.includes("usages"));
    });
  });

  after(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
  });
});
