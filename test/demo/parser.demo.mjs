import { describe, it, before, after } from "node:test";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const { analyzeFile, isSupportedFile, formatSymbol } =
  await import("../../build/core/parser.js");

const FIXTURE = resolve("test/_demo_parser_fixtures");

before(async () => {
  await mkdir(FIXTURE, { recursive: true });
  await writeFile(
    join(FIXTURE, "example.ts"),
    [
      "// Example TypeScript module showing various symbol types extracted",
      "// FEATURE: Parser Demo",
      "",
      "export enum Color { Red, Green, Blue }",
      "",
      "export interface Shape {",
      "  area(): number;",
      "  perimeter(): number;",
      "}",
      "",
      "export class Circle implements Shape {",
      "  constructor(public radius: number) {}",
      "  area(): number { return Math.PI * this.radius ** 2; }",
      "  perimeter(): number { return 2 * Math.PI * this.radius; }",
      "}",
      "",
      "export function createCircle(r: number): Circle {",
      "  return new Circle(r);",
      "}",
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "example.py"),
    [
      "# Python module with functions and classes for demo",
      "# FEATURE: Parser Demo",
      "",
      "class Animal:",
      "    def __init__(self, name: str):",
      "        self.name = name",
      "",
      "    def speak(self) -> str:",
      '        return f"{self.name} says hello"',
      "",
      "def create_animal(name: str) -> Animal:",
      "    return Animal(name)",
    ].join("\n"),
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("DEMO: parser", () => {
  it("INPUT: isSupportedFile for various extensions", () => {
    const files = [
      "app.ts",
      "main.py",
      "lib.rs",
      "mod.go",
      "photo.png",
      "data.json",
    ];
    console.log("\n--- INPUT ---");
    console.log(files);

    const output = files.map((f) => ({
      file: f,
      supported: isSupportedFile(join(FIXTURE, f)),
    }));

    console.log("\n--- OUTPUT ---");
    console.log(JSON.stringify(output, null, 2));
    console.log("--- END ---\n");
  });

  it("INPUT: analyzeFile on TypeScript", async () => {
    const input = join(FIXTURE, "example.ts");
    console.log("\n--- INPUT ---");
    console.log(input);

    const analysis = await analyzeFile(input);

    console.log("\n--- OUTPUT ---");
    console.log(
      JSON.stringify(
        {
          lineCount: analysis.lineCount,
          header: analysis.header,
          symbolCount: analysis.symbols.length,
          symbols: analysis.symbols.map((s) => ({
            kind: s.kind,
            name: s.name,
            signature: s.signature,
            children: s.children.map((c) => c.signature),
          })),
        },
        null,
        2,
      ),
    );
    console.log("--- END ---\n");
  });

  it("INPUT: analyzeFile on Python", async () => {
    const input = join(FIXTURE, "example.py");
    console.log("\n--- INPUT ---");
    console.log(input);

    const analysis = await analyzeFile(input);

    console.log("\n--- OUTPUT ---");
    console.log(
      JSON.stringify(
        {
          lineCount: analysis.lineCount,
          header: analysis.header,
          symbolCount: analysis.symbols.length,
          symbols: analysis.symbols.map((s) => ({
            kind: s.kind,
            name: s.name,
            signature: s.signature,
            children: s.children.map((c) => c.signature),
          })),
        },
        null,
        2,
      ),
    );
    console.log("--- END ---\n");
  });

  it("INPUT: formatSymbol rendering", async () => {
    const analysis = await analyzeFile(join(FIXTURE, "example.ts"));
    console.log("\n--- INPUT (first 2 symbols) ---");
    console.log(analysis.symbols.slice(0, 2).map((s) => s.name));

    const output = analysis.symbols
      .slice(0, 2)
      .map((s) => formatSymbol(s, 0))
      .join("\n");

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });
});
