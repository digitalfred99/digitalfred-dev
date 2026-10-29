// Money is always stored and calculated as INTEGER MINOR UNITS (pesewas, cents).
// No floating point is ever used for amounts.

export type CurrencyCode = string;

const CURRENCY_RE = /^[A-Z]{3}$/;
export const isCurrencyCode = (v: unknown): v is CurrencyCode =>
  typeof v === "string" && CURRENCY_RE.test(v);

/** Number of minor-unit digits for a currency (GHS=2, JPY=0, KWD=3). */
export function minorDigits(currency: CurrencyCode): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** "1234.56" -> 123456. Rejects non-numeric input and too many decimals. */
export function parseMajorToMinor(input: string | number, currency: CurrencyCode): number {
  const digits = minorDigits(currency);
  const s = String(input).trim().replace(/,/g, "");
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error("Invalid money amount");
  const frac = m[2] ?? "";
  if (frac.length > digits) throw new Error(`Too many decimal places for ${currency}`);
  const minor = BigInt(m[1] + frac.padEnd(digits, "0"));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount too large");
  return Number(minor);
}

/** Display only. Never feed the result back into a calculation. */
export function formatMoney(
  minor: number | null | undefined,
  currency: CurrencyCode,
  locale = "en-GH"
): string {
  if (minor === null || minor === undefined) return "Awaiting confirmation";
  const digits = minorDigits(currency);
  const sign = minor < 0 ? "-" : "";
  const abs = BigInt(Math.abs(minor));
  const scale = BigInt(10) ** BigInt(digits);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(digits, "0");
  const wholeStr = new Intl.NumberFormat(locale).format(whole);
  return `${sign}${currency} ${wholeStr}${digits ? "." + frac : ""}`;
}

/** Integer division rounded half-up for non-negative integers. */
export function divRound(n: number, d: number): number {
  if (d <= 0) throw new Error("Divisor must be positive");
  return Number((BigInt(n) * BigInt(2) + BigInt(d)) / (BigInt(d) * BigInt(2)));
}

/** amount * basisPoints / 10_000, floored, via BigInt so large amounts never overflow. */
export function percentOfBps(amountMinor: number, bps: number): number {
  return Number((BigInt(amountMinor) * BigInt(bps)) / BigInt(10000));
}

export const isMinor = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
