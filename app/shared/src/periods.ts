/**
 * Budget period math - a direct TS port of the backend's
 * services/periods.py::month_period/next_period, kept in lockstep with it
 * (see that file's own tests for the source-of-truth cases). Needed on the
 * client wherever a period's date_from/date_to must be known BEFORE a
 * network call goes out (e.g. filtering the expense ledger), rather than
 * trusting a backend-resolved period_start/period_end - most screens can
 * do the latter and don't need this at all.
 *
 * Pure integer arithmetic on parsed "YYYY-MM-DD" strings - deliberately
 * never touches `Date`/`toISOString()`, which carry local-timezone/UTC
 * pitfalls for date-only values (a landmine already called out elsewhere
 * in this codebase). No platform primitives, fits this package's rules.
 */

export interface Period {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

function parseISODate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return days[month - 1]
}

/** (year, month) shifted by `delta` calendar months (either direction). */
function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const total = year * 12 + (month - 1) + delta
  const newYear = Math.floor(total / 12)
  const newMonth = (((total % 12) + 12) % 12) + 1
  return [newYear, newMonth]
}

function dayBefore(iso: string): string {
  const { year, month, day } = parseISODate(iso)
  if (day > 1) return toISODate(year, month, day - 1)
  const [prevYear, prevMonth] = shiftMonth(year, month, -1)
  return toISODate(prevYear, prevMonth, daysInMonth(prevYear, prevMonth))
}

/** The custom-boundary period containing `day`: monthStartDay of one
 * calendar month to monthStartDay - 1 of the next. Capped at 1-28 by
 * callers (the Settings field), so every value is a valid day in every
 * calendar month, in every year - no clamping needed. With
 * monthStartDay=1 this is identical to a plain calendar month. */
export function monthPeriod(day: string, monthStartDay = 1): Period {
  const { year, month, day: d } = parseISODate(day)
  const [startYear, startMonth] =
    d >= monthStartDay ? [year, month] : shiftMonth(year, month, -1)
  const start = toISODate(startYear, startMonth, monthStartDay)
  const [endYear, endMonth] = shiftMonth(startYear, startMonth, 1)
  const end = dayBefore(toISODate(endYear, endMonth, monthStartDay))
  return { start, end }
}

export function nextPeriod(periodStart: string, monthStartDay = 1): Period {
  const { year, month } = parseISODate(periodStart)
  const [endYear, endMonth] = shiftMonth(year, month, 1)
  return monthPeriod(toISODate(endYear, endMonth, monthStartDay), monthStartDay)
}

/** The period immediately before the one starting at `periodStart` - the
 * day before a period's start is always the last day of the prior period,
 * so feeding that day back through monthPeriod resolves it directly. */
export function previousPeriod(periodStart: string, monthStartDay = 1): Period {
  return monthPeriod(dayBefore(periodStart), monthStartDay)
}
