import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type ExportTarget = string | Record<string, string>;

type PackageJson = {
  exports?: Record<string, ExportTarget>;
};

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageJsonPath = resolve(packageRoot, "package.json");
const packageJson = JSON.parse(
  readFileSync(packageJsonPath, "utf8")
) as PackageJson;

const resolveExportPath = (subpath: string) => {
  const entry = packageJson.exports?.[subpath];
  if (!entry || typeof entry !== "object") {
    throw new Error(`Missing export map entry for ${subpath}`);
  }

  const importTarget = entry.import;
  if (typeof importTarget !== "string") {
    throw new Error(`Missing import target for ${subpath}`);
  }

  return resolve(packageRoot, importTarget);
};

describe("token-gate exports", () => {
  it("resolves token-gate entrypoints", async () => {
    const tokenGatePath = resolveExportPath("./token-gate");
    const redisPath = resolveExportPath("./token-gate/cache/redis");

    expect(existsSync(tokenGatePath)).toBe(true);
    expect(existsSync(redisPath)).toBe(true);

    const tokenGateModule = await import(pathToFileURL(tokenGatePath).href);
    const redisModule = await import(pathToFileURL(redisPath).href);

    expect(tokenGateModule.createTokenGateChecker).toBeTypeOf("function");
    expect(redisModule.RedisTokenGateCache).toBeTypeOf("function");
  });
});
