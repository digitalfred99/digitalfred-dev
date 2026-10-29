import { createHash } from "node:crypto";

/** Deterministic JSON: object keys sorted, undefined dropped. Same content => same string => same hash. */
export function canonicalize(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      return Object.keys(v as object).sort().reduce<Record<string, unknown>>((acc, k) => {
        const x = (v as Record<string, unknown>)[k];
        if (x !== undefined) acc[k] = walk(x);
        return acc;
      }, {});
    }
    if (v instanceof Date) return v.toISOString();
    return v;
  };
  return JSON.stringify(walk(value));
}

export const contentHash = (value: unknown) => createHash("sha256").update(canonicalize(value)).digest("hex");

export type VersionBump = "minor" | "major";

/** First publish is 1.0. Minor = clarification/small revision (1.1). Major = scope or commercial revision (2.0). */
export function nextVersion(latest: { major: number; minor: number } | null, bump: VersionBump = "minor") {
  if (!latest) return { major: 1, minor: 0, label: "1.0" };
  const major = bump === "major" ? latest.major + 1 : latest.major;
  const minor = bump === "major" ? 0 : latest.minor + 1;
  return { major, minor, label: `${major}.${minor}` };
}
