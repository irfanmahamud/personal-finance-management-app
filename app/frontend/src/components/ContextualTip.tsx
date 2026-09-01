import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { tipsForContext } from '../lib/tips'

function dismissedKey(context: string): string {
  return `tip-dismissed:${context}`
}

/**
 * One dismissible, non-blocking tip per screen per session (spec §3.11.1).
 * `context` is either "investments" / "tax" or "category:<name_en>".
 * Dismissal is remembered in sessionStorage only - no server-side read
 * tracking, per spec.
 */
export default function ContextualTip({ context }: { context: string }) {
  const { i18n } = useTranslation()
  const bn = i18n.language === 'bn'
  const candidates = tipsForContext(context)

  const [tipIndex] = useState(() => Math.floor(Math.random() * Math.max(1, candidates.length)))
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(dismissedKey(context)) === '1'
    } catch {
      return false
    }
  })

  if (candidates.length === 0 || dismissed) return null
  const tip = candidates[tipIndex % candidates.length]

  function dismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem(dismissedKey(context), '1')
    } catch {
      /* private-browsing sessionStorage denial - dismissal just won't persist */
    }
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
      <div className="flex-1">
        <p className="font-semibold">{bn ? tip.title_bn : tip.title_en}</p>
        <p className="mt-0.5 text-brand-700">{bn ? tip.body_bn : tip.body_en}</p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="shrink-0 text-sm leading-none text-brand-500"
      >
        ×
      </button>
    </div>
  )
}
