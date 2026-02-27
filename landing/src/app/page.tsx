export default function Home() {
  return (
    <div className="relative w-full min-h-screen">
      {/* Navbar */}
      <nav
        className="flex justify-between items-center"
        style={{ padding: "30px 100px" }}
      >
        <span
          className="font-light text-black"
          style={{ fontSize: 20, lineHeight: "26px" }}
        >
          Contextual
        </span>
        <a
          href="https://github.com/ForLoopCodes/contextual"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1E1E1E"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        </a>
      </nav>

      {/* Hero */}
      <section
        className="flex flex-col"
        style={{ padding: "64px 100px 0", gap: 34, maxWidth: 819 }}
      >
        <h1
          className="font-light"
          style={{ fontSize: 48, lineHeight: "62px", color: "rgba(0,0,0,0.5)" }}
        >
          Semantic Intelligence for
          <br />
          <span className="text-black">Large-Scale Engineering</span>
        </h1>
        <p
          className="font-light text-black"
          style={{ fontSize: 16, lineHeight: "22px", maxWidth: 719 }}
        >
          Contextual is an MCP server designed for developers who demand 99%
          accuracy. By combining Tree-sitter AST parsing, Spectral Clustering,
          and Obsidian-style linking, Contextual turns a massive codebase into a
          searchable, hierarchical feature graph.
        </p>
      </section>
    </div>
  );
}
