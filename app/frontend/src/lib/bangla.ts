/**
 * Simplified Avro-style phonetic transliteration, English -> Bangla script
 * (spec §5.2, Phase 2: "bazar" -> "বাজার"). This is a compact subset of the
 * full Avro ruleset - common consonants, vowels, and a generic doubled-
 * consonant conjunct rule (e.g. "kk" -> ক্ক via hasanta) - not a byte-exact
 * clone. Words needing dictionary-level exceptions (silent letters,
 * uncommon conjuncts) will transliterate close but not always canonical.
 * Unrecognized characters (digits, punctuation, already-Bangla text) pass
 * through unchanged.
 */

type Rule = readonly [string, string]

// Longest phonetic key first so e.g. "chh" matches before "ch" before "c".
const CONSONANTS: Rule[] = [
  ['kkh', 'ক্ষ'], ['ksh', 'ক্ষ'], ['gg', 'জ্ঞ'],
  ['kh', 'খ'], ['gh', 'ঘ'], ['ng', 'ং'],
  ['chh', 'ছ'], ['ch', 'চ'], ['jh', 'ঝ'],
  ['Th', 'ঠ'], ['Dh', 'ঢ'], ['th', 'থ'], ['dh', 'ধ'],
  ['ph', 'ফ'], ['bh', 'ভ'], ['Sh', 'ষ'], ['sh', 'শ'],
  ['rh', 'ঢ়'],
  ['k', 'ক'], ['g', 'গ'], ['c', 'চ'], ['j', 'জ'],
  ['T', 'ট'], ['D', 'ড'], ['N', 'ণ'],
  ['t', 'ত'], ['d', 'দ'], ['n', 'ন'],
  ['p', 'প'], ['f', 'ফ'], ['b', 'ব'], ['v', 'ভ'],
  ['m', 'ম'], ['z', 'জ'], ['r', 'র'], ['R', 'ড়'],
  ['l', 'ল'], ['S', 'শ'], ['s', 'স'], ['h', 'হ'],
  ['y', 'য়'], ['w', 'ও'],
] as const

const VOWELS: Rule[] = [
  ['oi', 'ঐ'], ['ou', 'ঔ'], ['rri', 'ঋ'],
  ['ee', 'ঈ'], ['oo', 'ঊ'],
  ['a', 'আ'], ['i', 'ই'], ['u', 'উ'], ['e', 'এ'], ['o', 'ও'],
] as const

// Matra (vowel sign) attached to a preceding consonant. 'o' is the
// consonant's inherent vowel in Bangla, so it renders as nothing extra.
const MATRAS: Record<string, string> = {
  oi: 'ৈ', ou: 'ৌ', rri: 'ৃ', ee: 'ী', oo: 'ূ',
  a: 'া', i: 'ি', u: 'ু', e: 'ে', o: '',
}

const HASANTA = '্'

function matchLongest(word: string, i: number, rules: Rule[]): Rule | null {
  for (const rule of rules) {
    if (word.startsWith(rule[0], i)) return rule
  }
  return null
}

function transliterateWord(word: string): string {
  let out = ''
  let i = 0
  let lastWasConsonant = false
  while (i < word.length) {
    const vowel = matchLongest(word, i, VOWELS)
    if (vowel) {
      const [key, standalone] = vowel
      out += lastWasConsonant ? MATRAS[key] : standalone
      i += key.length
      lastWasConsonant = false
      continue
    }
    const consonant = matchLongest(word, i, CONSONANTS)
    if (consonant) {
      const [key, letter] = consonant
      if (lastWasConsonant) out += HASANTA
      out += letter
      i += key.length
      lastWasConsonant = true
      continue
    }
    out += word[i]
    i += 1
    lastWasConsonant = false
  }
  return out
}

/** Transliterates each run of Latin letters in `text`; everything else
 * (spaces, digits, punctuation, existing Bangla script) passes through. */
export function transliterate(text: string): string {
  return text.replace(/[A-Za-z]+/g, transliterateWord)
}
