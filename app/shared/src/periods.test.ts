import { describe, expect, it } from 'vitest'
import { monthPeriod, nextPeriod, previousPeriod } from './periods'

describe('monthPeriod', () => {
  it('defaults to a plain calendar month', () => {
    expect(monthPeriod('2026-08-30')).toEqual({ start: '2026-08-01', end: '2026-08-31' })
    expect(monthPeriod('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(monthPeriod('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' }) // leap
    expect(monthPeriod('2026-12-31')).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })

  it('matches the explicit monthStartDay=1 call', () => {
    expect(monthPeriod('2026-08-30')).toEqual(monthPeriod('2026-08-30', 1))
  })

  it('resolves a custom start day, before and after the boundary', () => {
    expect(monthPeriod('2026-08-24', 25)).toEqual({ start: '2026-07-25', end: '2026-08-24' })
    expect(monthPeriod('2026-08-25', 25)).toEqual({ start: '2026-08-25', end: '2026-09-24' })
  })

  it('handles the December -> January rollover', () => {
    expect(monthPeriod('2026-01-09', 10)).toEqual({ start: '2025-12-10', end: '2026-01-09' })
    expect(monthPeriod('2026-01-10', 10)).toEqual({ start: '2026-01-10', end: '2026-02-09' })
  })

  it('never touches the leap day for a start day capped at 28', () => {
    expect(monthPeriod('2028-02-27', 28)).toEqual({ start: '2028-01-28', end: '2028-02-27' })
    expect(monthPeriod('2028-02-28', 28)).toEqual({ start: '2028-02-28', end: '2028-03-27' })
  })
})

describe('nextPeriod', () => {
  it('advances a calendar month', () => {
    expect(nextPeriod('2026-08-01')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(nextPeriod('2026-12-01')).toEqual({ start: '2027-01-01', end: '2027-01-31' })
  })

  it('advances a custom period, including across a year boundary', () => {
    expect(nextPeriod('2026-08-25', 25)).toEqual(monthPeriod('2026-09-25', 25))
    expect(nextPeriod('2026-12-10', 10)).toEqual({ start: '2027-01-10', end: '2027-02-09' })
  })
})

describe('previousPeriod', () => {
  it('is the inverse of nextPeriod at the default start day', () => {
    const p = monthPeriod('2026-09-15')
    expect(previousPeriod(p.start)).toEqual(monthPeriod('2026-08-15'))
    expect(nextPeriod(previousPeriod(p.start).start)).toEqual(p)
  })

  it('goes back across a year boundary for a custom start day', () => {
    expect(previousPeriod('2027-01-10', 10)).toEqual({ start: '2026-12-10', end: '2027-01-09' })
  })

  it('is the inverse of nextPeriod for a custom start day', () => {
    expect(previousPeriod(nextPeriod('2026-08-25', 25).start, 25)).toEqual(
      monthPeriod('2026-08-25', 25),
    )
  })
})
