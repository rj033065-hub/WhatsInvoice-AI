/**
 * Lightweight in-memory rate limiter for route protection.
 * Simple, zero-dependency sliding window implementation.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit?: number;        // Max requests permitted
  windowMs?: number;     // Window duration in ms (e.g. 60,000 for 1 min)
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): { isAllowed: boolean; remaining: number; resetInMs: number } {
  const limit = options.limit || 30; // default 30 requests per minute
  const windowMs = options.windowMs || 60 * 1000;
  const now = Date.now();

  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { isAllowed: true, remaining: limit - 1, resetInMs: windowMs };
  }

  if (record.count >= limit) {
    return {
      isAllowed: false,
      remaining: 0,
      resetInMs: Math.max(0, record.resetTime - now),
    };
  }

  record.count += 1;
  return {
    isAllowed: true,
    remaining: limit - record.count,
    resetInMs: Math.max(0, record.resetTime - now),
  };
}
