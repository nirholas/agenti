/* eslint-disable @typescript-eslint/no-deprecated -- v1 test harness uses v1 types */
import type { PaymentExecerV1 } from "@faremeter/types/client";

/**
 * Chooser that selects the first available payment option.
 *
 * @param execers - Available payment execers.
 * @returns The first execer in the list.
 * @throws If no options are available.
 */
export function chooseFirst(execers: PaymentExecerV1[]): PaymentExecerV1 {
  if (execers.length === 0) {
    throw new Error("No payment options available");
  }
  const first = execers[0];
  if (!first) {
    throw new Error("No payment options available");
  }
  return first;
}

/**
 * Chooser that selects the cheapest payment option by maxAmountRequired.
 *
 * @param execers - Available payment execers.
 * @returns The execer with the lowest amount.
 * @throws If no options are available.
 */
export function chooseCheapest(execers: PaymentExecerV1[]): PaymentExecerV1 {
  if (execers.length === 0) {
    throw new Error("No payment options available");
  }
  return execers.reduce((cheapest, current) =>
    BigInt(current.requirements.maxAmountRequired) <
    BigInt(cheapest.requirements.maxAmountRequired)
      ? current
      : cheapest,
  );
}

/**
 * Chooser that selects the most expensive payment option by maxAmountRequired.
 *
 * @param execers - Available payment execers.
 * @returns The execer with the highest amount.
 * @throws If no options are available.
 */
export function chooseMostExpensive(
  execers: PaymentExecerV1[],
): PaymentExecerV1 {
  if (execers.length === 0) {
    throw new Error("No payment options available");
  }
  return execers.reduce((expensive, current) =>
    BigInt(current.requirements.maxAmountRequired) >
    BigInt(expensive.requirements.maxAmountRequired)
      ? current
      : expensive,
  );
}

/**
 * Creates a chooser that selects by asset name.
 *
 * @param asset - Asset name to match (case-insensitive).
 * @returns A chooser function.
 */
export function chooseByAsset(
  asset: string,
): (execers: PaymentExecerV1[]) => PaymentExecerV1 {
  return (execers) => {
    const match = execers.find(
      (e) => e.requirements.asset.toLowerCase() === asset.toLowerCase(),
    );
    if (!match) {
      throw new Error(`No payment option for asset: ${asset}`);
    }
    return match;
  };
}

/**
 * Creates a chooser that selects by network name.
 *
 * @param network - Network name to match (case-insensitive).
 * @returns A chooser function.
 */
export function chooseByNetwork(
  network: string,
): (execers: PaymentExecerV1[]) => PaymentExecerV1 {
  return (execers) => {
    const match = execers.find(
      (e) => e.requirements.network.toLowerCase() === network.toLowerCase(),
    );
    if (!match) {
      throw new Error(`No payment option for network: ${network}`);
    }
    return match;
  };
}

/**
 * Creates a chooser that selects by payment scheme.
 *
 * @param scheme - Scheme name to match (case-insensitive).
 * @returns A chooser function.
 */
export function chooseByScheme(
  scheme: string,
): (execers: PaymentExecerV1[]) => PaymentExecerV1 {
  return (execers) => {
    const match = execers.find(
      (e) => e.requirements.scheme.toLowerCase() === scheme.toLowerCase(),
    );
    if (!match) {
      throw new Error(`No payment option for scheme: ${scheme}`);
    }
    return match;
  };
}

/**
 * Creates a chooser that selects by array index.
 *
 * @param index - Zero-based index of the option to select.
 * @returns A chooser function.
 */
export function chooseByIndex(
  index: number,
): (execers: PaymentExecerV1[]) => PaymentExecerV1 {
  return (execers) => {
    const execer = execers[index];
    if (!execer) {
      throw new Error(
        `Index ${index} out of bounds (${execers.length} options available)`,
      );
    }
    return execer;
  };
}

/**
 * Chooser that always throws, useful for testing "no suitable option" paths.
 *
 * @throws Always throws "No suitable payment option".
 */
export function chooseNone(): never {
  throw new Error("No suitable payment option");
}

/**
 * Wraps a chooser to inspect options before choosing.
 *
 * @param inspector - Callback to inspect available options.
 * @param inner - Chooser to delegate to after inspection.
 * @returns A chooser that inspects then delegates.
 */
export function chooseWithInspection(
  inspector: (execers: PaymentExecerV1[]) => void,
  inner: (execers: PaymentExecerV1[]) => PaymentExecerV1,
): (execers: PaymentExecerV1[]) => PaymentExecerV1 {
  return (execers) => {
    inspector(execers);
    return inner(execers);
  };
}

/**
 * Wraps a chooser to filter options before choosing.
 *
 * @param filter - Predicate to filter available options.
 * @param inner - Chooser to delegate to after filtering.
 * @returns A chooser that filters then delegates.
 */
export function chooseWithFilter(
  filter: (execer: PaymentExecerV1) => boolean,
  inner: (execers: PaymentExecerV1[]) => PaymentExecerV1,
): (execers: PaymentExecerV1[]) => PaymentExecerV1 {
  return (execers) => {
    const filtered = execers.filter(filter);
    return inner(filtered);
  };
}
