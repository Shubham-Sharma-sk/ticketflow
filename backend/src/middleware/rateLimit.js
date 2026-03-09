const buckets = new Map();

export function createRateLimiter({ windowMs, max, keyFn }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : req.ip;
    const entry = buckets.get(key);

    if (!entry || entry.expiresAt <= now) {
      buckets.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      return res.status(429).json({
        message: "Too many requests. Please try again later.",
      });
    }

    entry.count += 1;
    return next();
  };
}
