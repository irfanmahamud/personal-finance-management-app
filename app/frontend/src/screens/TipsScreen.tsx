import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TIPS } from '../lib/tips'

/** Tip library (spec §3.11.1): all curated tips, browsable and searchable,
 * both languages. Static content - no fetch, no read tracking. */
export default function TipsScreen({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const bn = i18n.language === 'bn'
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return TIPS
    return TIPS.filter((tip) => {
      const haystack = bn
        ? `${tip.title_bn} ${tip.body_bn}`
        : `${tip.title_en} ${tip.body_en}`
      return haystack.toLowerCase().includes(q)
    })
  }, [query, bn])

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <button onClick={onBack} className="text-sm text-neutral-500">
        ← {t('settings.title')}
      </button>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('tips.title')}</h1>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('tips.search')}
        className="mt-3 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
      />

      {filtered.length === 0 && (
        <p className="mt-4 text-sm text-neutral-400">{t('tips.noResults')}</p>
      )}

      <ul className="mt-4 space-y-2">
        {filtered.map((tip) => (
          <li key={tip.id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-sm font-semibold text-neutral-900">
              {bn ? tip.title_bn : tip.title_en}
            </p>
            <p className="mt-1 text-xs text-neutral-500">{bn ? tip.body_bn : tip.body_en}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
