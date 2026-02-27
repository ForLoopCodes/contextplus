import { describe, it } from "node:test";

const { spectralCluster, findPathPattern } =
  await import("../../build/core/clustering.js");

describe("DEMO: spectralCluster", () => {
  it("INPUT: 6 vectors forming 2 natural groups", () => {
    const vectors = [
      [1, 0, 0],
      [0.9, 0.1, 0],
      [0.8, 0.2, 0],
      [0, 0, 1],
      [0.1, 0, 0.9],
      [0.2, 0, 0.8],
    ];
    console.log("\n--- INPUT ---");
    console.log("6 vectors, 3 dimensions:");
    vectors.forEach((v, i) => console.log(`  [${i}]: [${v.join(", ")}]`));

    const clusters = spectralCluster(vectors, 5);

    console.log("\n--- OUTPUT ---");
    clusters.forEach((c, i) => {
      console.log(`  Cluster ${i}: indices [${c.indices.join(", ")}]`);
    });
    console.log("--- END ---\n");
  });
});

describe("DEMO: findPathPattern", () => {
  it("INPUT: paths with common prefix", () => {
    const paths = [
      "src/auth/login.ts",
      "src/auth/session.ts",
      "src/auth/middleware.ts",
    ];
    console.log("\n--- INPUT ---");
    console.log(paths);

    const pattern = findPathPattern(paths);

    console.log("\n--- OUTPUT ---");
    console.log(pattern);
    console.log("--- END ---\n");
  });

  it("INPUT: paths with common suffix", () => {
    const paths = ["user.test.ts", "auth.test.ts", "payment.test.ts"];
    console.log("\n--- INPUT ---");
    console.log(paths);

    const pattern = findPathPattern(paths);

    console.log("\n--- OUTPUT ---");
    console.log(pattern);
    console.log("--- END ---\n");
  });

  it("INPUT: no common pattern", () => {
    const paths = ["alpha.rs", "beta.py", "gamma.go"];
    console.log("\n--- INPUT ---");
    console.log(paths);

    const pattern = findPathPattern(paths);

    console.log("\n--- OUTPUT ---");
    console.log(pattern);
    console.log("--- END ---\n");
  });
});
