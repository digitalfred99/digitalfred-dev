import { createHash, randomBytes } from "node:crypto";

/** 256-bit URL-safe random token. Only its SHA-256 hash is stored; the raw value is shown once. */
export const generateToken = () => randomBytes(32).toString("base64url");
export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");
export const looksLikeToken = (raw: unknown): raw is string => typeof raw === "string" && /^[A-Za-z0-9_-]{43}$/.test(raw);

/** Simple fixed-window limiter (per server instance). Good enough as a first line of defence. */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= max;
}
