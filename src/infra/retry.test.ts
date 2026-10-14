import { describe, expect, it, vi } from "vitest";
import { resolveRetryConfig, retryAsync } from "./retry.js";

describe("resolveRetryConfig", () => {
  const defaults = { attempts: 4, minDelayMs: 20, maxDelayMs: 500, jitter: 0.25 };

  it.each([
    ["uses defaults when overrides are absent", undefined, defaults],
    [
      "rounds finite values and clamps jitter to its upper bound",
      { attempts: 2.6, minDelayMs: 7.4, maxDelayMs: 29.6, jitter: 1.4 },
      { attempts: 3, minDelayMs: 7, maxDelayMs: 30, jitter: 1 },
    ],
    [
      "keeps attempts positive and delay values non-negative",
      { attempts: 0, minDelayMs: -4, maxDelayMs: -2, jitter: -0.2 },
      { attempts: 1, minDelayMs: 0, maxDelayMs: 0, jitter: 0 },
    ],
    [
      "raises max delay to min delay when the overrides are reversed",
      { attempts: 3, minDelayMs: 50, maxDelayMs: 20, jitter: 0.5 },
      { attempts: 3, minDelayMs: 50, maxDelayMs: 50, jitter: 0.5 },
    ],
    [
      "falls back per field for non-finite overrides",
      {
        attempts: Number.NaN,
        minDelayMs: Number.POSITIVE_INFINITY,
        maxDelayMs: Number.NEGATIVE_INFINITY,
        jitter: Number.NaN,
      },
      defaults,
    ],
    [
      "preserves explicit values when other overrides are absent",
      { attempts: 2, maxDelayMs: 90 },
      { attempts: 2, minDelayMs: 20, maxDelayMs: 90, jitter: 0.25 },
    ],
    [
      "accepts finite boundary values",
      {
        attempts: Number.MAX_SAFE_INTEGER,
        minDelayMs: Number.MIN_VALUE,
        maxDelayMs: Number.MAX_VALUE,
        jitter: Number.MIN_VALUE,
      },
      {
        attempts: Number.MAX_SAFE_INTEGER,
        minDelayMs: 0,
        maxDelayMs: Number.MAX_VALUE,
        jitter: Number.MIN_VALUE,
      },
    ],
  ])("%s", (_case, overrides, expected) => {
    expect(resolveRetryConfig(defaults, overrides)).toEqual(expected);
  });
});

describe("retryAsync", () => {
  it.each([1, 2, 3])(
    "propagates the terminal error and reports only retries before the next attempt (%i attempts)",
    async (attempts) => {
      vi.useFakeTimers();

      try {
        const terminalError = new Error("terminal failure");
        const events: string[] = [];
        let calls = 0;
        const fn = vi.fn(async () => {
          calls += 1;
          events.push(`attempt:${calls}`);
          throw terminalError;
        });
        const onRetry = vi.fn(({ attempt }) => {
          events.push(`callback:${attempt}`);
        });

        const result = retryAsync(fn, {
          attempts,
          minDelayMs: 0,
          maxDelayMs: 0,
          jitter: 0,
          onRetry,
        });
        const terminalResult = result.then(
          () => undefined,
          (error: unknown) => error,
        );
        await vi.runAllTimersAsync();

        await expect(terminalResult).resolves.toBe(terminalError);
        expect(fn).toHaveBeenCalledTimes(attempts);
        expect(onRetry).toHaveBeenCalledTimes(attempts - 1);
        for (let attempt = 1; attempt < attempts; attempt += 1) {
          expect(onRetry).toHaveBeenNthCalledWith(
            attempt,
            expect.objectContaining({ attempt, maxAttempts: attempts, err: terminalError }),
          );
        }
        expect(events).toEqual(
          Array.from({ length: attempts }, (_, index) => {
            const attempt = index + 1;
            return attempt < attempts
              ? [`attempt:${attempt}`, `callback:${attempt}`]
              : [`attempt:${attempt}`];
          }).flat(),
        );
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("returns on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryAsync(fn, 3, 10);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail1")).mockResolvedValueOnce("ok");
    const result = await retryAsync(fn, 3, 1);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("propagates after exhausting retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(retryAsync(fn, 2, 1)).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stops when shouldRetry returns false", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(retryAsync(fn, { attempts: 3, shouldRetry: () => false })).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry before retrying", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const onRetry = vi.fn();
    const res = await retryAsync(fn, {
      attempts: 2,
      minDelayMs: 0,
      maxDelayMs: 0,
      onRetry,
    });
    expect(res).toBe("ok");
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, maxAttempts: 2 }));
  });

  it("clamps attempts to at least 1", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(retryAsync(fn, { attempts: 0, minDelayMs: 0, maxDelayMs: 0 })).rejects.toThrow(
      "boom",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses retryAfterMs when provided", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const delays: number[] = [];
    const promise = retryAsync(fn, {
      attempts: 2,
      minDelayMs: 0,
      maxDelayMs: 1000,
      jitter: 0,
      retryAfterMs: () => 500,
      onRetry: (info) => delays.push(info.delayMs),
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(delays[0]).toBe(500);
    vi.useRealTimers();
  });

  it("clamps retryAfterMs to maxDelayMs", async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const delays: number[] = [];
    const promise = retryAsync(fn, {
      attempts: 2,
      minDelayMs: 0,
      maxDelayMs: 100,
      jitter: 0,
      retryAfterMs: () => 500,
      onRetry: (info) => delays.push(info.delayMs),
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(delays[0]).toBe(100);
    vi.useRealTimers();
  });
});
