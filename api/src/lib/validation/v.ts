// Tiny dependency-free validators. Every one throws ValidationError with a field path.
export class ValidationError extends Error {
  constructor(message: string, public field?: string) { super(message); }
}
const bad = (field: string, msg: string): never => { throw new ValidationError(`${field}: ${msg}`, field); };

export const obj = (v: unknown, f = "body"): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : bad(f, "must be an object");

export function str(v: unknown, f: string, o: { min?: number; max?: number; optional?: boolean; trim?: boolean } = {}): string {
  if (v === undefined || v === null || v === "") {
    if (o.optional) return "";
    return bad(f, "is required");
  }
  if (typeof v !== "string") return bad(f, "must be text");
  const s = o.trim === false ? v : v.trim();
  if (o.min && s.length < o.min) bad(f, `must be at least ${o.min} characters`);
  if (s.length > (o.max ?? 10000)) bad(f, `must be at most ${o.max ?? 10000} characters`);
  return s;
}
export const optStr = (v: unknown, f: string, max = 10000): string | null =>
  v === undefined || v === null || v === "" ? null : str(v, f, { max });

export function oneOf<T extends string>(v: unknown, f: string, allowed: readonly T[]): T {
  if (typeof v !== "string" || !allowed.includes(v as T)) return bad(f, `must be one of: ${allowed.join(", ")}`);
  return v as T;
}
export function int(v: unknown, f: string, o: { min?: number; max?: number } = {}): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v)) return bad(f, "must be a whole number");
  if (o.min !== undefined && v < o.min) bad(f, `must be ≥ ${o.min}`);
  if (o.max !== undefined && v > o.max) bad(f, `must be ≤ ${o.max}`);
  return v;
}
export const minorOrNull = (v: unknown, f: string): number | null => (v === null || v === undefined ? null : int(v, f, { min: 0 }));
export const bool = (v: unknown, f: string, d = false): boolean => (v === undefined ? d : typeof v === "boolean" ? v : bad(f, "must be true or false"));
export function strArray(v: unknown, f: string, o: { max?: number; itemMax?: number } = {}): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) return bad(f, "must be a list");
  if (v.length > (o.max ?? 200)) bad(f, "has too many items");
  return v.map((x, i) => str(x, `${f}[${i}]`, { max: o.itemMax ?? 2000 })).filter(Boolean);
}
export const isoDate = (v: unknown, f: string): string | null => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return bad(f, "must be a date (YYYY-MM-DD)");
  return v;
};
export const uuid = (v: unknown, f = "id"): string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : bad(f, "must be a valid id");
export const email = (v: unknown, f = "email", optional = false): string => {
  const s = str(v, f, { optional, max: 255 });
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) bad(f, "must be a valid email address");
  return s;
};
