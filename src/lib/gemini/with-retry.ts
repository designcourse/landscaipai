/**
 * Retry helper for Gemini / Google Generative AI calls.
 *
 * Transient conditions are normal (503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED,
 * DEADLINE_EXCEEDED, network blips). Retrying with exponential backoff is
 * what Google recommends, and empirically clears the vast majority of these
 * errors without surfacing them to the user.
 *
 * Non-transient errors (400 INVALID_ARGUMENT, safety/content blocks, auth
 * failures) bail out immediately — no point re-asking the same question.
 */

export interface RetryOpts {
  attempts?: number;
  baseMs?: number;
  maxMs?: number;
  onRetry?: (err: unknown, attempt: number, nextDelayMs: number) => void;
}

const TRANSIENT_PATTERNS: RegExp[] = [
  /\b50[234]\b/, // 502, 503, 504
  /\b429\b/,
  /UNAVAILABLE/i,
  /DEADLINE_EXCEEDED/i,
  /RESOURCE_EXHAUSTED/i,
  /\bINTERNAL\b/,
  /Deadline expired/i,
  /socket hang up/i,
  /fetch failed/i,
  /ECONNRESET/,
  /ETIMEDOUT/,
  /EAI_AGAIN/,
];

export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  // Some SDK errors put the GCP code on the object itself.
  const code =
    (err as { code?: number | string; status?: string })?.code ??
    (err as { status?: string })?.status;
  if (typeof code === "number" && (code === 503 || code === 502 || code === 504 || code === 429)) {
    return true;
  }
  if (typeof code === "string" && /UNAVAILABLE|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED/i.test(code)) {
    return true;
  }
  return TRANSIENT_PATTERNS.some((p) => p.test(msg));
}

/**
 * Translate a Gemini error into a message safe to show the end user.
 * Preserves the full error as-is for logging; this is only for UX copy.
 */
export function friendlyGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (isTransientError(err)) {
    return "AI service is busy right now — please try again in a moment.";
  }
  if (/safety|blocked|harassment|violation|policy/i.test(raw)) {
    return "Your request was blocked by the AI's safety filters. Try rephrasing or selecting a different style.";
  }
  if (/invalid|malformed|INVALID_ARGUMENT/i.test(raw)) {
    return "The AI couldn't understand the request. Try a different prompt.";
  }
  // Strip noisy prefixes like "[503]" or "GoogleGenerativeAI Error: "
  return raw
    .replace(/^\[\d+\]\s*/, "")
    .replace(/^GoogleGenerativeAI\s*Error:\s*/i, "");
}

export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseMs = opts.baseMs ?? 1000;
  const maxMs = opts.maxMs ?? 8000;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      if (!isTransientError(err)) break;
      const backoff = Math.min(baseMs * 2 ** i, maxMs);
      const jitter = Math.random() * backoff * 0.25;
      const delay = backoff + jitter;
      opts.onRetry?.(err, i + 1, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
