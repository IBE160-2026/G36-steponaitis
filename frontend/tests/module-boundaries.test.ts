import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// NFR-1 maintainability: frontend modules are isolated vertical slices.
const root = join(__dirname, "..");
const fixtureModules = ["__lint_a", "__lint_b"];

async function lintAs(file: string, code: string) {
  const eslint = new ESLint({ cwd: root });
  const [result] = await eslint.lintText(code, { filePath: join(root, file) });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports");
}

describe("nfr1 module may not import another module", () => {
  beforeAll(() => {
    for (const name of fixtureModules) mkdirSync(join(root, "modules", name), { recursive: true });
  });
  afterAll(() => {
    for (const name of fixtureModules) rmSync(join(root, "modules", name), { recursive: true, force: true });
  });

  it("rejects an import of another module through the alias", async () => {
    const messages = await lintAs("modules/__lint_a/x.ts", 'export { y } from "@/modules/__lint_b/y";\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe(2);
  });

  it("rejects a parent-relative import of another module", async () => {
    const messages = await lintAs("modules/__lint_a/x.ts", 'export { y } from "../__lint_b/y";\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe(2);
  });

  it("rejects a ./../ import of another module", async () => {
    const messages = await lintAs("modules/__lint_a/x.ts", 'export { y } from "./../__lint_b/y";\n');
    expect(messages).toHaveLength(1);
    expect(messages[0].severity).toBe(2);
  });

  it("allows the own module, lib, components and ./ imports", async () => {
    const code = [
      'export { a } from "@/modules/__lint_a/a";',
      'export { cn } from "@/lib/utils";',
      'export { b } from "@/components/common/b";',
      'export { c } from "./c";',
      "",
    ].join("\n");
    expect(await lintAs("modules/__lint_a/x.ts", code)).toEqual([]);
  });

  it("does not restrict files outside modules", async () => {
    expect(await lintAs("app/x.ts", 'export { y } from "@/modules/__lint_b/y";\n')).toEqual([]);
  });
});
