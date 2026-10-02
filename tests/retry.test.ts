import { describe, expect, it } from "vitest";
import { isRetryable, withRetry } from "../src/lib/retry";

const fast = { maxRetries: 3, baseDelayMs: 1 };

describe("isRetryable", () => {
  it("retries rate limit and unavailable statuses", () => {
    expect(isRetryable({ status: 429 })).toBe(true);
    expect(isRetryable({ status: 503 })).toBe(true);
  });

  it("retries rate limit messages", () => {
    expect(isRetryable(new Error("RESOURCE_EXHAUSTED: quota"))).toBe(true);
  });

  it("does not retry ordinary errors", () => {
    expect(isRetryable({ status: 400 })).toBe(false);
    expect(isRetryable(new Error("boom"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns the value when the first call works", async () => {
    const result = await withRetry(async () => "ok", fast);
    expect(result).toBe("ok");
  });

  it("retries retryable errors and then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw { status: 429 };
      return "ok";
    }, fast);
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry errors that are not retryable", async () => {
    let calls = 0;
    let caught: unknown = null;
    try {
      await withRetry(async () => {
        calls++;
        throw new Error("bad request");
      }, fast);
    } catch (err) {
      caught = err;
    }
    expect(caught instanceof Error).toBe(true);
    expect(calls).toBe(1);
  });

  it("gives up after maxRetries", async () => {
    let calls = 0;
    let caught: unknown = null;
    try {
      await withRetry(
        async () => {
          calls++;
          throw { status: 429 };
        },
        { maxRetries: 2, baseDelayMs: 1 }
      );
    } catch (err) {
      caught = err;
    }
    expect(caught !== null).toBe(true);
    expect(calls).toBe(3); // first try plus two retries
  });
});
