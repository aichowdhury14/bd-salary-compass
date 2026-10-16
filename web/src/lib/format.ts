const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Taka with South Asian digit grouping: ৳1,25,000 */
export function tk(value: number): string {
  return `৳${nf.format(Math.round(value))}`;
}

/** Compact taka: ৳48k, ৳1.25 lakh */
export function tkShort(value: number): string {
  if (Math.abs(value) >= 100_000) {
    const lakh = value / 100_000;
    return `৳${lakh.toFixed(lakh >= 10 ? 1 : 2).replace(/\.?0+$/, "")} lakh`;
  }
  return `৳${Math.round(value / 1000)}k`;
}

/** Thousands only, for tight labels: ৳102k */
export function tkK(value: number): string {
  return `৳${Math.round(value / 1000)}k`;
}

export function monthName(isoMonth: string): string {
  const [y, m] = isoMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function signedPct(value: number, digits = 0): string {
  const s = pct(value, digits);
  return value > 0 ? `+${s}` : s;
}

/** Round to a friendly salary step (nearest 500). */
export function roundSalary(value: number): number {
  return Math.round(value / 500) * 500;
}

export function parseAmount(text: string): number {
  const bn = "০১২৩৪৫৬৭৮৯";
  const ascii = text.replace(/[০-৯]/g, (d) => String(bn.indexOf(d)));
  const n = Number(ascii.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
