import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

type ExportTarget = string | Record<string, string>;

type PackageJson = {
  exports?: Record<string, ExportTarget>;
};

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = resolve(packageRoot, "package.json");
const packageJson = JSON.parse(
  readFileSync(packageJsonPath, "utf8")
) as PackageJson;

const exportsMap = packageJson.exports ?? {};
const missing: string[] = [];

const checkTarget = (subpath: string, field: string, target: string) => {
  const resolved = resolve(packageRoot, target);
  if (!existsSync(resolved)) {
    missing.push(`${subpath} (${field} -> ${target})`);
  }
};

for (const [subpath, entry] of Object.entries(exportsMap)) {
  if (typeof entry === "string") {
    checkTarget(subpath, "default", entry);
    continue;
  }

  if (!entry || typeof entry !== "object") continue;

  for (const [field, target] of Object.entries(entry)) {
    if (typeof target === "string") {
      checkTarget(subpath, field, target);
    }
  }
}

if (missing.length > 0) {
  console.error("Missing export targets:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exitCode = 1;
} else {
  console.log("All export targets are present.");
}
