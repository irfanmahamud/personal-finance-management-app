/**
 * Line icon set from the redesign mock — 24-unit viewBox, stroke-only,
 * currentColor, 1.7 stroke width. Chrome and actions use these; category
 * identity stays the user-editable emoji from the database (a fixed icon
 * set cannot cover user-created categories).
 */

import type { SVGProps } from 'react'

function base(props: SVGProps<SVGSVGElement>, size: number | undefined) {
  return {
    width: size ?? 17,
    height: size ?? 17,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    ...props,
  }
}

type P = SVGProps<SVGSVGElement> & { size?: number }

export const IconHome = ({ size, ...p }: P) => (
  <svg {...base(p, size)}>
    <path d="M3 10.5 12 3l9 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 9.5V20h13V9.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
)

export const IconLedger = ({ size, ...p }: P) => (
  <svg {...base(p, size)}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9.5 8h5M9.5 12h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

export const IconBudget = ({ size, ...p }: P) => (
  <svg {...base(p, size)}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
  </svg>
)

export const IconReports = ({ size, ...p }: P) => (
  <svg {...base(p, size)}>
    <path d="M4 20V11M10 20V5M16 20v-6M22 20H2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

export const IconSettings = ({ size, ...p }: P) => (
  <svg {...base(p, size)}>
    <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

export const IconEdit = ({ size, ...p }: P) => (
  <svg {...base(p, size ?? 14)}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
)

export const IconTrash = ({ size, ...p }: P) => (
  <svg {...base(p, size ?? 14)}>
    <path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconChevronLeft = ({ size, ...p }: P) => (
  <svg {...base(p, size ?? 13)}>
    <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconChevronRight = ({ size, ...p }: P) => (
  <svg {...base(p, size ?? 13)}>
    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconPlus = ({ size, ...p }: P) => (
  <svg {...base(p, size)}>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(p, size ?? 14)}>
    <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconAlert = ({ size, ...p }: P) => (
  <svg {...base(p, size ?? 14)}>
    <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
  </svg>
)

export const IconBell = ({ size, ...p }: P) => (
  <svg {...base(p, size)}>
    <path
      d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14.5 6 10.5Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path d="M10 19a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)
