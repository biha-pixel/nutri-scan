/**
 * Rate Limiter Utility
 *
 * Implements sliding-window rate limiting to prevent API abuse.
 * Uses in-memory storage with automatic cleanup.
 *
 * Configuration via environment variables:
 * - RATE_LIMIT_ANALYZE_FOOD_PER_MINUTE=30
 * - RATE_LIMIT_NUTRITION_LOOKUP_PER_MINUTE=60
 */

interface RateLimitEntry {
  timestamps: number[];
  createdAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remaining?: number;
  limit?: number;
}

/**
 * In-memory rate limiter with sliding window algorithm
 * Keys are "${endpoint}:${ip}"
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Get rate limit config for an endpoint
 */
function getRateLimitConfig(endpoint: string): number | null {
  const configKey = `RATE_LIMIT_${endpoint.toUpperCase()}_PER_MINUTE`;
  const limit = process.env[configKey];
  return limit ? parseInt(limit, 10) : null;
}

/**
 * Clean up old entries (older than 2 minutes)
 */
function cleanupOldEntries(): void {
  const now = Date.now();
  const maxAge = 2 * 60 * 1000; // 2 minutes

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.createdAt > maxAge) {
      rateLimitStore.delete(key);
    } else {
      // Remove old timestamps from the sliding window
      entry.timestamps = entry.timestamps.filter(ts => now - ts < 60000);
      if (entry.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }
}

/**
 * Check if a request should be rate limited
 * Returns { allowed: true/false, retryAfter?: seconds }
 */
export function checkRateLimit(
  ip: string,
  endpoint: string
): RateLimitResult {
  const limit = getRateLimitConfig(endpoint);

  // If no limit configured, allow all requests
  if (!limit) {
    return { allowed: true };
  }

  // Clean up old entries periodically (every 100 calls)
  if (Math.random() < 0.01) {
    cleanupOldEntries();
  }

  const key = `${endpoint}:${ip}`;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  let entry = rateLimitStore.get(key);

  if (!entry) {
    // First request from this IP for this endpoint
    entry = {
      timestamps: [now],
      createdAt: now,
    };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
    };
  }

  // Remove timestamps outside the 1-minute window
  entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

  if (entry.timestamps.length < limit) {
    // Within limit, record this request
    entry.timestamps.push(now);
    return {
      allowed: true,
      remaining: limit - entry.timestamps.length,
      limit,
    };
  }

  // Limit exceeded
  const oldestTimestamp = entry.timestamps[0];
  const retryAfterMs = oldestTimestamp + 60000 - now;
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

  return {
    allowed: false,
    retryAfter: retryAfterSeconds,
    remaining: 0,
    limit,
  };
}

/**
 * Reset rate limit for a specific IP/endpoint (for testing or admin operations)
 */
export function resetRateLimit(ip: string, endpoint: string): void {
  const key = `${endpoint}:${ip}`;
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit stats for debugging
 */
export function getRateLimitStats(ip: string, endpoint: string): RateLimitEntry | null {
  const key = `${endpoint}:${ip}`;
  return rateLimitStore.get(key) ?? null;
}
