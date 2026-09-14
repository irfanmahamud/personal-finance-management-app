import { describe, expect, it } from 'vitest'
import { formatTaka, formatTakaSigned, parseTakaInput } from './money'

describe('formatTaka', () => {
  it('uses Bangladeshi grouping, not Western', () => {
    // 1 lakh = 1,00,000 - en-US would render 100,000 which is a DoD failure
    expect(formatTaka(100_000_00, 'en')).toBe('1,00,000')
    expect(formatTaka(1_00_00_000_00, 'en')).toBe('1,00,00,000') // 1 crore
  })

  it('renders Bengali digits for bn', () => {
    expect(formatTaka(100_000_00, 'bn')).toBe('১,০০,০০০')
  })

  it('shows fractions only when non-integer taka', () => {
    expect(formatTaka(1500_50, 'en')).toBe('1,500.5')
    expect(formatTaka(1500_00, 'en')).toBe('1,500')
  })

  it('prefixes the taka sign', () => {
    expect(formatTakaSigned(50_000_00, 'en')).toBe('৳50,000')
  })
})

describe('parseTakaInput', () => {
  it('parses whole taka to poisha', () => {
    expect(parseTakaInput('500')).toBe(50_000)
    expect(parseTakaInput('1,500')).toBe(150_000)
  })
  it('parses decimals exactly, no float drift', () => {
    expect(parseTakaInput('19.99')).toBe(1_999)
    expect(parseTakaInput('0.1')).toBe(10)
  })
  it('rejects garbage', () => {
    expect(parseTakaInput('abc')).toBeNull()
    expect(parseTakaInput('1.999')).toBeNull()
    expect(parseTakaInput('')).toBeNull()
    expect(parseTakaInput('-5')).toBeNull()
  })
  it('tolerates the currency sign and spaces', () => {
    expect(parseTakaInput('৳ 1,200')).toBe(120_000)
  })
})
