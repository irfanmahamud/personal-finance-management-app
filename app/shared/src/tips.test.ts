import { describe, expect, it } from 'vitest'
import { TIPS, tipsForContext } from './tips'

describe('tipsForContext', () => {
  it('returns only tips matching the given context', () => {
    const investmentTips = tipsForContext('investments')
    expect(investmentTips.length).toBeGreaterThan(0)
    expect(investmentTips.every((t) => t.context === 'investments')).toBe(true)
  })

  it('returns an empty array for a context with no tips', () => {
    expect(tipsForContext('category:Nonexistent')).toEqual([])
  })

  it('every tip has both languages filled in', () => {
    for (const tip of TIPS) {
      expect(tip.title_en.length).toBeGreaterThan(0)
      expect(tip.title_bn.length).toBeGreaterThan(0)
      expect(tip.body_en.length).toBeGreaterThan(0)
      expect(tip.body_bn.length).toBeGreaterThan(0)
    }
  })

  it('every tip id is unique', () => {
    const ids = TIPS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
