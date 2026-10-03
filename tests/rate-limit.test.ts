import { describe, expect, it } from "vitest";
import { config } from "../src/lib/config";
import {
  formatWait,
  getClientIp,
  secondsUntilReset,
} from "../src/lib/rate-limit-utils";

describe("getClientIp", () => {
  it("uses the first address in x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(getClientIp(headers)).toBe("198.51.100.7");
  });

  it("returns unknown when no address header is present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("secondsUntilReset", () => {
  it("counts the seconds left in the window", () => {
    expect(secondsUntilReset(100, 60, 130)).toBe(30);
  });

  it("never returns less than 1 second", () => {
    expect(secondsUntilReset(100, 60, 160)).toBe(1);
    expect(secondsUntilReset(100, 60, 200)).toBe(1);
  });

  it("rounds partial seconds up", () => {
    expect(secondsUntilReset(100, 60, 130.2)).toBe(30);
  });
});

describe("formatWait", () => {
  it("uses the singular for one second", () => {
    expect(formatWait(1)).toBe("1 second");
  });

  it("shows seconds for short waits", () => {
    expect(formatWait(45)).toBe("45 seconds");
  });

  it("shows minutes for medium waits", () => {
    expect(formatWait(120)).toBe("2 minutes");
  });

  it("shows hours for long waits", () => {
    expect(formatWait(7200)).toBe("2 hours");
  });
});

describe("rate limit config", () => {
  it("has positive limits everywhere", () => {
    const rl = config.rateLimit;
    const values = [
      rl.ask.perIpPerMinute,
      rl.ask.perIpPerDay,
      rl.ask.globalPerMinute,
      rl.ask.globalPerDay,
      rl.upload.perIpPerHour,
      rl.process.perIpPerMinute,
    ];
    for (const value of values) {
      expect(value).toBeGreaterThan(0);
    }
  });

  it("per-IP daily limit does not exceed the global daily limit", () => {
    const ask = config.rateLimit.ask;
    expect(ask.perIpPerDay).toBeLessThanOrEqual(ask.globalPerDay);
  });
});
