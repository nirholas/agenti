#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Read workspace configuration
const workspaceConfig = fs.readFileSync(
  path.join(__dirname, "..", "pnpm-workspace.yaml"),
  "utf8"
);
const catalogMatch = workspaceConfig.match(
  /catalog:\s*\n([\s\S]*?)(?=\n\S|\n*$)/
);

if (!catalogMatch) {
  console.error("Could not find catalog in pnpm-workspace.yaml");
  process.exit(1);
}

// Parse catalog entries
const catalog = {};
const catalogLines = catalogMatch[1].split("\n");
catalogLines.forEach((line) => {
  const match = line.match(/^\s*"?([^":]+)"?\s*:\s*(.+)$/);
  if (match) {
    const [, pkg, version] = match;
    catalog[pkg.trim()] = version.trim();
  }
});

console.log("Parsed catalog:", catalog);

// Find all package.json files in packages directory
const packagesDir = path.join(__dirname, "..", "packages");
const packageDirs = fs
  .readdirSync(packagesDir)
  .filter((dir) => fs.statSync(path.join(packagesDir, dir)).isDirectory());

// Process each package
packageDirs.forEach((packageDir) => {
  const packageJsonPath = path.join(packagesDir, packageDir, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  console.log(`\nProcessing ${packageDir}...`);

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  let modified = false;

  // Process dependencies
  ["dependencies", "devDependencies", "peerDependencies"].forEach((depType) => {
    if (packageJson[depType]) {
      Object.keys(packageJson[depType]).forEach((dep) => {
        if (packageJson[depType][dep] === "catalog:") {
          if (catalog[dep]) {
            console.log(`  Resolving ${dep}: catalog: -> ${catalog[dep]}`);
            packageJson[depType][dep] = catalog[dep];
            modified = true;
          } else {
            console.warn(`  WARNING: ${dep} not found in catalog!`);
          }
        }
      });
    }
  });

  // Write back if modified
  if (modified) {
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + "\n"
    );
    console.log(`  Updated ${packageJsonPath}`);
  } else {
    console.log(`  No catalog references found`);
  }
});

console.log("\nCatalog resolution complete!");
