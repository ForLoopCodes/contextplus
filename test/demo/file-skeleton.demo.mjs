import { describe, it, before, after } from "node:test";
import { mkdir, writeFile, rm } from "fs/promises";
import { join, resolve } from "path";

const { getFileSkeleton } = await import("../../build/tools/file-skeleton.js");

const FIXTURE = resolve("test/_demo_skel_fixtures");

before(async () => {
  await mkdir(join(FIXTURE, "src"), { recursive: true });
  await writeFile(
    join(FIXTURE, "src", "service.ts"),
    [
      "// User service handling CRUD operations on the user model",
      "// FEATURE: User Management",
      "",
      "export interface User { id: string; name: string; email: string; }",
      "",
      "export class UserService {",
      "  private users: User[] = [];",
      "",
      "  create(name: string, email: string): User {",
      '    const user = { id: "1", name, email };',
      "    this.users.push(user);",
      "    return user;",
      "  }",
      "",
      "  findById(id: string): User | undefined {",
      "    return this.users.find(u => u.id === id);",
      "  }",
      "",
      "  delete(id: string): boolean {",
      "    const idx = this.users.findIndex(u => u.id === id);",
      "    if (idx === -1) return false;",
      "    this.users.splice(idx, 1);",
      "    return true;",
      "  }",
      "}",
    ].join("\n"),
  );
});

after(async () => {
  await rm(FIXTURE, { recursive: true, force: true });
});

describe("DEMO: get_file_skeleton", () => {
  it("INPUT: filePath='src/service.ts'", async () => {
    const input = { rootDir: FIXTURE, filePath: "src/service.ts" };
    console.log("\n--- INPUT ---");
    console.log(JSON.stringify(input, null, 2));

    const output = await getFileSkeleton(input);

    console.log("\n--- OUTPUT ---");
    console.log(output);
    console.log("--- END ---\n");
  });
});
