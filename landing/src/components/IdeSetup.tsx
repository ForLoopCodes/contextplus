"use client";

import { useState, type ReactNode } from "react";

const ides = [
  { id: "claude", label: "Claude Code", file: ".mcp.json" },
  { id: "cursor", label: "Cursor", file: ".cursor/mcp.json" },
  { id: "vscode", label: "VS Code", file: ".vscode/mcp.json" },
  { id: "windsurf", label: "Windsurf", file: ".windsurf/mcp.json" },
];

const runners = [
  { id: "npx", label: "npx" },
  { id: "bunx", label: "bunx" },
];

function buildConfig(runner: string, ideId: string): string {
  const isNpx = runner === "npx";

  if (ideId === "vscode") {
    return JSON.stringify(
      {
        servers: {
          contextplus: {
            type: "stdio",
            command: isNpx ? "npx" : "bunx",
            args: isNpx ? ["-y", "contextplus"] : ["contextplus"],
            env: {
              OLLAMA_EMBED_MODEL: "nomic-embed-text",
              OLLAMA_CHAT_MODEL: "gemma2:27b",
              OLLAMA_API_KEY: "YOUR_OLLAMA_API_KEY",
            },
          },
        },
        inputs: [],
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      mcpServers: {
        contextplus: {
          command: isNpx ? "npx" : "bunx",
          args: isNpx ? ["-y", "contextplus"] : ["contextplus"],
          env: {
            OLLAMA_EMBED_MODEL: "nomic-embed-text",
            OLLAMA_CHAT_MODEL: "gemma2:27b",
            OLLAMA_API_KEY: "YOUR_OLLAMA_API_KEY",
          },
        },
      },
    },
    null,
    2,
  );
}

function buildInitCommand(runner: string, agent: string): string {
  return runner === "npx"
    ? `npx -y contextplus init ${agent}`
    : `bunx contextplus init ${agent}`;
}

function highlightJson(json: string): ReactNode[] {
  const tokenRegex =
    /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?)|([{}[\]:,])/g;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      parts.push(json.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(
        <span key={match.index} style={{ color: "#111" }}>
          {match[1]}
        </span>,
      );
      parts.push(
        json.slice(
          match.index + match[1].length,
          match.index + match[0].length,
        ),
      );
    } else if (match[2]) {
      parts.push(
        <span key={match.index} style={{ color: "#555" }}>
          {match[2]}
        </span>,
      );
    } else if (match[3]) {
      parts.push(
        <span key={match.index} style={{ color: "#333" }}>
          {match[3]}
        </span>,
      );
    } else if (match[4]) {
      parts.push(
        <span key={match.index} style={{ color: "#333" }}>
          {match[4]}
        </span>,
      );
    } else if (match[5]) {
      parts.push(
        <span key={match.index} style={{ color: "#999" }}>
          {match[5]}
        </span>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < json.length) {
    parts.push(json.slice(lastIndex));
  }

  return parts;
}

export default function IdeSetup() {
  const [activeIde, setActiveIde] = useState("claude");
  const [activeRunner, setActiveRunner] = useState("bunx");
  const [copied, setCopied] = useState(false);
  const [copiedInit, setCopiedInit] = useState(false);

  const ide = ides.find((i) => i.id === activeIde)!;
  const config = buildConfig(activeRunner, activeIde);
  const initCommand = buildInitCommand(activeRunner, activeIde);

  const handleCopy = () => {
    navigator.clipboard.writeText(config).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyInit = () => {
    navigator.clipboard.writeText(initCommand).then(() => {
      setCopiedInit(true);
      setTimeout(() => setCopiedInit(false), 2000);
    });
  };

  return (
    <section
      className="ide-setup"
      style={{
        position: "relative",
        zIndex: 1,
        padding: "80px 100px",
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="ide-inner-row"
        style={{
          display: "flex",
          gap: 40,
          alignItems: "stretch",
          width: "100%",
        }}
      >
        <div style={{ minWidth: 0, maxWidth: 1200, flex: "0 1 1200px" }}>
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
              backgroundClip: "text",
              maxWidth: 630,
              marginBottom: 40,
            }}
          >
            &ldquo;Context+ is the best thing that has happened to my
            agent.&rdquo; Give it the semantic understanding it deserves. Add
            Context+ to your IDE by pasting the following JSON into your MCP
            configuration file.
          </p>

          <div
            className="ide-tab-bar"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 0 }}>
              {ides.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setActiveIde(i.id)}
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 300,
                    fontFamily: "var(--font-geist-mono)",
                    letterSpacing: "-0.02em",
                    color: activeIde === i.id ? "#000" : "#888",
                    background:
                      activeIde === i.id ? "rgba(0,0,0,0.04)" : "none",
                    backdropFilter: activeIde === i.id ? "blur(8px)" : "none",
                    WebkitBackdropFilter:
                      activeIde === i.id ? "blur(8px)" : "none",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "color 0.15s, background 0.15s",
                  }}
                >
                  {i.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 0 }}>
              {runners.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRunner(r.id)}
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 300,
                    fontFamily: "var(--font-geist-mono)",
                    color: activeRunner === r.id ? "#000" : "#888",
                    background:
                      activeRunner === r.id ? "rgba(0,0,0,0.04)" : "none",
                    backdropFilter:
                      activeRunner === r.id ? "blur(8px)" : "none",
                    WebkitBackdropFilter:
                      activeRunner === r.id ? "blur(8px)" : "none",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "color 0.15s, background 0.15s",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "rgba(0,0,0,0.04)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 24px 0",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 300,
                  color: "#888",
                  fontFamily: "var(--font-geist-mono)",
                }}
              >
                {ide.file}
              </span>
              <button
                onClick={handleCopy}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: 13,
                  fontWeight: 300,
                  color: copied ? "#000" : "#888",
                  fontFamily: "var(--font-geist-mono)",
                  transition: "color 0.15s",
                }}
              >
                {copied ? "copied" : "copy"}
              </button>
            </div>
            <pre
              style={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: 13,
                fontWeight: 300,
                lineHeight: "20px",
                color: "#333",
                padding: "12px 24px 20px",
                overflow: "auto",
                whiteSpace: "pre",
                margin: 0,
              }}
            >
              {highlightJson(config)}
            </pre>
          </div>

          <div
            style={{
              background: "rgba(0,0,0,0.04)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 24px 0",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 300,
                  color: "#888",
                  fontFamily: "var(--font-geist-mono)",
                }}
              >
                Terminal
              </span>
              <button
                onClick={handleCopyInit}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: 13,
                  fontWeight: 300,
                  color: copiedInit ? "#000" : "#888",
                  fontFamily: "var(--font-geist-mono)",
                  transition: "color 0.15s",
                }}
              >
                {copiedInit ? "copied" : "copy"}
              </button>
            </div>
            <pre
              style={{
                fontFamily: "var(--font-geist-mono)",
                fontSize: 13,
                fontWeight: 300,
                lineHeight: "20px",
                color: "#333",
                padding: "12px 24px 20px",
                overflow: "auto",
                whiteSpace: "pre",
                margin: 0,
              }}
            >
              {initCommand}
            </pre>
          </div>

          <a
            href="https://ollama.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 16,
              fontSize: 13,
              fontWeight: 300,
              fontFamily: "var(--font-geist-pixel-square)",
              color: "#888",
              textDecoration: "none",
              transition: "color 0.15s",
            }}
          >
            Before using Context+, make sure Ollama is running and install the
            required models (for example, nomic-embed-text and gemma2:27b).{" "}
            <span style={{ textDecoration: "underline" }}>
              Get your Ollama Cloud API key here
            </span>
            <svg
              width="9"
              height="9"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3.5 1.5H10.5V8.5" />
              <path d="M10.5 1.5L1.5 10.5" />
            </svg>
          </a>
        </div>

        <div
          className="ide-dashed-square"
          style={{
            flex: 1,
            pointerEvents: "none",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="ide-diag-lines"
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
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#ide-diag-lines)"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
