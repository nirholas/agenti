#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { downloadTemplate } from "giget";

const templates = [
  {
    value: "starter-kit",
    title: "Starter kit",
    description: "Full-featured x402 starter with Express, OpenAI, and Docker",
    repo: "dabit3/x402-starter-kit"
  },
  {
    value: "fullstack/next",
    title: "Next.js app",
    description: "Route protection with x402-next middleware"
  },
  {
    value: "fullstack/mainnet",
    title: "Next.js mainnet",
    description: "Base mainnet using Coinbase hosted facilitator"
  },
  {
    value: "fullstack/next-advanced",
    title: "Next.js advanced",
    description: "[WIP] Paywall + session cookie after verify/settle"
  },
  {
    value: "fullstack/browser-wallet-example",
    title: "Browser wallet",
    description: "Hono server + React client with session and one-time payments"
  },
  {
    value: "fullstack/farcaster-miniapp",
    title: "Farcaster Mini App",
    description: "x402-protected APIs using MiniKit"
  },
  {
    value: "fullstack/auth_based_pricing",
    title: "Auth-based pricing",
    description: "SIWE + JWT with conditional pricing ($0.01 vs $0.10)"
  },
  {
    value: "servers/express",
    title: "Express server",
    description: "Express.js with x402-express middleware"
  },
  {
    value: "servers/hono",
    title: "Hono server",
    description: "Hono with x402-hono middleware"
  },
  {
    value: "servers/advanced",
    title: "Express advanced",
    description: "Delayed settlement, dynamic pricing, multiple requirements"
  },
  {
    value: "servers/mainnet",
    title: "Server mainnet",
    description: "Accept real USDC on Base mainnet"
  },
  {
    value: "agent",
    title: "Anthropic agent",
    description: "Agent that pays via a Go proxy using x402-fetch"
  },
  {
    value: "dynamic_agent",
    title: "Dynamic agent",
    description: "Discovers tools dynamically and pays per-request"
  },
  {
    value: "discovery",
    title: "Discovery",
    description: "List available x402-protected resources (Bazaar)"
  },
  {
    value: "mcp",
    title: "MCP server",
    description: "Paid API requests via x402-axios (Claude Desktop compatible)"
  },
  {
    value: "mcp-embedded-wallet",
    title: "MCP embedded wallet",
    description: "Electron MCP server with embedded wallet signing via IPC"
  },
  {
    value: "facilitator",
    title: "Facilitator",
    description: "Payment facilitator exposing /verify and /settle"
  }
];

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const fixWorkspaceDeps = (targetDir) => {
  const pkgPath = path.join(targetDir, "package.json");
  if (!fs.existsSync(pkgPath)) return false;

  const content = fs.readFileSync(pkgPath, "utf8");
  if (!content.includes("workspace:")) return false;

  const pkg = JSON.parse(content);
  let modified = false;

  for (const depType of ["dependencies", "devDependencies", "peerDependencies"]) {
    if (!pkg[depType]) continue;
    for (const [name, version] of Object.entries(pkg[depType])) {
      if (typeof version === "string" && version.startsWith("workspace:")) {
        pkg[depType][name] = "latest";
        modified = true;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }
  return modified;
};

const headline = chalk.bold.cyanBright("create-x402");
console.log(`\n${headline} ${chalk.dim("•")} ${chalk.gray("Scaffold a new x402 project")}\n`);

const runStep = (
  cmd,
  args,
  {
    startText,
    successText,
    failureText,
    silent = false,
    env = {},
    cwd = process.cwd(),
    progressItems,
    progressInterval = 350
  }
) =>
  new Promise((resolve) => {
    const task = ora(startText).start();
    let stdout = "";
    let stderr = "";
    let ticker;

    if (progressItems?.length) {
      let i = 0;
      ticker = setInterval(() => {
        const label = progressItems[i % progressItems.length];
        task.text = `${startText} ${chalk.dim(label)}`;
        i += 1;
      }, progressInterval);
    }

    const child = spawn(cmd, args, {
      cwd,
      stdio: silent ? ["ignore", "pipe", "pipe"] : "inherit",
      env: { ...process.env, ...env }
    });

    if (child.stdout) child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    if (child.stderr) child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("error", (err) => {
      if (ticker) clearInterval(ticker);
      task.fail(failureText);
      console.error(chalk.red(err.message));
      process.exit(1);
    });

    child.on("close", (code) => {
      if (ticker) clearInterval(ticker);
      if (code !== 0) {
        task.fail(failureText);
        if (silent) {
          if (stderr.trim()) console.error(chalk.red(stderr.trim()));
          if (stdout.trim()) console.error(stdout.trim());
        }
        process.exit(code ?? 1);
      } else {
        task.succeed(successText);
        resolve();
      }
    });
  });

const main = async () => {
  const response = await prompts(
    [
      {
        type: "select",
        name: "template",
        message: "Select a template",
        choices: templates,
        initial: 0
      },
      {
        type: "text",
        name: "projectName",
        message: "Project name",
        initial: (prev) => prev.split("/").pop()
      }
    ],
    {
      onCancel: () => {
        console.log(chalk.yellow("\nCancelled."));
        process.exit(0);
      }
    }
  );

  const { template, projectName } = response;
  const target = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(target)) {
    console.error(chalk.red(`\nFolder ${projectName} already exists. Pick another name.`));
    process.exit(1);
  }

  const selectedTemplate = templates.find((t) => t.value === template);
  const repo = selectedTemplate?.repo
    ? `github:${selectedTemplate.repo}`
    : `github:coinbase/x402/examples/typescript/${template}`;

  const spinner = ora(`Downloading ${chalk.cyan(template)}`).start();

  try {
    await downloadTemplate(repo, {
      dir: target,
      force: true
    });
    spinner.succeed("Template downloaded");
  } catch (err) {
    spinner.fail("Failed to download template");
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  const fixSpinner = ora("Preparing package.json").start();
  const wasFixed = fixWorkspaceDeps(target);
  if (wasFixed) {
    fixSpinner.succeed("Fixed workspace dependencies");
  } else {
    fixSpinner.stop();
  }

  const installLabel = "Installing dependencies";
  await runStep(npmCommand, ["install", "--loglevel", "error", "--no-progress"], {
    startText: installLabel,
    successText: "Dependencies installed",
    failureText: "npm install failed",
    silent: true,
    env: {
      npm_config_fund: "false",
      npm_config_audit: "false",
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --no-warnings`
    },
    cwd: target
  });

  console.log(`\n${chalk.green("Success!")} ${chalk.bold(projectName)} is ready.`);
  console.log(`\nNext steps:`);
  console.log(`  ${chalk.cyan(`cd ${projectName}`)}`);
  console.log(`  Configure your ${chalk.dim(".env")} file`);
  console.log(`  ${chalk.cyan("npm run dev")}\n`);
};

main();
