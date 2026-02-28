import Background from "../components/Background";
import IdeSetup from "../components/IdeSetup";
import InstructionsSection from "../components/InstructionsSection";
import IsometricDiagram from "../components/IsometricDiagram";

async function getStars(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/ForLoopCodes/contextplus",
      { next: { revalidate: 3600 } },
    );
    const data = await res.json();
    return data.stargazers_count ?? 0;
  } catch {
    return 0;
  }
}

export default async function Home() {
  const stars = await getStars();

  return (
    <div className="relative w-full min-h-screen">
      <Background />
      {/* Navbar */}
      <nav
        className="nav-bar flex justify-between items-center"
        style={{
          padding: "40px 100px 30px",
          zIndex: 10,
          position: "sticky",
          top: 0,
          background: "rgba(239,239,239,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span
          className="font-light text-black"
          style={{ fontSize: 22, lineHeight: "28px" }}
        >
          Context+
        </span>
        <a
          href="https://github.com/ForLoopCodes/contextplus"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center"
          style={{ gap: 8 }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1E1E1E"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
          <span
            className="font-light text-black"
            style={{ fontSize: 18, lineHeight: "24px" }}
          >
            {stars}
          </span>
        </a>
      </nav>

      {/* Hero + Isometric Diagram row */}
      <div
        className="hero-diagram-row"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 100px",
          gap: 60,
          zIndex: 1,
          position: "relative",
        }}
      >
        {/* Hero */}
        <section
          className="hero-section flex flex-col relative"
          style={{ gap: 24, flex: "1 1 auto", minWidth: 0, maxWidth: 630 }}
        >
          <h1
            className="hero-title font-light"
            style={{
              fontSize: 56,
              lineHeight: "72px",
              letterSpacing: "-0.02em",
              color: "rgba(0,0,0,0.5)",
              fontFamily: "var(--font-geist-sans)",
            }}
          >
            Semantic Intelligence for
            <br />
            <span className="text-black">Large-Scale Engineering.</span>
          </h1>
          <p
            className="hero-text font-light"
            style={{
              fontSize: 18,
              lineHeight: "28px",
              letterSpacing: "-0.02em",
              background: "linear-gradient(180deg, #000000 0%, #666666 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Context+ is an MCP server designed for developers who demand 99%
            accuracy. By combining Tree-sitter AST parsing, Spectral Clustering,
            and Obsidian-style linking, Context+ turns a massive codebase into a
            searchable, hierarchical feature graph.
          </p>
        </section>
      </div>

      <IsometricDiagram />

      {/* Diagram */}
      <div
        className="diagram-outer"
        style={{
          position: "relative",
          zIndex: 1,
          width: "fit-content",
          margin: "0 auto",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Dashed line with centered title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 8,
              minWidth: 40,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="sep-left"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke="#333333"
                    strokeWidth="1.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#sep-left)" />
            </svg>
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#000000",
              fontFamily: "var(--font-geist-pixel-square)",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
            }}
          >
            Context+ MCP
          </span>
          <div
            style={{
              flex: 1,
              height: 8,
              minWidth: 40,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="sep-right"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke="#888888"
                    strokeWidth="1.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#sep-right)" />
            </svg>
          </div>
        </div>
        <div
          className="diagram-groups"
          style={{ display: "flex", gap: 16, alignItems: "flex-start" }}
        >
          {/* Discovery group — 2x2 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#000000",
                fontFamily: "var(--font-geist-pixel-square)",
                letterSpacing: "-0.02em",
              }}
            >
              Discovery
            </span>
            <div
              className="discovery-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                border: "1.5px solid rgba(0,0,0,0.15)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                background: "rgba(239,239,239,0.45)",
                borderRadius: 20,
                padding: 20,
              }}
            >
              {[
                { color: "#000000", label: "Context Tree" },
                { color: "#111111", label: "File Skeleton" },
                { color: "#222222", label: "Semantic Search" },
                { color: "#333333", label: "Semantic Navigate" },
              ].map(({ color, label }) => (
                <div
                  key={label}
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color,
                      fontFamily: "var(--font-geist-pixel-square)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {label}
                  </span>
                  <div
                    className="tool-square"
                    style={{
                      boxSizing: "border-box",
                      width: 126,
                      height: 126,
                      border: `1.5px solid ${color}`,
                      borderRadius: 14,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <svg
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                      }}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <pattern
                          id={`diag-${label.replace(/\s/g, "")}`}
                          width="6"
                          height="6"
                          patternUnits="userSpaceOnUse"
                          patternTransform="rotate(45)"
                        >
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="6"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                        </pattern>
                      </defs>
                      <rect
                        width="100%"
                        height="100%"
                        fill={`url(#diag-${label.replace(/\s/g, "")})`}
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Analysis group */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#444444",
                fontFamily: "var(--font-geist-pixel-square)",
                letterSpacing: "-0.02em",
              }}
            >
              Analysis
            </span>
            <div
              className="group-inner-col"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                border: "1.5px solid rgba(0,0,0,0.15)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                background: "rgba(239,239,239,0.45)",
                borderRadius: 20,
                padding: 20,
              }}
            >
              {[
                { color: "#444444", label: "Blast Radius" },
                { color: "#555555", label: "Static Analysis" },
              ].map(({ color, label }) => (
                <div
                  key={label}
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color,
                      fontFamily: "var(--font-geist-pixel-square)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {label}
                  </span>
                  <div
                    className="tool-square"
                    style={{
                      boxSizing: "border-box",
                      width: 126,
                      height: 126,
                      border: `1.5px solid ${color}`,
                      borderRadius: 14,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <svg
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                      }}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <pattern
                          id={`diag-${label.replace(/\s/g, "")}`}
                          width="6"
                          height="6"
                          patternUnits="userSpaceOnUse"
                          patternTransform="rotate(45)"
                        >
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="6"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                        </pattern>
                      </defs>
                      <rect
                        width="100%"
                        height="100%"
                        fill={`url(#diag-${label.replace(/\s/g, "")})`}
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Code Ops group */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#666666",
                fontFamily: "var(--font-geist-pixel-square)",
                letterSpacing: "-0.02em",
              }}
            >
              Code Ops
            </span>
            <div
              className="group-inner-col"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                border: "1.5px solid rgba(0,0,0,0.15)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                background: "rgba(239,239,239,0.45)",
                borderRadius: 20,
                padding: 20,
              }}
            >
              {[
                { color: "#666666", label: "Propose Commit" },
                { color: "#777777", label: "Feature Hub" },
              ].map(({ color, label }) => (
                <div
                  key={label}
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color,
                      fontFamily: "var(--font-geist-pixel-square)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {label}
                  </span>
                  <div
                    className="tool-square"
                    style={{
                      boxSizing: "border-box",
                      width: 126,
                      height: 126,
                      border: `1.5px solid ${color}`,
                      borderRadius: 14,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <svg
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                      }}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <pattern
                          id={`diag-${label.replace(/\s/g, "")}`}
                          width="6"
                          height="6"
                          patternUnits="userSpaceOnUse"
                          patternTransform="rotate(45)"
                        >
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="6"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                        </pattern>
                      </defs>
                      <rect
                        width="100%"
                        height="100%"
                        fill={`url(#diag-${label.replace(/\s/g, "")})`}
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Version Control group */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#888888",
                fontFamily: "var(--font-geist-pixel-square)",
                letterSpacing: "-0.02em",
              }}
            >
              Version Control
            </span>
            <div
              className="group-inner-col"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                border: "1.5px solid rgba(0,0,0,0.15)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                background: "rgba(239,239,239,0.45)",
                borderRadius: 20,
                padding: 20,
              }}
            >
              {[
                { color: "#888888", label: "Restore Points" },
                { color: "#999999", label: "Undo Change" },
              ].map(({ color, label }) => (
                <div
                  key={label}
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color,
                      fontFamily: "var(--font-geist-pixel-square)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {label}
                  </span>
                  <div
                    className="tool-square"
                    style={{
                      boxSizing: "border-box",
                      width: 126,
                      height: 126,
                      border: `1.5px solid ${color}`,
                      borderRadius: 14,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <svg
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                      }}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <pattern
                          id={`diag-${label.replace(/\s/g, "")}`}
                          width="6"
                          height="6"
                          patternUnits="userSpaceOnUse"
                          patternTransform="rotate(45)"
                        >
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="6"
                            stroke={color}
                            strokeWidth="1.5"
                          />
                        </pattern>
                      </defs>
                      <rect
                        width="100%"
                        height="100%"
                        fill={`url(#diag-${label.replace(/\s/g, "")})`}
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <IdeSetup />

      <InstructionsSection />

      {/* Tools Reference */}
      <section
        className="tools-ref"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "40px 100px 80px",
          width: "100%",
          maxWidth: 1200,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <p
          style={{
            fontSize: 18,
            fontWeight: 300,
            lineHeight: "28px",
            fontFamily: "var(--font-geist-pixel-square)",
            letterSpacing: "-0.02em",
            background: "linear-gradient(180deg, #000000 0%, #666666 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text" as const,
            maxWidth: 630,
            marginLeft: "auto",
            marginRight: "auto",
            textAlign: "center" as const,
            marginBottom: 40,
          }}
        >
          Context+ guarantees minimal context bloat. It gives your agent deep
          semantic understanding of your codebase, from AST parsing and symbol
          navigation to blast radius analysis and commit validation. Nothing
          misses the context.
        </p>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            borderSpacing: 0,
          }}
        >
          <tbody>
            {[
              {
                name: "get_context_tree",
                desc: "Get the structural AST tree of a project with file headers, function names, classes, and enums. Dynamic token-aware pruning shrinks output automatically.",
                input:
                  "{\n  target_path?: string,\n  depth_limit?: number,\n  include_symbols?: boolean,\n  max_tokens?: number\n}",
                output:
                  '// Structural tree as formatted text\n"src/\n  index.ts — Entry point\n    getStars()\n    Home()\n  utils/\n    parser.ts — AST parsing\n      parseFile()\n      walkTree()"',
              },
              {
                name: "get_file_skeleton",
                desc: "Get function signatures, class methods, and type definitions of a file without reading the full body. Shows the API surface.",
                input: "{ file_path: string }",
                output:
                  '// Function signatures only\n"export function parseFile(\n  filePath: string,\n  options?: ParseOptions\n): Promise<AST>"\n\n"export class Walker {\n  walk(node: Node): void\n  getSymbols(): Symbol[]\n}"',
              },
              {
                name: "semantic_code_search",
                desc: "Search the codebase by meaning, not exact text. Uses Ollama embeddings over file headers and symbol names.",
                input: "{ query: string, top_k?: number }",
                output:
                  '// Ranked semantic matches\n"1. src/auth/jwt.ts (0.94)\n   — JWT token validation\n2. src/auth/session.ts (0.87)\n   — Session management\n3. src/middleware/guard.ts (0.82)\n   — Route protection"',
              },
              {
                name: "get_blast_radius",
                desc: "Before modifying code, trace every file and line where a symbol is imported or used. Prevents orphaned references.",
                input: "{\n  symbol_name: string,\n  file_context?: string\n}",
                output:
                  '// Usage map across codebase\n"parseFile — 7 usages\n  src/index.ts:14  import { parseFile }\n  src/tools/tree.ts:8  const ast = parseFile(p)\n  src/tools/skeleton.ts:22  parseFile(path)\n  test/parser.test.ts:5  import { parseFile }"',
              },
              {
                name: "run_static_analysis",
                desc: "Run the native linter or compiler to find unused variables, dead code, and type errors. Supports TypeScript, Python, Rust, Go.",
                input: "{ target_path?: string }",
                output:
                  '// Linter/compiler output\n"src/utils.ts:14:5\n  error TS2345: Argument of type string\n  is not assignable to parameter\n\nsrc/old.ts:1:1\n  warning: file has no exports"',
              },
              {
                name: "propose_commit",
                desc: "The only way to write code. Validates against strict rules before saving. Creates a shadow restore point before writing.",
                input: "{\n  file_path: string,\n  new_content: string\n}",
                output:
                  '// Validation result\n"✓ Header comment present\n✓ No inline comments\n✓ Max nesting depth: 3\n✓ File length: 142 lines\n\nSaved src/tools/search.ts\nRestore point: rp-1719384000-a3f2"',
              },
              {
                name: "list_restore_points",
                desc: "List all shadow restore points created by propose_commit. Each captures file state before AI changes.",
                input: "{ }",
                output:
                  '// Restore point history\n"rp-1719384000-a3f2 | 2025-06-26\n  src/tools/search.ts | refactor search\n\nrp-1719383000-b7c1 | 2025-06-26\n  src/index.ts | add new tool"',
              },
              {
                name: "undo_change",
                desc: "Restore files to their state before a specific AI change. Uses shadow restore points. Does not affect git.",
                input: "{ point_id: string }",
                output:
                  '// Restoration result\n"Restored 1 file(s):\n  src/tools/search.ts"',
              },
              {
                name: "semantic_navigate",
                desc: "Browse codebase by meaning using spectral clustering. Groups semantically related files into labeled clusters.",
                input: "{\n  max_depth?: number,\n  max_clusters?: number\n}",
                output:
                  '// Semantic cluster tree\n"Authentication (4 files)\n  src/auth/jwt.ts\n  src/auth/session.ts\n  src/middleware/guard.ts\n  src/models/user.ts\n\nParsing (3 files)\n  src/core/parser.ts\n  src/core/tree-sitter.ts\n  src/core/walker.ts"',
              },
              {
                name: "get_feature_hub",
                desc: "Obsidian-style feature hub navigator. Hubs are .md files with [[wikilinks]] that map features to code files.",
                input:
                  "{\n  hub_path?: string,\n  feature_name?: string,\n  show_orphans?: boolean\n}",
                output:
                  '// Hub with linked file skeletons\n"## auth.md\n[[src/auth/jwt.ts]]\n  → verifyToken(token: string)\n  → signToken(payload: object)\n\n[[src/auth/session.ts]]\n  → createSession(userId: string)\n  → destroySession(id: string)"',
              },
            ].map(({ name, desc, input, output }) => (
              <tr key={name} style={{ verticalAlign: "top" }}>
                <td
                  style={{
                    padding: "24px 32px 24px 0",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <code
                    style={{
                      fontFamily: "var(--font-geist-pixel-square)",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "#000",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {name}
                  </code>
                </td>
                <td
                  style={{
                    padding: "24px 0",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 300,
                      lineHeight: "22px",
                      color: "#333",
                      marginBottom: 16,
                      fontFamily: "var(--font-geist-sans)",
                    }}
                  >
                    {desc}
                  </p>
                  <div
                    className="code-pair"
                    style={{ display: "flex", gap: 12, width: "100%" }}
                  >
                    <pre
                      style={{
                        flex: 1,
                        fontFamily: "var(--font-geist-mono)",
                        fontSize: 12,
                        fontWeight: 300,
                        lineHeight: "18px",
                        color: "#444",
                        background: "rgba(0,0,0,0.04)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        borderRadius: 8,
                        padding: "12px 16px",
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        margin: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: "#888",
                          display: "block",
                          marginBottom: 6,
                          fontFamily: "var(--font-geist-mono)",
                        }}
                      >
                        INPUT
                      </span>
                      {input}
                    </pre>
                    <pre
                      style={{
                        flex: 2,
                        fontFamily: "var(--font-geist-mono)",
                        fontSize: 12,
                        fontWeight: 300,
                        lineHeight: "18px",
                        color: "#444",
                        background: "rgba(0,0,0,0.04)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        borderRadius: 8,
                        padding: "12px 16px",
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        margin: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: "#888",
                          display: "block",
                          marginBottom: 6,
                          fontFamily: "var(--font-geist-mono)",
                        }}
                      >
                        OUTPUT
                      </span>
                      {output}
                    </pre>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Quote Section */}
      <section
        className="quote-section"
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 100px",
          textShadow: "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-geist-sans)",
            fontSize: 48,
            fontWeight: 300,
            lineHeight: "68px",
            letterSpacing: "-0.05em",
            textAlign: "center",
            maxWidth: 900,
            background: "linear-gradient(180deg, #000000 0%, #666666 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text" as const,
          }}
        >
          &ldquo;Context engineering is the delicate art and science of filling
          the context window with just the right information for the next
          step.&rdquo;
        </p>
        <a
          href="https://x.com/karpathy/status/1937902205765607626"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 24,
            fontSize: 16,
            fontWeight: 300,
            color: "#666",
            textDecoration: "none",
            fontFamily: "var(--font-geist-pixel-square)",
            letterSpacing: "-0.02em",
          }}
        >
          - Andrej Karpathy
        </a>
      </section>

      {/* Footer */}
      <footer
        className="site-footer"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "80px 100px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1.5px solid rgba(0,0,0,0.08)",
          background: "rgba(239,239,239,0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span
          className="font-light text-black"
          style={{ fontSize: 22, lineHeight: "28px" }}
        >
          Context+
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a
            href="https://www.npmjs.com/package/contextplus"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <svg width="20" height="20" viewBox="0 0 256 256" fill="#1E1E1E">
              <path d="M0 256V0h256v256H0zm41-41h57.5V71.2H141V215h34V41H41v174z" />
            </svg>
          </a>
          <a
            href="https://github.com/ForLoopCodes/contextplus"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
            style={{ gap: 8 }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1E1E1E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
            <span
              className="font-light text-black"
              style={{ fontSize: 18, lineHeight: "24px" }}
            >
              {stars}
            </span>
          </a>
        </div>
      </footer>
    </div>
  );
}
