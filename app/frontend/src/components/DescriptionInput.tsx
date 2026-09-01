import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { transliterate } from '../lib/bangla'
import { type Suggestion } from '../lib/queries'

/**
 * Description input with a suggestion dropdown drawn from the household's
 * own expense history. Typing filters client-side (suggestions were fetched
 * once); picking one fills the field and hands the caller its category so
 * the entry flow can preselect it.
 */
export default function DescriptionInput({
  value,
  onChange,
  onPickSuggestion,
  suggestions,
  placeholder,
  className = 'w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm',
}: {
  value: string
  onChange: (v: string) => void
  onPickSuggestion?: (s: Suggestion) => void
  suggestions: Suggestion[] | undefined
  placeholder: string
  className?: string
}) {
  const { i18n } = useTranslation()
  const bn = i18n.language === 'bn'
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    if (!suggestions?.length) return []
    const q = value.trim().toLowerCase()
    const pool = q
      ? suggestions.filter((s) => s.description.toLowerCase().includes(q))
      : suggestions
    // Exact current text is not a useful suggestion.
    return pool.filter((s) => s.description.toLowerCase() !== q).slice(0, 6)
  }, [suggestions, value])

  return (
    <div className="relative">
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={bn ? `${className} pr-9` : className}
      />
      {bn && value.trim() && /[A-Za-z]/.test(value) && (
        <button
          type="button"
          title="বাংলায় রূপান্তর করুন"
          // onMouseDown (not onClick) fires before the input's onBlur closes the suggestion list.
          onMouseDown={(e) => {
            e.preventDefault()
            onChange(transliterate(value))
          }}
          className="absolute inset-y-0 right-1.5 flex items-center px-1 text-sm text-neutral-400 hover:text-brand-700"
        >
          অআ
        </button>
      )}
      {open && matches.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
          {matches.map((s) => (
            <li key={s.description}>
              {/* onMouseDown fires before the input's blur closes the list */}
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(s.description)
                  onPickSuggestion?.(s)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-neutral-800 active:bg-brand-50"
              >
                <span className="truncate">{s.description}</span>
                <span className="ml-2 shrink-0 text-xs text-neutral-300">×{s.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
