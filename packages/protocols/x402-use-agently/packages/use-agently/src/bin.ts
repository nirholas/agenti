#!/usr/bin/env node

import { cli } from "./cli";
import { checkAutoUpdate } from "./commands/update";
import { installTelemetry, flushTelemetry } from "./telemetry";
import { handleCliError } from "./errors";
import { resolveOutputFormat } from "./output";

installTelemetry(cli);

try {
  await cli.parseAsync();
  await Promise.all([checkAutoUpdate(), flushTelemetry()]);
} catch (err) {
  handleCliError(err, resolveOutputFormat(cli));
}
