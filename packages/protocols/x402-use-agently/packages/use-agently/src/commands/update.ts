import { Command } from "commander";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { output } from "../output";
import { loadConfig } from "../config";
import { clientFetch } from "../client";
import pkg from "../../package.json" with { type: "json" };

const UpdateStateSchema = z.object({
  lastUpdateCheck: z.string().optional(),
});

type UpdateState = z.infer<typeof UpdateStateSchema>;

function getUpdateStatePath(): string {
  return join(homedir(), ".use-agently", "update-state.json");
}

async function loadUpdateState(): Promise<UpdateState> {
  try {
    const contents = await readFile(getUpdateStatePath(), "utf8");
    const result = UpdateStateSchema.safeParse(JSON.parse(contents));
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

async function saveUpdateState(state: UpdateState): Promise<void> {
  await mkdir(join(homedir(), ".use-agently"), { recursive: true });
  await writeFile(getUpdateStatePath(), JSON.stringify(state, null, 2) + "\n", "utf8");
}

export const CURRENT_VERSION: string = pkg.version;

export function isDevVersion(): boolean {
  return CURRENT_VERSION === "0.0.0";
}

export async function getLatestVersion(): Promise<string> {
  const res = await clientFetch("https://registry.npmjs.org/use-agently/latest");
  if (!res.ok) throw new Error(`Failed to check npm registry: ${res.status}`);
  const data = (await res.json()) as { version: string };
  return data.version;
}

export async function runUpdate(version: string): Promise<void> {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version format received from registry: ${version}`);
  }
  execSync(`npm install -g use-agently@${version}`, { stdio: "pipe" });
}

export async function checkAndUpdate(): Promise<{ current: string; latest: string; updated: boolean }> {
  const current = CURRENT_VERSION;
  const latest = await getLatestVersion();
  const needsUpdate = current !== latest;

  if (needsUpdate) {
    await runUpdate(latest);
  }

  const state = await loadUpdateState();
  await saveUpdateState({ ...state, lastUpdateCheck: new Date().toISOString() });

  return { current, latest, updated: needsUpdate };
}

export async function checkAutoUpdate(): Promise<void> {
  try {
    if (isDevVersion()) return;

    const config = await loadConfig();
    if ((config?.env?.USE_AGENTLY_AUTO_UPDATE ?? 1) === 0) return;

    const state = await loadUpdateState();
    const lastCheck = state.lastUpdateCheck ? new Date(state.lastUpdateCheck).getTime() : 0;
    const hoursSinceLastCheck = (Date.now() - lastCheck) / (1000 * 60 * 60);

    if (hoursSinceLastCheck < 24) return;

    await checkAndUpdate();
  } catch (err) {
    console.warn("Auto-update failed:", err instanceof Error ? err.message : String(err));
  }
}

export const updateCommand = new Command("update")
  .description("Update use-agently to the latest version")
  .showHelpAfterError(true)
  .action(async (_options: Record<string, never>, command: Command) => {
    try {
      const result = await checkAndUpdate();
      output(command, result);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
