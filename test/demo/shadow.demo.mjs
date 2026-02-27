import { describe, it, before, after } from "node:test";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const { createRestorePoint, restorePoint, listRestorePoints } =
  await import("../../build/git/shadow.js");

const FIXTURE = resolve("test/_demo_shadow_fixtures");

before(async () => {
  await mkdir(join(FIXTURE, "src"), { recursive: true });
  await writeFile(
    join(FIXTURE, "src", "config.ts"),
    "export const PORT = 3000;",
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("DEMO: shadow restore points", () => {
  it("INPUT: createRestorePoint + listRestorePoints", async () => {
    const input = {
      rootDir: FIXTURE,
      files: ["src/config.ts"],
      message: "Before port change",
    };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const rp = await createRestorePoint(
      FIXTURE,
      ["src/config.ts"],
      "Before port change",
    );

    console.log("\n--- OUTPUT (createRestorePoint) ---");
    console.log(JSON.stringify(rp, null, 2));

    await writeFile(
      join(FIXTURE, "src", "config.ts"),
      "export const PORT = 8080;",
    );

    const points = await listRestorePoints(FIXTURE);
    console.log("\n--- OUTPUT (listRestorePoints) ---");
    console.log(JSON.stringify(points, null, 2));
    console.log("--- END ---\n");
  });

  it("INPUT: restorePoint to undo a change", async () => {
    const points = await listRestorePoints(FIXTURE);
    const lastPoint = points[points.length - 1];
    const input = { rootDir: FIXTURE, pointId: lastPoint.id };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const { readFile } = await import("fs/promises");
    const before = await readFile(join(FIXTURE, "src", "config.ts"), "utf-8");
    console.log("\n--- BEFORE RESTORE ---");
    console.log(before);

    const restored = await restorePoint(FIXTURE, lastPoint.id);

    const after = await readFile(join(FIXTURE, "src", "config.ts"), "utf-8");
    console.log("\n--- OUTPUT (restored files) ---");
    console.log(restored);
    console.log("\n--- AFTER RESTORE ---");
    console.log(after);
    console.log("--- END ---\n");
  });
});
