export function argsFromEnv<A extends [string, ...string[]], R>(
  keys: A,
  fn: (...args: A) => R,
): R | undefined {
  const vals = keys.map((k) => process.env[k]);

  if (!vals.every((x) => x !== undefined)) {
    return;
  }

  return fn(...(vals as A));
}
