import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseWithTreeSitter,
  getSupportedExtensions,
  getGrammarName,
} from "../../build/core/tree-sitter.js";

describe("tree-sitter", () => {
  describe("getGrammarName", () => {
    it("returns typescript for .ts", () => {
      assert.equal(getGrammarName(".ts"), "typescript");
    });

    it("returns tsx for .tsx", () => {
      assert.equal(getGrammarName(".tsx"), "tsx");
    });

    it("returns python for .py", () => {
      assert.equal(getGrammarName(".py"), "python");
    });

    it("returns rust for .rs", () => {
      assert.equal(getGrammarName(".rs"), "rust");
    });

    it("returns go for .go", () => {
      assert.equal(getGrammarName(".go"), "go");
    });

    it("returns null for unsupported extensions", () => {
      assert.equal(getGrammarName(".xyz"), null);
    });

    it("is case insensitive", () => {
      assert.equal(getGrammarName(".TS"), "typescript");
    });

    it("maps .sh to bash", () => {
      assert.equal(getGrammarName(".sh"), "bash");
    });

    it("maps .cs to c_sharp", () => {
      assert.equal(getGrammarName(".cs"), "c_sharp");
    });
  });

  describe("getSupportedExtensions", () => {
    it("returns an array", () => {
      const exts = getSupportedExtensions();
      assert.ok(Array.isArray(exts));
    });

    it("includes common extensions", () => {
      const exts = getSupportedExtensions();
      assert.ok(exts.includes(".ts"));
      assert.ok(exts.includes(".py"));
      assert.ok(exts.includes(".rs"));
      assert.ok(exts.includes(".go"));
      assert.ok(exts.includes(".java"));
    });

    it("has 40+ extensions", () => {
      const exts = getSupportedExtensions();
      assert.ok(exts.length >= 40);
    });
  });

  describe("parseWithTreeSitter - TypeScript", () => {
    it("extracts function declarations", async () => {
      const syms = await parseWithTreeSitter(
        "function hello(x: number) { return x; }",
        ".ts",
      );
      assert.ok(syms);
      assert.equal(syms.length, 1);
      assert.equal(syms[0].name, "hello");
      assert.equal(syms[0].kind, "function");
    });

    it("extracts classes with methods", async () => {
      const syms = await parseWithTreeSitter(
        "class Foo {\n  bar() { return 1; }\n  baz() {}\n}",
        ".ts",
      );
      assert.ok(syms);
      const cls = syms.find((s) => s.name === "Foo");
      assert.ok(cls);
      assert.equal(cls.kind, "class");
      assert.ok(cls.children.length >= 2);
    });

    it("extracts enums", async () => {
      const syms = await parseWithTreeSitter(
        "enum Color { Red, Green, Blue }",
        ".ts",
      );
      assert.ok(syms);
      const en = syms.find((s) => s.name === "Color");
      assert.ok(en);
      assert.equal(en.kind, "enum");
    });

    it("extracts interfaces", async () => {
      const syms = await parseWithTreeSitter(
        "interface Widget { id: string; }",
        ".ts",
      );
      assert.ok(syms);
      assert.equal(syms[0].name, "Widget");
      assert.equal(syms[0].kind, "interface");
    });

    it("includes line numbers", async () => {
      const syms = await parseWithTreeSitter(
        "function a() {}\nfunction b() {}",
        ".ts",
      );
      assert.ok(syms);
      assert.equal(syms[0].line, 1);
      assert.equal(syms[1].line, 2);
    });

    it("includes signatures", async () => {
      const syms = await parseWithTreeSitter(
        "function greet(name: string): string { return name; }",
        ".ts",
      );
      assert.ok(syms);
      assert.ok(syms[0].signature.includes("greet"));
    });
  });

  describe("parseWithTreeSitter - Python", () => {
    it("extracts functions and classes", async () => {
      const syms = await parseWithTreeSitter(
        "def greet(name):\n    return name\n\nclass Dog:\n    def bark(self):\n        pass",
        ".py",
      );
      assert.ok(syms);
      assert.ok(syms.find((s) => s.name === "greet"));
      assert.ok(syms.find((s) => s.name === "Dog"));
    });
  });

  describe("parseWithTreeSitter - Rust", () => {
    it("extracts fn, struct, enum, trait", async () => {
      const code =
        "pub fn add(a: i32) -> i32 { a }\nstruct Point { x: f64 }\nenum Shape { Circle }\ntrait Draw { fn draw(&self); }";
      const syms = await parseWithTreeSitter(code, ".rs");
      assert.ok(syms);
      assert.ok(syms.find((s) => s.name === "add"));
      assert.ok(syms.find((s) => s.name === "Point"));
      assert.ok(syms.find((s) => s.name === "Shape"));
      assert.ok(syms.find((s) => s.name === "Draw"));
    });
  });

  describe("parseWithTreeSitter - Go", () => {
    it("extracts functions and types", async () => {
      const code =
        'func hello() string { return "" }\ntype Point struct { X int }';
      const syms = await parseWithTreeSitter(code, ".go");
      assert.ok(syms);
      assert.ok(syms.find((s) => s.name === "hello"));
      assert.ok(syms.find((s) => s.name === "Point"));
    });
  });

  describe("parseWithTreeSitter - unsupported", () => {
    it("returns null for unknown extensions", async () => {
      const syms = await parseWithTreeSitter("some content", ".xyz");
      assert.equal(syms, null);
    });
  });

  describe("parseWithTreeSitter - empty input", () => {
    it("returns empty array for empty string", async () => {
      const syms = await parseWithTreeSitter("", ".ts");
      assert.ok(syms);
      assert.equal(syms.length, 0);
    });
  });
});
