// Simple in-memory rate limiter. Good enough for a private 2-person app.
// For a public deployment, replace with Redis-backed sliding window.

interface Bucket {
  count: number
  reset: number
}

const store = new Map<string, Bucket>()

// Clean up expired buckets every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of store.entries()) {
    if (v.reset < now) store.delete(k)
  }
}, 300_000)

export function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowMs = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || bucket.reset < now) {
    store.set(key, { count: 1, reset: now + windowMs })
    return { allowed: true, remaining: maxAttempts - 1 }
  }

  if (bucket.count >= maxAttempts) {
    return { allowed: false, remaining: 0 }
  }

  bucket.count++
  return { allowed: true, remaining: maxAttempts - bucket.count }
}
