import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: "Contextual — Semantic Intelligence for Large-Scale Engineering",
  description:
    "MCP server designed for developers who demand 99% accuracy. Tree-sitter AST parsing, Spectral Clustering, and Obsidian-style linking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={geist.className}>{children}</body>
    </html>
  );
}
