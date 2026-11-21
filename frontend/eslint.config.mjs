import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

const here = dirname(fileURLToPath(import.meta.url));

// Vertical slices: a module under modules/ imports only components/* and lib/*, never another
// module. Built from the directory list at load, so a new module gets the rule automatically.
const modules = readdirSync(join(here, "modules"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const moduleBoundaries = modules.map((name) => ({
  files: [`modules/${name}/**/*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            regex: `^@/modules/(?!${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$))`,
            message: `Module "${name}" may not import another module. Move shared code to components/common or lib.`,
          },
          {
            regex: "(^|/)\\.\\.(/|$)",
            message: "Parent-relative imports are not allowed inside modules. Use @/components, @/lib or ./.",
          },
        ],
      },
    ],
  },
}));

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...moduleBoundaries,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
  ]),
]);
