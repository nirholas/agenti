import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

type PackageJson = {
  name?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: {
    packages?: string[];
    catalog?: Record<string, string>;
  };
};

function readJson<T = unknown>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, data: unknown) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function ensureRootScripts(pkg: PackageJson): boolean {
  pkg.scripts ??= {};
  const desired: Record<string, string> = {
    "setup:changesets": "bun run scripts/setup-changesets.ts",
    changeset: "bunx changeset",
    "release:version": "bunx changeset version",
    "release:publish": "bun run scripts/changeset-publish.ts",
    release: "bun run release:version && bun run release:publish",
  };

  let updated = false;
  for (const [key, value] of Object.entries(desired)) {
    if (!pkg.scripts[key]) {
      pkg.scripts[key] = value;
      updated = true;
    }
  }
  return updated;
}

function ensureDevDependency(pkg: PackageJson): boolean {
  pkg.devDependencies ??= {};
  const target = "@changesets/cli";
  const version = "^2.27.9";
  if (!pkg.devDependencies[target]) {
    pkg.devDependencies[target] = version;
    return true;
  }
  return false;
}

function discoverPackages(): string[] {
  const packagesDir = path.join(repoRoot, "packages");
  if (!existsSync(packagesDir)) return [];
  const entries = readdirSync(packagesDir, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgJsonPath = path.join(packagesDir, entry.name, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    try {
      const pkg = readJson<PackageJson>(pkgJsonPath);
      if (pkg.name) names.push(pkg.name);
    } catch (err) {
      console.warn(
        `Skipping package at ${entry.name}: ${(err as Error).message}`
      );
    }
  }
  return names.sort();
}

function resolveWorkspacePackages(rootPkg: PackageJson): string[] {
  const patterns = rootPkg.workspaces?.packages ?? [];
  const names = new Set<string>();

  for (const pattern of patterns) {
    const starIdx = pattern.indexOf("*");
    if (starIdx === -1) {
      const manifestPath = path.join(repoRoot, pattern, "package.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const pkg = readJson<PackageJson>(manifestPath);
        if (pkg.name) names.add(pkg.name);
      } catch (err) {
        console.warn(
          `Skipping workspace entry ${pattern}: ${(err as Error).message}`
        );
      }
      continue;
    }

    const basePathRaw = pattern.slice(0, starIdx);
    const basePath = basePathRaw.endsWith("/")
      ? basePathRaw.slice(0, -1)
      : basePathRaw;
    const absBase = path.join(repoRoot, basePath);
    if (!existsSync(absBase)) continue;

    let entries: ReturnType<typeof readdirSync> = [];
    try {
      entries = readdirSync(absBase, { withFileTypes: true });
    } catch (err) {
      console.warn(
        `Unable to read workspace directory ${absBase}: ${(err as Error).message}`
      );
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(absBase, entry.name, "package.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const pkg = readJson<PackageJson>(manifestPath);
        if (pkg.name) names.add(pkg.name);
      } catch (err) {
        console.warn(
          `Skipping workspace package at ${path.join(
            basePath,
            entry.name
          )}: ${(err as Error).message}`
        );
      }
    }
  }

  return Array.from(names).sort();
}

function ensureConfig(
  packageNames: string[],
  ignoredPackages: string[]
): boolean {
  const configDir = path.join(repoRoot, ".changeset");
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });

  const configPath = path.join(configDir, "config.json");
  const desiredConfig = {
    $schema: "https://unpkg.com/@changesets/config@3.0.3/schema.json",
    changelog: "@changesets/cli/changelog",
    commit: false,
    fixed: packageNames.length ? [packageNames] : [],
    linked: [] as string[][],
    access: "public" as const,
    baseBranch: "main",
    updateInternalDependencies: "patch" as const,
    ignore: ignoredPackages,
  };

  let changed = true;
  if (existsSync(configPath)) {
    try {
      const existing = readJson<Record<string, unknown>>(configPath);
      changed = JSON.stringify(existing) !== JSON.stringify(desiredConfig);
    } catch {
      changed = true;
    }
  }

  if (changed) {
    writeJson(configPath, desiredConfig);
  }

  const readmePath = path.join(configDir, "README.md");
  if (!existsSync(readmePath)) {
    const lines = `# Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) to manage versioning and releases.

- Queue a release: \`bun run changeset\`
- Apply version bumps: \`bun run release:version\`
- Publish to npm: \`bun run release\`
`;
    writeFileSync(readmePath, lines, "utf8");
  }

  return changed;
}

async function main() {
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (!existsSync(packageJsonPath))
    throw new Error("package.json not found at repo root");

  const pkg = readJson<PackageJson>(packageJsonPath);
  const scriptsUpdated = ensureRootScripts(pkg);
  const depUpdated = ensureDevDependency(pkg);

  if (scriptsUpdated || depUpdated) {
    writeJson(packageJsonPath, pkg);
    console.log(
      "Updated package.json with Changesets scripts and dev dependency."
    );
  }

  const packageNames = discoverPackages();
  if (!packageNames.length) {
    console.warn(
      "No packages discovered under ./packages; skipping config generation."
    );
    return;
  }

  const workspacePackages = resolveWorkspacePackages(pkg);
  const fixedSet = new Set(packageNames);
  const ignoredPackages = workspacePackages.filter(
    (name) => !fixedSet.has(name)
  );

  const configChanged = ensureConfig(packageNames, ignoredPackages);
  if (configChanged) {
    console.log("Wrote .changeset/config.json with fixed release group:");
    console.log(`  - ${packageNames.join(", ")}`);
    if (ignoredPackages.length) {
      console.log("Ignored workspaces:");
      for (const name of ignoredPackages) console.log(`  - ${name}`);
    }
  } else {
    console.log("Changeset config already up to date.");
  }

  console.log("\nNext steps:");
  console.log("  1. Install dependencies if needed: bun install");
  console.log("  2. Queue changes with: bun run changeset");
  console.log("  3. Publish with: bun run release");
}

await main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
