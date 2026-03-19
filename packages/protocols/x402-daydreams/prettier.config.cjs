/** @type {import('prettier').Config} */
module.exports = {
  endOfLine: "lf",
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  bracketSpacing: true,
  printWidth: 80,
  overrides: [
    {
      files: ["*.yml", "*.yaml"],
      options: {
        tabWidth: 2,
        proseWrap: "preserve",
        bracketSpacing: false,
      },
    },
    {
      files: ["*.md", "*.mdx"],
      options: {
        tabWidth: 2,
        proseWrap: "always",
        embeddedLanguageFormatting: "auto",
      },
    },
  ],
};
