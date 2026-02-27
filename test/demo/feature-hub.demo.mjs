import { describe, it, before, after } from "node:test";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const { parseWikiLinks, parseCrossLinks, extractFeatureTag, parseHubFile } =
  await import("../../build/core/hub.js");
const { getFeatureHub } = await import("../../build/tools/feature-hub.js");

const FIXTURE = resolve("test/_demo_hub_fixtures");

before(async () => {
  await mkdir(join(FIXTURE, "src"), { recursive: true });

  await writeFile(
    join(FIXTURE, "auth.md"),
    [
      "# Authentication",
      "",
      "Core auth feature hub linking all related modules.",
      "",
      "## Modules",
      "",
      "- [[src/login.ts|User login flow with password hashing]]",
      "- [[src/session.ts|JWT session management and refresh]]",
      "- [[src/middleware.ts|Route protection middleware]]",
      "",
      "## Dependencies",
      "",
      "@linked-to [[database]]",
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "src", "login.ts"),
    [
      "// User login flow with bcrypt password hashing verification",
      "// FEATURE: Authentication",
      "",
      "export function login(user: string, pass: string): boolean { return true; }",
      "export function hashPassword(raw: string): string { return raw; }",
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "src", "session.ts"),
    [
      "// JWT session management with token refresh and expiry",
      "// FEATURE: Authentication",
      "",
      "export function createSession(userId: string): string { return userId; }",
      "export function refreshToken(token: string): string { return token; }",
    ].join("\n"),
  );

  await writeFile(
    join(FIXTURE, "src", "orphan.ts"),
    [
      "// Orphaned utility not linked to any feature hub",
      "// FEATURE: Unknown",
      "",
      "export const MAGIC = 42;",
    ].join("\n"),
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("DEMO: hub parser", () => {
  it("INPUT: parseWikiLinks on markdown content", () => {
    const input = "- [[src/login.ts|Login handler]]\n- [[src/session.ts]]";
    console.log("\n--- INPUT ---");
    console.log(input);

    const output = parseWikiLinks(input);

    console.log("\n--- OUTPUT ---");
    console.log(JSON.stringify(output, null, 2));
    console.log("--- END ---\n");
  });

  it("INPUT: parseCrossLinks on file content", () => {
    const input = "@linked-to [[database]]\n@linked-to [[payments]]";
    console.log("\n--- INPUT ---");
    console.log(input);

    const output = parseCrossLinks(input, "src/auth.ts");

    console.log("\n--- OUTPUT ---");
    console.log(JSON.stringify(output, null, 2));
    console.log("--- END ---\n");
  });

  it("INPUT: extractFeatureTag from file header", () => {
    const input =
      "// Payment processing for Stripe integration\n// FEATURE: Payment System";
    console.log("\n--- INPUT ---");
    console.log(input);

    const output = extractFeatureTag(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });
});

describe("DEMO: get_feature_hub", () => {
  it("INPUT: no args (list all hubs)", async () => {
    const input = { rootDir: FIXTURE };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getFeatureHub(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: hub_path='auth.md' (bundled skeletons)", async () => {
    const input = { rootDir: FIXTURE, hubPath: "auth.md" };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getFeatureHub(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: feature_name='auth' (search by name)", async () => {
    const input = { rootDir: FIXTURE, featureName: "auth" };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getFeatureHub(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });

  it("INPUT: show_orphans=true", async () => {
    const input = { rootDir: FIXTURE, showOrphans: true };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getFeatureHub(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });
});
