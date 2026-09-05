import { IconCheck } from './icons'

/** Brief success confirmation (save/update) - not an error, so the
 * "no toasts for errors" rule doesn't apply; still auto-dismissed by the
 * caller after a couple of seconds rather than left to pile up. */
export default function ConfirmationBanner({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
      <IconCheck /> {message}
    </p>
  )
}
