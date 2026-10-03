import type { NextRequest } from "next/server";
import { config } from "./config";
import { getPool } from "./db";
import { AppError } from "./errors";
import {
  formatWait,
  getClientIp,
  secondsUntilReset,
} from "./rate-limit-utils";

interface Rule {
  scope: "ip" | "global";
  name: string;
  limit: number;
  windowSeconds: number;
}

// Adds 1 to the counter for the current time window and returns the new count.
// One atomic statement, so it is safe when many requests arrive at once.
async function hit(key: string, windowSeconds: number) {
  const res = await getPool().query(
    `INSERT INTO rate_limits (key, window_start, count)
     VALUES ($1, to_timestamp(floor(extract(epoch from now()) / $2::int) * $2::int), 1)
     ON CONFLICT (key, window_start)
     DO UPDATE SET count = rate_limits.count + 1
     RETURNING count,
               extract(epoch from window_start)::float8 AS start_epoch,
               extract(epoch from now())::float8 AS now_epoch`,
    [key, windowSeconds]
  );
  const row = res.rows[0];
  return {
    count: row.count as number,
    startEpoch: row.start_epoch as number,
    nowEpoch: row.now_epoch as number,
  };
}

// Old counters are useless, so delete them now and then (about 1 request in 50).
function cleanupSometimes() {
  if (Math.random() > 0.02) return;
  void getPool()
    .query("DELETE FROM rate_limits WHERE window_start < now() - interval '2 days'")
    .catch(() => {});
}

async function enforce(req: NextRequest, route: string, rules: Rule[]) {
  // Turn off for local development and the eval run.
  if (process.env.RATE_LIMIT_DISABLED === "true") return;

  const ip = getClientIp(req.headers);

  for (const rule of rules) {
    const key =
      rule.scope === "ip"
        ? `${route}:${rule.name}:ip:${ip}`
        : `${route}:${rule.name}:global`;

    let result;
    try {
      result = await hit(key, rule.windowSeconds);
    } catch (err) {
      // If the limiter itself breaks, let the request through.
      console.error("rate limit check failed, allowing request", err);
      return;
    }

    if (result.count > rule.limit) {
      const wait = secondsUntilReset(
        result.startEpoch,
        rule.windowSeconds,
        result.nowEpoch
      );
      const message =
        rule.scope === "global"
          ? `The demo is busy right now. Try again in ${formatWait(wait)}.`
          : `Too many requests. Try again in ${formatWait(wait)}.`;
      throw new AppError("RATE_LIMITED", message, 429, wait);
    }
  }

  cleanupSometimes();
}

const rl = config.rateLimit;

export const limitAsk = (req: NextRequest) =>
  enforce(req, "ask", [
    { scope: "ip", name: "minute", limit: rl.ask.perIpPerMinute, windowSeconds: 60 },
    { scope: "ip", name: "day", limit: rl.ask.perIpPerDay, windowSeconds: 86400 },
    { scope: "global", name: "minute", limit: rl.ask.globalPerMinute, windowSeconds: 60 },
    { scope: "global", name: "day", limit: rl.ask.globalPerDay, windowSeconds: 86400 },
  ]);

export const limitUpload = (req: NextRequest) =>
  enforce(req, "upload", [
    { scope: "ip", name: "hour", limit: rl.upload.perIpPerHour, windowSeconds: 3600 },
  ]);

export const limitProcess = (req: NextRequest) =>
  enforce(req, "process", [
    { scope: "ip", name: "minute", limit: rl.process.perIpPerMinute, windowSeconds: 60 },
  ]);
