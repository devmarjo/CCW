export function decimals(currency: string) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2; }
export function formatAmount(value: number, currency: string, locale = 'pt-BR') { const digits = decimals(currency); return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value); }
// Digit-based monetary mask: digits are minor units (e.g. 12345 -> 123,45).
export function parseAmount(input: string, currency: string) { const digits = input.replace(/\D/g, '').slice(0, 14); return Number(digits || 0) / 10 ** decimals(currency); }
