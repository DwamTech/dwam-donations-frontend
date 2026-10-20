/** Matches DonationProjectService::minor, including its two-decimal fallback. */
export function currencyPrecision(currency: string): number {
  return ({ JPY: 0, KWD: 3, BHD: 3 } as Record<string, number>)[currency] ?? 2;
}
export function formatMoney(minor: number | string, currency: string): string {
  if (typeof minor === "number" && !Number.isSafeInteger(minor)) throw new Error("Unsafe monetary integer");
  const amount = BigInt(minor);
  const precision = currencyPrecision(currency);
  const scale = BigInt(10 ** precision);
  const magnitude = amount < BigInt(0) ? -amount : amount;
  const formatter = new Intl.NumberFormat("ar-EG", {
    style: "currency", currency, minimumFractionDigits: precision, maximumFractionDigits: precision,
  });
  const digits = new Intl.NumberFormat("ar-EG", { useGrouping: false, minimumIntegerDigits: Math.max(1, precision) });
  const formatted = formatter.formatToParts(magnitude / scale).map(part =>
    part.type === "fraction" ? digits.format(magnitude % scale) : part.value).join("");
  return amount < BigInt(0) ? `−${formatted}` : formatted;
}
