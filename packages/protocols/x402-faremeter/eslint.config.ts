// @ts-check

import * as eslint from "@eslint/js";
import * as tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import * as fs from "node:fs";
import * as path from "node:path";

const buildFinished = ".build-finished";

const checkTypes =
  process.env.INSIDE_STAGING_DIR !== "true" &&
  fs.existsSync(path.join(import.meta.dirname, buildFinished));

export default defineConfig(
  eslint.configs.recommended,
  checkTypes ? tseslint.configs.strictTypeChecked : tseslint.configs.strict,
  checkTypes
    ? tseslint.configs.stylisticTypeChecked
    : tseslint.configs.stylistic,
  globalIgnores(["**/idl_type.ts", "**/dist/**"]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: checkTypes ? "warn" : "off",
    },
    rules: {
      "no-console": "error",
      "@typescript-eslint/consistent-type-definitions": 0,
      "@typescript-eslint/restrict-template-expressions": 0,
      "@typescript-eslint/no-confusing-void-expression": 0,
      "@typescript-eslint/require-await": 0,
      "@typescript-eslint/no-unnecessary-condition": 0,
      "@typescript-eslint/no-unsafe-argument": 0,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
