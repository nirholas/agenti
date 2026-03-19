/* eslint-disable no-console, @typescript-eslint/no-empty-function */

/**
 * Suppresses console.error output during tests.
 * Returns a restore function to be called in teardown.
 *
 * Usage with tap:
 *   t.teardown(suppressConsoleErrors());
 */
export function suppressConsoleErrors(): () => void {
  const original = console.error;
  console.error = () => {};
  return () => {
    console.error = original;
  };
}
