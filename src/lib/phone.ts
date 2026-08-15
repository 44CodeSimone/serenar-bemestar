export function normalizeBrazilianPhone(value?: string | null): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  const normalized =
    digits.length === 10 || digits.length === 11
      ? `55${digits}`
      : digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
        ? digits
        : "";

  return /^55\d{10,11}$/.test(normalized) ? normalized : null;
}

export function sameBrazilianPhone(left?: string | null, right?: string | null): boolean {
  const normalizedLeft = normalizeBrazilianPhone(left);
  return Boolean(normalizedLeft && normalizedLeft === normalizeBrazilianPhone(right));
}
