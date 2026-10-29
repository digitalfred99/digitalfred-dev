const MONEY_PATTERN = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/;

export function parseMoneyInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!MONEY_PATTERN.test(raw)) throw new Error("Enter an amount with up to two decimal places.");
  const normalized = raw.replace(/,/g, "");
  const [whole = "0", fraction = ""] = normalized.split(".");
  const minor = BigInt(whole || "0") * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount is too large.");
  return Number(minor);
}

export function formatMoney(amountMinor: number | null | undefined, currency = "GHS"): string {
  if (amountMinor == null) return "Awaiting confirmation";
  const amount = BigInt(Math.trunc(amountMinor));
  const negative = amount < BigInt(0);
  const absolute = negative ? -amount : amount;
  const whole = absolute / BigInt(100);
  const fraction = String(absolute % BigInt(100)).padStart(2, "0");
  const parts = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(whole);
  let replacedFraction = false;
  const formatted = parts.map((part) => {
    if (part.type === "fraction") {
      replacedFraction = true;
      return fraction;
    }
    if (part.type === "minusSign") return "";
    return part.value;
  }).join("");
  return `${negative ? "-" : ""}${replacedFraction ? formatted : `${currency} ${negative ? "-" : ""}${whole}.${fraction}`}`;
}

export function Money({ amountMinor, currency = "GHS", className = "" }: {
  amountMinor: number | null | undefined;
  currency?: string;
  className?: string;
}) {
  return <span className={`font-mono tabular-nums ${className}`}>{formatMoney(amountMinor, currency)}</span>;
}
