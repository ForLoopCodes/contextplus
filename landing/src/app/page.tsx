import Background from "../components/Background";

async function getStars(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/ForLoopCodes/contextual",
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
        className="flex justify-between items-center relative"
        style={{ padding: "40px 100px 30px", zIndex: 1 }}
      >
        <span
          className="font-light text-black"
          style={{ fontSize: 22, lineHeight: "28px" }}
        >
          Contextual
        </span>
        <a
          href="https://github.com/ForLoopCodes/contextual"
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

      {/* Hero */}
      <section
        className="flex flex-col relative"
        style={{ padding: "64px 100px", gap: 34, maxWidth: 830, zIndex: 1 }}
      >
        <h1
          className="font-light"
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
          className="font-light"
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
          Contextual is an MCP server designed for developers who demand 99%
          accuracy. By combining Tree-sitter AST parsing, Spectral Clustering,
          and Obsidian-style linking, Contextual turns a massive codebase into a
          searchable, hierarchical feature graph.
        </p>
      </section>

      {/* Diagram */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "fit-content",
          marginLeft: 100,
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
            Contextual MCP
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
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
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
    </div>
  );
}
