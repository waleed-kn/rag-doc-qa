export function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  if (e?.status === 429 || e?.status === 503) return true;
  return /429|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(e?.message ?? "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries: number; baseDelayMs: number }
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= opts.maxRetries || !isRetryable(err)) throw err;
      const delay = opts.baseDelayMs * 2 ** attempt + Math.random() * 250;
      await sleep(delay);
    }
  }
}
