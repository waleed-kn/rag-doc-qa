// Pure helpers for rate limiting. No imports, so they are easy to test.

// Vercel and most proxies put the real client address first in x-forwarded-for.
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function secondsUntilReset(
  windowStartEpoch: number,
  windowSeconds: number,
  nowEpoch: number
): number {
  return Math.max(1, Math.ceil(windowStartEpoch + windowSeconds - nowEpoch));
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function formatWait(seconds: number): string {
  if (seconds < 90) return plural(seconds, "second");
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 90) return plural(minutes, "minute");
  return plural(Math.ceil(minutes / 60), "hour");
}
