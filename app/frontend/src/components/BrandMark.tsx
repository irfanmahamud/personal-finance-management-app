/**
 * The "Open Hands" emblem — two hands cradling a coin — reconstructed as
 * flat SVG from the brand asset's exact bezier geometry. One source of
 * truth for the mark in-app; the PWA icons are rendered from the same
 * paths. Colors are brand-fixed (dark tile, amber hands, cream coin) and
 * deliberately outside the semantic UI palette.
 */

const TILE_FROM = '#332818'
const TILE_TO = '#201912'
const HANDS = '#e2a33b'
const COIN = '#f2ead8'

export default function BrandMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bm-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={TILE_FROM} />
          <stop offset="1" stopColor={TILE_TO} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#bm-tile)" />
      <circle cx="50" cy="42" r="8" fill={COIN} />
      <path
        d="M14 62 C22 74, 40 78, 50 66 M86 62 C78 74, 60 78, 50 66"
        stroke={HANDS}
        strokeWidth="6.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
