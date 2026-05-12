import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { walkDirectory, groupByDirectory } from "../../build/core/walker.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";

const FIXTURE_DIR = join(process.cwd(), "test", "_walk_fixtures");

describe("walker", () => {
  before(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
    await mkdir(join(FIXTURE_DIR, "src", "utils"), { recursive: true });
    await mkdir(join(FIXTURE_DIR, "docs"), { recursive: true });
    await writeFile(join(FIXTURE_DIR, "index.ts"), "export {}");
    await writeFile(join(FIXTURE_DIR, "src", "app.ts"), "const x = 1;");
    await writeFile(
      join(FIXTURE_DIR, "src", "utils", "helpers.ts"),
      "export function h() {}",
    );
    await writeFile(join(FIXTURE_DIR, "docs", "readme.txt"), "Hello");
  });

  describe("walkDirectory", () => {
    it("returns files and directories", async () => {
      const entries = await walkDirectory({ rootDir: FIXTURE_DIR });
      assert.ok(entries.length > 0);
      const files = entries.filter((e) => !e.isDirectory);
      const dirs = entries.filter((e) => e.isDirectory);
      assert.ok(files.length >= 3);
      assert.ok(dirs.length >= 2);
    });

    it("includes relative paths", async () => {
      const entries = await walkDirectory({ rootDir: FIXTURE_DIR });
      const paths = entries.map((e) => e.relativePath);
      assert.ok(paths.includes("index.ts"));
      assert.ok(paths.some((p) => p.includes("src")));
    });

    it("respects depth limit", async () => {
      const entries = await walkDirectory({
        rootDir: FIXTURE_DIR,
        depthLimit: 1,
      });
      const deepFiles = entries.filter((e) =>
        e.relativePath.includes("helpers.ts"),
      );
      assert.equal(
        deepFiles.length,
        0,
        "files inside utils/ should not appear at depthLimit 1",
      );
    });

    it("respects targetPath", async () => {
      const entries = await walkDirectory({
        rootDir: FIXTURE_DIR,
        targetPath: "src",
      });
      const nonSrcFiles = entries.filter((e) => e.relativePath === "index.ts");
      assert.equal(nonSrcFiles.length, 0);
      assert.ok(entries.some((e) => e.relativePath.includes("app.ts")));
    });

    it("ignores node_modules", async () => {
      await mkdir(join(FIXTURE_DIR, "node_modules", "pkg"), {
        recursive: true,
      });
      await writeFile(
        join(FIXTURE_DIR, "node_modules", "pkg", "index.js"),
        "module.exports = {}",
      );
      const entries = await walkDirectory({ rootDir: FIXTURE_DIR });
      const nmEntries = entries.filter((e) =>
        e.relativePath.includes("node_modules"),
      );
      assert.equal(nmEntries.length, 0);
      await rm(join(FIXTURE_DIR, "node_modules"), {
        recursive: true,
        force: true,
      });
    });

    it("ignores .git directory", async () => {
      const entries = await walkDirectory({ rootDir: FIXTURE_DIR });
      const gitEntries = entries.filter((e) => e.relativePath.includes(".git"));
      assert.equal(gitEntries.length, 0);
    });

    it("returns empty for non-existent targetPath", async () => {
      const entries = await walkDirectory({
        rootDir: FIXTURE_DIR,
        targetPath: "nonexistent",
      });
      assert.equal(entries.length, 0);
    });

    it("includes depth info", async () => {
      const entries = await walkDirectory({ rootDir: FIXTURE_DIR });
      const topLevel = entries.filter((e) => e.depth === 0);
      assert.ok(topLevel.length > 0);
    });

    it("respects .gitignore", async () => {
      await writeFile(join(FIXTURE_DIR, ".gitignore"), "docs/\n");
      const entries = await walkDirectory({ rootDir: FIXTURE_DIR });
      const docFiles = entries.filter((e) =>
        e.relativePath.includes("readme.txt"),
      );
      assert.equal(docFiles.length, 0, "files inside docs/ should be ignored");
      await rm(join(FIXTURE_DIR, ".gitignore"));
    });
  });

  describe("groupByDirectory", () => {
    it("groups files by their parent directory", async () => {
      const entries = await walkDirectory({ rootDir: FIXTURE_DIR });
      const groups = groupByDirectory(entries);
      assert.ok(groups instanceof Map);
      assert.ok(groups.size > 0);
    });

    it("puts root files under '.'", async () => {
      const entries = await walkDirectory({ rootDir: FIXTURE_DIR });
      const groups = groupByDirectory(entries);
      const rootGroup = groups.get(".");
      assert.ok(rootGroup);
      assert.ok(rootGroup.some((e) => e.relativePath === "index.ts"));
    });
  });

  describe("nested gitignore", () => {
    const NESTED = join(FIXTURE_DIR, "_nested");

    before(async () => {
      await rm(NESTED, { recursive: true, force: true });
      await mkdir(join(NESTED, "child", "cache"), { recursive: true });
      await writeFile(join(NESTED, "child", "cache", "x.txt"), "cached");
      await writeFile(join(NESTED, "child", "keep.txt"), "kept");
      await writeFile(join(NESTED, "child", ".gitignore"), "cache/\n");
    });

    after(async () => {
      await rm(NESTED, { recursive: true, force: true });
    });

    it("applies a child .gitignore rule inside that child", async () => {
      const entries = await walkDirectory({ rootDir: NESTED });
      const paths = entries.map((e) => e.relativePath);
      assert.ok(paths.includes("child/keep.txt"), "child/keep.txt should be included");
      assert.ok(
        !paths.some((p) => p.includes("cache/x.txt")),
        "files under child/cache should be ignored by child's .gitignore",
      );
    });

    it("supports negation in a child .gitignore (re-include)", async () => {
      // Parent ignores *.log everywhere; child re-includes important.log.
      await writeFile(join(NESTED, ".gitignore"), "*.log\n");
      await writeFile(join(NESTED, "root.log"), "noise");
      await writeFile(join(NESTED, "child", "important.log"), "valuable");
      await writeFile(join(NESTED, "child", "noise.log"), "noise");
      await writeFile(join(NESTED, "child", ".gitignore"), "cache/\n!important.log\n");

      const entries = await walkDirectory({ rootDir: NESTED });
      const paths = entries.map((e) => e.relativePath);

      assert.ok(
        !paths.includes("root.log"),
        "root.log should be excluded by parent rule",
      );
      assert.ok(
        !paths.includes("child/noise.log"),
        "child/noise.log should still be excluded (parent rule still applies)",
      );
      assert.ok(
        paths.includes("child/important.log"),
        "child/important.log should be re-included by child's negation",
      );
    });

    it("merges .gitignore across three levels of nesting", async () => {
      const DEEP = join(FIXTURE_DIR, "_deep");
      await rm(DEEP, { recursive: true, force: true });
      await mkdir(join(DEEP, "a", "b", "c"), { recursive: true });
      await writeFile(join(DEEP, ".gitignore"), "*.tmp\n");
      await writeFile(join(DEEP, "a", ".gitignore"), "*.bak\n");
      await writeFile(join(DEEP, "a", "b", ".gitignore"), "*.old\n");
      await writeFile(join(DEEP, "a", "b", "c", "keep.txt"), "k");
      await writeFile(join(DEEP, "a", "b", "c", "x.tmp"), "1");
      await writeFile(join(DEEP, "a", "b", "c", "x.bak"), "2");
      await writeFile(join(DEEP, "a", "b", "c", "x.old"), "3");

      const entries = await walkDirectory({ rootDir: DEEP });
      const paths = entries.map((e) => e.relativePath);

      assert.ok(paths.includes("a/b/c/keep.txt"));
      assert.ok(!paths.includes("a/b/c/x.tmp"), "level-0 *.tmp rule must reach level 3");
      assert.ok(!paths.includes("a/b/c/x.bak"), "level-1 *.bak rule must reach level 3");
      assert.ok(!paths.includes("a/b/c/x.old"), "level-2 *.old rule must reach level 3");

      await rm(DEEP, { recursive: true, force: true });
    });
  });

  describe("walkRoots", () => {
    const ROOTS = join(FIXTURE_DIR, "_roots");

    before(async () => {
      await rm(ROOTS, { recursive: true, force: true });
      await mkdir(join(ROOTS, "docs"), { recursive: true });
      await mkdir(join(ROOTS, "repos", "lacuna", "src"), { recursive: true });
      await mkdir(join(ROOTS, "repos", "other"), { recursive: true });
      await writeFile(join(ROOTS, ".gitignore"), "repos/\n");
      await writeFile(join(ROOTS, "docs", "readme.md"), "d");
      await writeFile(join(ROOTS, "repos", "lacuna", "src", "foo.py"), "f");
      await writeFile(join(ROOTS, "repos", "other", "noise.py"), "n");
    });

    after(async () => {
      await rm(ROOTS, { recursive: true, force: true });
    });

    it("indexes paths listed in extraRoots even when parent .gitignore excludes them", async () => {
      const { walkRoots } = await import("../../build/core/walker.js");
      const entries = await walkRoots({
        rootDir: ROOTS,
        extraRoots: ["repos/lacuna"],
      });
      const paths = entries.map((e) => e.relativePath);

      assert.ok(paths.includes("docs/readme.md"), "workspace files should still be indexed");
      assert.ok(
        paths.includes("repos/lacuna/src/foo.py"),
        "extraRoot file should be indexed",
      );
      assert.ok(
        !paths.some((p) => p.startsWith("repos/other")),
        "repos/other (not in extraRoots) should remain ignored",
      );
    });

    it("rejects extraRoots that resolve outside the workspace root", async () => {
      const { walkRoots } = await import("../../build/core/walker.js");
      await assert.rejects(
        () => walkRoots({ rootDir: ROOTS, extraRoots: ["../../etc"] }),
        /resolves outside workspace root/,
      );
      await assert.rejects(
        () => walkRoots({ rootDir: ROOTS, extraRoots: ["/etc"] }),
        /resolves outside workspace root/,
      );
    });

    it("reports workspace-relative depth for extraRoot entries", async () => {
      const { walkRoots } = await import("../../build/core/walker.js");
      const entries = await walkRoots({
        rootDir: ROOTS,
        extraRoots: ["repos/lacuna"],
      });
      const fooEntry = entries.find((e) => e.relativePath === "repos/lacuna/src/foo.py");
      assert.ok(fooEntry, "expected to find foo.py");
      // repos/lacuna/src/foo.py: workspace depth is 3 (under repos/lacuna/src/).
      // walkDirectory called with rootDir=<abs>/repos/lacuna gives foo.py depth=1
      // (src/ is depth 0 from lacuna, foo.py is depth 1). With offset 2 → 3.
      assert.equal(fooEntry.depth, 3, "depth should be workspace-relative, not extraRoot-relative");
    });
  });

  after(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
  });
});
