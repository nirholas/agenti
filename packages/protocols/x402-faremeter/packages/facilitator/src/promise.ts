export function sleep<T>(sleepMs: number, value?: T): Promise<T | undefined> {
  return new Promise((resolve) => setTimeout(() => resolve(value), sleepMs));
}

export function timeout<T>(timeoutMs: number, msg?: string) {
  return new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(msg ?? "timed out")), timeoutMs),
  );
}

export function allSettledWithTimeout<T>(
  promises: readonly Promise<T>[],
  timeoutMs: number,
) {
  const timedPromises = promises.map((p) =>
    Promise.race([p, timeout<T>(timeoutMs, "request timed out")]),
  );

  return Promise.allSettled(timedPromises);
}
