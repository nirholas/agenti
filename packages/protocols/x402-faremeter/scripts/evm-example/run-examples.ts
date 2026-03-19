import { spinner, echo, $, sleep, type ProcessPromise } from "zx";

$.verbose = true;

async function runPayments() {
  await $`pnpm tsx evm-example/base-sepolia-payment.ts`;
  // XXX - Add the Ledger payment in future.
}

async function runUsingResourceServer(resourceServer: ProcessPromise) {
  await spinner("Sleeping, waiting for resource server to start...", async () =>
    sleep(500),
  );

  let success = true;

  try {
    await runPayments();
  } catch (e) {
    echo("error running payments: ", e);
    success = false;
  }

  echo("Killing off resource server...");
  void resourceServer.nothrow(true);
  await resourceServer.kill();

  return success;
}

const facilitator = $`cd ${import.meta.dirname}/../../apps/facilitator && pnpm tsx src`;
await spinner("Sleeping, waiting for facilitator to start...", async () =>
  sleep(2000),
);

let ret = 0;

if (
  !(await runUsingResourceServer($`pnpm tsx evm-example/server-express.ts`))
) {
  ret = 1;
}

echo("Killing off facilitator...");
void facilitator.nothrow(true);
await facilitator.kill();

process.exit(ret);
