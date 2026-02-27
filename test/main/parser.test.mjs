import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeFile,
  formatSymbol,
  isSupportedFile,
  SymbolKind,
} from "../../build/core/parser.js";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";

const FIXTURE_DIR = join(process.cwd(), "test", "_fixtures");

describe("parser", () => {
  before(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
    await mkdir(FIXTURE_DIR, { recursive: true });
  });

  describe("isSupportedFile", () => {
    it("returns true for TypeScript files", () => {
      assert.equal(isSupportedFile("src/index.ts"), true);
    });

    it("returns true for Python files", () => {
      assert.equal(isSupportedFile("main.py"), true);
    });

    it("returns true for Rust files", () => {
      assert.equal(isSupportedFile("lib.rs"), true);
    });

    it("returns true for Go files", () => {
      assert.equal(isSupportedFile("main.go"), true);
    });

    it("returns true for Java files", () => {
      assert.equal(isSupportedFile("Main.java"), true);
    });

    it("returns true for C# files", () => {
      assert.equal(isSupportedFile("Program.cs"), true);
    });

    it("returns true for tree-sitter extensions like .swift", () => {
      assert.equal(isSupportedFile("app.swift"), true);
    });

    it("returns false for unsupported extensions", () => {
      assert.equal(isSupportedFile("readme.md"), false);
    });

    it("returns false for image files", () => {
      assert.equal(isSupportedFile("photo.png"), false);
    });
  });

  describe("analyzeFile - TypeScript", () => {
    const tsFile = join(FIXTURE_DIR, "sample.ts");

    it("extracts functions", async () => {
      await writeFile(
        tsFile,
        "// Header line 1\n// Header line 2\n\nfunction greet(name: string): string {\n  return name;\n}\n",
      );
      const result = await analyzeFile(tsFile);
      assert.equal(result.symbols.length >= 1, true);
      const fn = result.symbols.find((s) => s.name === "greet");
      assert.ok(fn);
      assert.equal(fn.kind, SymbolKind.Function);
    });

    it("extracts classes with methods", async () => {
      await writeFile(
        tsFile,
        "// Header\n// Desc\n\nclass Dog {\n  bark(): string {\n    return 'woof';\n  }\n}\n",
      );
      const result = await analyzeFile(tsFile);
      const cls = result.symbols.find((s) => s.name === "Dog");
      assert.ok(cls);
      assert.equal(cls.kind, SymbolKind.Class);
      assert.equal(cls.children.length >= 1, true);
      assert.equal(cls.children[0].name, "bark");
    });

    it("extracts enums", async () => {
      await writeFile(
        tsFile,
        "// H1\n// H2\n\nenum Color { Red, Green, Blue }\n",
      );
      const result = await analyzeFile(tsFile);
      const en = result.symbols.find((s) => s.name === "Color");
      assert.ok(en);
      assert.equal(en.kind, SymbolKind.Enum);
    });

    it("extracts interfaces", async () => {
      await writeFile(
        tsFile,
        "// H1\n// H2\n\ninterface Widget { id: string; }\n",
      );
      const result = await analyzeFile(tsFile);
      const iface = result.symbols.find((s) => s.name === "Widget");
      assert.ok(iface);
      assert.equal(iface.kind, SymbolKind.Interface);
    });

    it("extracts file header", async () => {
      await writeFile(
        tsFile,
        "// First header line\n// Second header line\n\nfunction x() {}\n",
      );
      const result = await analyzeFile(tsFile);
      assert.ok(result.header.includes("First header line"));
    });

    it("reports correct line count", async () => {
      await writeFile(tsFile, "// H1\n// H2\nline3\nline4\nline5\n");
      const result = await analyzeFile(tsFile);
      assert.equal(result.lineCount, 6);
    });
  });

  describe("analyzeFile - Python", () => {
    const pyFile = join(FIXTURE_DIR, "sample.py");

    it("extracts Python functions", async () => {
      await writeFile(
        pyFile,
        "# Header 1\n# Header 2\n\ndef greet(name):\n    return name\n",
      );
      const result = await analyzeFile(pyFile);
      const fn = result.symbols.find((s) => s.name === "greet");
      assert.ok(fn);
      assert.equal(fn.kind, SymbolKind.Function);
    });

    it("extracts Python classes with methods", async () => {
      await writeFile(
        pyFile,
        "# H1\n# H2\n\nclass Dog:\n    def bark(self):\n        pass\n    def fetch(self):\n        pass\n",
      );
      const result = await analyzeFile(pyFile);
      const cls = result.symbols.find((s) => s.name === "Dog");
      assert.ok(cls);
      assert.equal(cls.kind, SymbolKind.Class);
      assert.equal(cls.children.length >= 2, true);
    });
  });

  describe("analyzeFile - Rust", () => {
    const rsFile = join(FIXTURE_DIR, "sample.rs");

    it("extracts Rust functions, structs, enums, traits", async () => {
      await writeFile(
        rsFile,
        "// H1\n// H2\n\npub fn add(a: i32, b: i32) -> i32 { a + b }\nstruct Point { x: f64 }\nenum Shape { Circle }\ntrait Draw { fn draw(&self); }\n",
      );
      const result = await analyzeFile(rsFile);
      assert.ok(result.symbols.find((s) => s.name === "add"));
      assert.ok(result.symbols.find((s) => s.name === "Point"));
      assert.ok(result.symbols.find((s) => s.name === "Shape"));
      assert.ok(result.symbols.find((s) => s.name === "Draw"));
    });
  });

  describe("analyzeFile - Go", () => {
    const goFile = join(FIXTURE_DIR, "sample.go");

    it("extracts Go functions and types", async () => {
      await writeFile(
        goFile,
        '// H1\n// H2\n\nfunc hello() string { return "" }\ntype Point struct { X int }\n',
      );
      const result = await analyzeFile(goFile);
      assert.ok(result.symbols.find((s) => s.name === "hello"));
      assert.ok(result.symbols.find((s) => s.name === "Point"));
    });
  });

  describe("formatSymbol", () => {
    it("formats a function symbol with signature", () => {
      const sym = {
        name: "greet",
        kind: SymbolKind.Function,
        line: 5,
        signature: "function greet(name: string)",
        children: [],
      };
      const result = formatSymbol(sym);
      assert.ok(result.includes("function greet(name: string)"));
      assert.ok(result.includes("L5"));
    });

    it("formats a class with children", () => {
      const sym = {
        name: "Dog",
        kind: SymbolKind.Class,
        line: 10,
        signature: "class Dog",
        children: [
          {
            name: "bark",
            kind: SymbolKind.Method,
            line: 12,
            signature: "bark()",
            children: [],
          },
        ],
      };
      const result = formatSymbol(sym);
      assert.ok(result.includes("Dog"));
      assert.ok(result.includes("bark"));
    });

    it("uses method label for methods", () => {
      const sym = {
        name: "run",
        kind: SymbolKind.Method,
        line: 1,
        signature: "run()",
        children: [],
      };
      const result = formatSymbol(sym);
      assert.ok(result.includes("method"));
    });

    it("supports indentation levels", () => {
      const sym = {
        name: "x",
        kind: SymbolKind.Const,
        line: 1,
        signature: "const x = 1",
        children: [],
      };
      const result = formatSymbol(sym, 2);
      assert.ok(result.startsWith("    "));
    });
  });

  after(async () => {
    await rm(FIXTURE_DIR, { recursive: true, force: true });
  });
});
