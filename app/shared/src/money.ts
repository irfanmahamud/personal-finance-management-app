/**
 * Money display formatting - and ONLY formatting.
 *
 * All monetary values cross the wire as integer poisha (1/100 taka).
 * All arithmetic happens server-side; this module never computes with
 * money beyond the poisha->taka division for display. This is the rule
 * that stops Python and TypeScript drifting into two different rounding
 * behaviours.
 */

export type Locale = 'en' | 'bn'

/** Bangladeshi digit grouping: 1,00,000 - en-IN gives the grouping with
 * Latin digits; bn-BD gives Bengali digits (১,০০,০০০). en-US is wrong here. */
const formatters: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }),
  bn: new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 2 }),
}

const wholeFormatters: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }),
  bn: new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 0 }),
}

/** Format poisha as a taka string, e.g. 10000000 -> "১,০০,০০০" / "1,00,000". */
export function formatTaka(poisha: number, locale: Locale = 'en'): string {
  const taka = poisha / 100
  const f = Number.isInteger(taka) ? wholeFormatters[locale] : formatters[locale]
  return f.format(taka)
}

/** Format with the currency sign: "৳1,00,000". */
export function formatTakaSigned(poisha: number, locale: Locale = 'en'): string {
  return `৳${formatTaka(poisha, locale)}`
}

/** Parse a user-typed taka amount (e.g. "1500" or "1500.50") into poisha.
 * Input parsing, not arithmetic: the string is the source of truth. */
export function parseTakaInput(input: string): number | null {
  const cleaned = input.replace(/[,\s৳]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  return parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, '0') || '0', 10)
}
