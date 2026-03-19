import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";

export default tseslint.config(
  {
    ignores: ["node_modules", "**/build/**", "**/dist/**", "**/*.test.ts"],
  },
  {
    files: ["packages/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      "import-x": importX,
    },
    rules: {
      "import-x/extensions": ["error", "never", { json: "always" }],
    },
  },
  {
    files: ["**/mcp.ts", "**/mcp.test.ts"],
    rules: {
      "import-x/extensions": "off",
    },
  },
);
