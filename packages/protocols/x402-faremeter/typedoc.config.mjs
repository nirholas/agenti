import { OptionDefaults } from "typedoc";

export default {
  plugin: ["typedoc-plugin-markdown", "typedoc-plugin-frontmatter"],
  name: "Faremeter API",
  entryPointStrategy: "resolve",
  entryPoints: ["packages/*/src/index.ts"],
  out: "docs",
  readme: "none",
  entryFileName: "index",
  router: "module",
  cleanOutputDir: true,
  excludeScopesInPaths: true,
  sourceLinkTemplate:
    "https://github.com/faremeter/faremeter/blob/main/{path}#L{line}",
  exclude: [
    "**/node_modules/**",
    "scripts/**",
    "apps/**",
    "tests/**",
    "**/*.test.ts",
  ],
  tsconfig: "tsconfig.typedoc.json",
  sanitizeComments: true,
  flattenOutputFiles: true,
  blockTags: [
    ...OptionDefaults.blockTags,
    "@title",
    "@sidebarTitle",
    "@description",
  ],
  frontmatterCommentTags: ["title", "sidebarTitle", "description"],
  indexFrontmatter: {
    title: "Faremeter API Reference",
    sidebarTitle: "API Reference",
    description:
      "Complete API reference documentation for the Faremeter x402 payment protocol SDK",
  },
};
