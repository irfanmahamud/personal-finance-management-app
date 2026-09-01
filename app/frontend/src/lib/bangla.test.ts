import { describe, expect, it } from 'vitest'
import { transliterate } from './bangla'

describe('transliterate', () => {
  it('converts the spec example', () => {
    expect(transliterate('bazar')).toBe('বাজার')
  })

  it('converts common words', () => {
    expect(transliterate('ami')).toBe('আমি')
    expect(transliterate('tumi')).toBe('তুমি')
  })

  it('leaves digits and punctuation untouched', () => {
    const result = transliterate('bazar 500 taka!')
    expect(result).toContain('500')
    expect(result).toContain('!')
    expect(result.startsWith('বাজার ')).toBe(true)
  })

  it('inserts a hasanta for a doubled consonant (conjunct)', () => {
    expect(transliterate('kkhoma')).toContain('ক্ষ')
  })

  it('is idempotent on already-Bangla text', () => {
    expect(transliterate('বাজার')).toBe('বাজার')
  })

  it('handles multiple words preserving spaces', () => {
    const result = transliterate('ami bazar jacchi')
    expect(result.split(' ')).toHaveLength(3)
    expect(result.startsWith('আমি ')).toBe(true)
  })
})
