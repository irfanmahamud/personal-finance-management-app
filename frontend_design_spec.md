# Frontend Design Specification
## Personal Finance App — UI/UX Design System

**Version:** 1.1 (redesign) | **Date:** August 2026
**Scope:** Frontend only (`app/frontend`). Complements `finance_app_spec_v1.1.md` (product) — this document says how the interface looks, moves, and scales.
**Status:** Codifies the Phase 1 implementation and sets the rules every future screen must follow.
**v1.1:** Adopts the "Family Ledger" redesign mockups — desktop shell (header + sidebar + entry rail), SVG line-icon chrome, bordered cards, the Open Hands brand emblem, and the budget-impact preview.

---

## 0. Brand

The **Open Hands emblem** — two hands cradling a coin on a dark tile — is the product mark. It is defined once as vector geometry (`src/components/BrandMark.tsx`; hands `M14 62 C22 74, 40 78, 50 66` + mirror, coin at 50,42 r8 in a 100-unit viewBox) and every rendering derives from it: app headers, login, PIN gate, `public/favicon.svg`, and the PWA icons (rendered from the same paths).

| Brand color | Hex | Role |
|---|---|---|
| Tile | `#332818 → #201912` gradient | emblem background only |
| Hands | `#e2a33b` | emblem stroke only |
| Coin | `#f2ead8` | emblem fill only |

Brand colors are deliberately **outside** the semantic UI palette (§3) — they identify, they never signal. Do not reuse the amber hands color for warnings or the tile brown anywhere in the UI. The product name ("Hishabi") appears only as a locale string (`app.name`) — never in an identifier (CLAUDE.md invariant #9).

---

## 1. Design Principles

Ranked. When two conflict, the higher one wins.

1. **Five seconds or it failed.** Logging an expense is the app's only frequent action. Every design decision is judged against: does it slow down entry? A stale ledger makes every other screen worthless.
2. **One thumb, one hand.** The app is used on a phone, often while holding a child or standing in a bazar. Every primary action sits in the bottom 60% of the screen. Nothing critical lives in a top corner.
3. **Trust through legibility.** This is the family's money. Numbers are never truncated, never ambiguous, never mis-grouped. A user should be able to screenshot any screen and read it as a statement.
4. **Progressive disclosure.** The default view of every screen is the simple one. Power (full entry form, calculation breakdown, archived categories) is one tap away, behind a fold, never in the way.
5. **Visible state, always.** The user must always know: am I online? did that save? is this number final? Ambiguity about whether money was recorded is the worst UX failure the app can have.
6. **Bilingual by construction, not translation.** Bangla is a first-class script, not a retrofit. Layouts are designed for the longer of the two renderings.

---

## 2. Layout System

### 2.1 Canvas

| Rule | Value |
|---|---|
| Content column | `max-w-lg` (32rem / 512px), centered |
| Page padding | `p-4` (16px) on mobile; the column cap handles wide screens |
| Bottom clearance | `pb-20` on all scrollable content — nothing hides behind the nav bar |
| Background | `bg-neutral-50` page, `bg-white` cards |

One content column per screen on mobile. **v1.1 adds one sanctioned desktop layout** (from the mock's "User panel layout"): at `lg+` the shell becomes header (56px) + sidebar (220px) + main, with a persistent 400px **"Log an expense" rail** on Home and Expenses. Screen components stay single-column inside `main` (`lg:max-w-2xl`); the shell provides the columns, screens never do. Any further multi-column idea still revisits this section first.

### 2.2 Fixed chrome (z-index map)

| Layer | Element | Position | z |
|---|---|---|---|
| Header | Top app bar (emblem + name + language) | sticky top, mobile 48px / desktop 56px | default |
| Nav | Bottom tab bar (mobile) / sidebar (desktop) | `fixed inset-x-0 bottom-0` / grid column | default |
| Action | FAB (mobile only — the desktop rail replaces it) | `fixed bottom-20 right-4`, 56×56px | 40 |
| Status | Pending-sync: amber top banner (mobile) / amber sidebar pill (desktop) | | 40 |
| Modal | Quick-add bottom sheet + scrim (mobile only) | `fixed inset-0` | 50 |

The FAB sits above the nav bar's clearance, right side. The sheet always outranks everything.

### 2.3 Spacing scale

Tailwind defaults only: `1 / 2 / 3 / 4 / 6 / 8` (4–32px). Section gaps `mt-4`/`mt-6`; intra-card gaps `space-y-1.5`–`space-y-3`. No arbitrary pixel values (`mt-[13px]` is a review flag).

---

## 3. Color

### 3.1 Palette (Tailwind names — never raw hex in components)

| Role | Token | Usage |
|---|---|---|
| Primary / positive | `emerald-600` (bg), `emerald-700` (text), `emerald-50` (active tint) | Actions, saves, surplus, active nav/tiles, inline-edit panel bg |
| Page | `neutral-50` | App background |
| Surface | `white` + `border-neutral-200` + `shadow-sm` + `rounded-xl` | Every card (v1.1: cards gained the border) |
| Text | `neutral-900` primary · `neutral-500` secondary · `neutral-400` hints | |
| Warning | `amber-500`/`amber-700`/`amber-50` | 75% budget warnings, unverified-tax banner, set-aside, pending sync |
| Danger | `red-500`/`red-600`/`red-50` | 95% warnings, overspend, deficit, delete |
| Info | `sky-700` | Refund position, neutral notices |

### 3.2 Semantic rules

- **Green = good, amber = caution, red = act now.** Never decoratively. A red number always means over-limit or negative; an amber surface always means attention needed.
- Budget health thresholds are fixed app-wide: `< 75%` emerald · `75–95%` amber · `≥ 95%` red. Screens must not invent their own cutoffs.
- Money amounts are `neutral-900` by default; colored only when the color carries meaning (negative remaining = red, surplus = emerald).
- Charts use the fixed 13-color `PALETTE` in `ReportsScreen` — category *i* keeps its color within a view. Do not introduce a second chart palette.

### 3.3 Contrast

All text/background pairs must meet WCAG AA (4.5:1 body, 3:1 large text). The pairs above pass; check any new pair before use. Never place white text on `amber-500` for body copy — use `amber-800` on `amber-50` instead.

---

## 4. Typography

### 4.1 Scale

| Role | Classes | Where |
|---|---|---|
| Hero number | `text-4xl font-bold` | Dashboard "remaining" — the largest thing on any screen |
| Screen title | `text-xl font-bold` | One per screen, top |
| Card stat | `text-2xl font-semibold` | Today's total, amount input |
| Body / rows | `text-sm` | Lists, forms, most content |
| Meta / hints | `text-xs text-neutral-400` | Timestamps, counts, section labels |
| Section label | `text-xs font-medium uppercase tracking-wide text-neutral-400` | List group headers |

Six sizes, no more. If a design wants a seventh, pick the nearest existing one.

### 4.2 Bangla text

- Font stack: system default (`font-sans`) renders Bengali via Noto Sans Bengali on Android — adequate for Phase 1. If a custom Latin font is ever added, it **must** ship with a paired Bengali face; a Latin-only font silently degrades half the UI.
- Bengali script runs ~10–20% taller and often longer than its English equivalent. Buttons and rows are sized against the **Bangla** rendering: min-height comes from padding (`py-2`+), never fixed heights that clip conjunct characters.
- Line height: never below `leading-normal` for Bangla-visible text — tight leading clips vowel signs (কার) above and below the baseline.

### 4.3 Numbers and money — hard rules

- All amounts render via `formatTaka` / `formatTakaSigned` from `src/lib/money.ts`. **Never `toLocaleString()` directly, never string interpolation of raw numbers.**
- Grouping is Bangladeshi in both languages: `৳1,00,000` (Latin digits, `en`) / `৳১,০০,০০০` (Bengali digits, `bn`). `100,000` appearing anywhere is a bug (DoD #5).
- The `৳` sign precedes the amount, no space.
- Amounts never wrap or truncate. In a tight row, the *label* truncates (`truncate` on the label span, `shrink-0` on the amount) — never the money.
- Dates: `DD/MM/YYYY` ordering via `en-GB`/`bn-BD` locale formatting. Never `MM/DD`.

---

## 5. Navigation & Information Architecture

```
5 destinations, two chromes for one nav model:
  mobile  = bottom tab bar          desktop = left sidebar (220px)
├── Home       dashboard + entry rail (desktop)
├── Expenses   ledger + entry rail (desktop)
├── Budget     current month lines + progress, create from template
├── Reports    month navigator, summary, donut, variance, CSV
└── Settings   language, fiscal year → sub-screens: Categories, Income & Tax

Global: mobile FAB → quick-add sheet · pending-sync (banner / sidebar pill)
```

**Icons (v1.1):** chrome and actions use the SVG line-icon set in `src/components/icons.tsx` (24-unit viewBox, `currentColor`, 1.7 stroke — from the mock). **Category identity stays the user-editable emoji from the database**, shown inside 32px `bg-neutral-100 rounded-lg` icon tiles — a fixed icon set cannot cover user-created categories, and the emoji remains the language-neutral recognition anchor.

Rules:

- **Five tabs, never more.** New top-level features become Settings sub-screens or live inside an existing tab. (Phase 2's members/goals will claim space inside existing tabs before anyone adds a sixth.)
- Sub-screens show a `← parent` text link top-left and no bottom-nav highlight change.
- Active nav: mobile tab `font-semibold text-emerald-700`; desktop sidebar item `bg-emerald-50 font-semibold text-emerald-700`. Inactive: `text-neutral-500`. Icon + label always together — icon-only nav fails the "guessable by a new user" bar.
- Tab state is in-memory (Zustand-adjacent local state). Deep links are a non-goal until TanStack Router is actually needed; don't add routing ceremony for five tabs.

---

## 6. Screen Specifications

### 6.1 Home (Dashboard)

Vertical order — most important number first:

1. **Remaining this month** — `text-4xl font-bold`; red when negative. The label above it, small and quiet.
2. Spent X of Y — one `text-sm` line.
3. **Health bar** — 8px tall, full-width, rounded, semantic color by the fixed thresholds.
4. **Today card** — white card, today's spend total.
5. **Alerts** — up to 3 category warnings, each a tinted row (`amber-50`/`red-50`), sorted by severity. Absent entirely when everything is green — no empty "all good" card.
6. *(Phase 3+ slots — AI insight, net-worth — render nothing until built. No placeholders, per product spec §3.1.)*

No budget yet → single quiet line pointing at the Budget tab. Never a full-screen blocking prompt.

### 6.2 Expense entry — one panel, two modes

`ExpenseEntryPanel` is shared between the mobile sheet and the desktop rail so they never drift:

- **Mobile (instant-save):** bottom sheet over a `black/40` scrim. **Tapping a category IS the save** — the 5-second rule (principle #1) outranks the mock's explicit button.
- **Desktop (rail):** persistent right rail on Home/Expenses. Select a category, review the **budget impact card**, press "Log expense". A mouse flow can afford the extra confirm, and it buys the live preview.

**Budget impact card (desktop):** for the selected category's parent budget line — spent so far, monthly limit, a bar showing current fill plus a **hatched projected segment** for the amount being typed, "X% used → Y% after this", and a tinted status notice ("৳300 over the limit — still fine to log"). Presentation-only math over server-provided figures; it embodies warn-never-block (§3.3.3).

Shared anatomy, top to bottom:

1. Title row + **Repeat last** shortcut (only when a last entry exists).
2. **Amount** — ৳-prefixed field on a `neutral-100` well, `inputMode="decimal"`, `text-3xl font-bold tabular-nums`; autofocused on mobile.
3. **Category grid** — 3 columns of icon tiles (emoji in a 32px `neutral-100` tile + label), top 9 mobile / 6 desktop, ranked by time-of-day usage; a picked description suggestion bumps its category to the front with an emerald ring. Selected tile (desktop): `border-emerald-600 bg-emerald-50 text-emerald-700`. Mobile grid dims until the amount parses.
4. **For chips** — Household + member chips (from `/members`); row hides when no members exist. Selected chip: solid emerald.
5. **Date chips** — Today (default) · Yesterday · date picker.
6. **Note** — `DescriptionInput` with history suggestions.

Mobile total: open → type amount → tap category = saved. Anything added must not push the category grid below the fold on a 640px-tall viewport.

### 6.3 Expenses (ledger)

- **Month navigator** (‹ Month YYYY ›, bordered pill) top-right; the list is the selected month.
- **Stat tiles** — Budgeted / Spent / Remaining, current month only (remaining emerald, red when negative).
- Grouped by day; group header = uppercase localized date left, **day total** right.
- Row (52px min): 32px emoji icon tile · category + description (truncating) · **For chip** (Household/member) · amount (`tabular-nums`, never truncating) · edit/delete icon buttons — always visible on touch, hover-revealed on desktop (hover is enhancement: the buttons exist either way).
- Edit is inline row replacement on an **`emerald-50` panel**: amount, date, description (with suggestions), member chips, Cancel/Save. No modal.
- Delete confirms via native `confirm()`. Empty state: one centered quiet sentence.

### 6.4 Budget

- No budget for the month → creation view: template picker (2-col grid of buttons) + total-amount input + one Create button.
- With budget → summary card (spent / of / remaining), then one card per line: icon + name · `spent / limit` (tap to edit amount inline) · 6px progress bar in semantic color · rollover checkbox with carried amount when > 0.
- Editing a line amount happens in place; the tap target is the amount text itself.

### 6.5 Reports

- Month navigator: `← 2026-08 →` chips, top-right of the title row.
- Three stat tiles (Income / Expenses / Surplus-or-Deficit) in one row — on the narrowest screens they stay 3-across (`grid-cols-3`); the numbers are short enough.
- Donut (Recharts, fixed palette, inner radius — the hole keeps it light) + legend list with per-category amount and entry count.
- Variance list: white card rows, `spent / budgeted`, red when over.
- CSV export: full-width secondary button at the bottom.

### 6.6 Income & Tax

- **UNVERIFIED banner first** — amber card above everything whenever `verified=false` comes back. It is not dismissible. This is a trust feature, not a nag.
- Sources: card per source with name, type tag, amount; taxable / TDS-at-source checkboxes inline.
- Add-source form appears in place of the dashed add button (as everywhere).
- Walkthrough card: Gross → − withheld → − deductions → **Net take-home** (bold emerald), then conditionally: amber **set aside monthly**, sky **refund position**.
- Full calculation breakdown behind a `<details>` disclosure — visible on demand, never forced on the user.

### 6.7 Settings, Categories

- Settings: pill toggles for language and fiscal year (selected = emerald fill), then sub-screen links styled as full-width white buttons, then sign-out (small, red, last).
- Categories: card per parent with icon + both names (active language bold, other language as a quiet hint beside it); subs indented under a left border; rename/archive inline; archived rows at 50% opacity behind a "show archived" toggle.

---

## 7. Component Inventory

Reuse these; do not restyle ad hoc. New variants go here first.

| Component | Recipe | Used in |
|---|---|---|
| **Brand mark** | `BrandMark` — Open Hands emblem SVG, size prop | headers, login, PIN, PWA icons |
| **Card** | `rounded-xl border border-neutral-200 bg-white p-3/p-4 shadow-sm` | everywhere |
| **Stat tile** | card + uppercase `11.5px` label + `text-xl font-bold tabular-nums` value | ledger, reports |
| **Icon tile** | `h-8 w-8 rounded-lg bg-neutral-100` wrapping the category emoji | ledger rows, entry grid |
| **Entry panel** | `ExpenseEntryPanel` — instantSave (mobile sheet) / button+impact (desktop rail) | shell |
| **Impact card** | spent/limit rows + fill bar + hatched projection + tinted notice | entry panel (desktop) |
| **Primary button** | `rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40/50` — full-width in forms | save/create/sign-in |
| **Secondary button** | `rounded-xl border border-neutral-300 bg-white py-3 text-sm font-medium` | CSV export, sub-screen links |
| **Chip / pill** | `rounded-full border px-3.5 py-1.5 text-xs font-medium` — selected `border-emerald-600 bg-emerald-600 text-white`, else `border-neutral-200 bg-white text-neutral-500` | dates, members, methods, templates |
| **Dashed add button** | `w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm text-neutral-500` — swaps in place for its form | add category/source/deduction |
| **Text input** | `rounded-xl border border-neutral-300 px-4 py-3` (forms) / `rounded border px-2-3 py-1-2 text-sm` (inline) | |
| **Progress bar** | `h-1.5/h-2 rounded-full bg-neutral-100/200` + semantic-color fill div, width % | budget, health |
| **Tinted notice** | `rounded-xl px-4 py-3 text-sm` on `amber-50`/`red-50`/`sky-50` + matching `-800` text | alerts, banners |
| **Inline edit row** | row content swaps for inputs + ✓/cancel; no modal | expenses, budget lines |
| **FAB** | `h-14 w-14 rounded-full bg-emerald-600 text-3xl text-white shadow-lg` | global |
| **Bottom sheet** | scrim `bg-black/40` + `mt-auto max-h-[92vh] rounded-t-2xl bg-white overflow-y-auto` | quick-add (the pattern for any future sheet) |
| **Suggestion combobox** | `DescriptionInput` — input + absolute dropdown card, ≤6 client-filtered matches with `×count`, `onMouseDown` selection (beats blur) | quick-add, ledger edit row |

**Management rule:** a visual pattern used on a third screen gets extracted into `src/components/` with props, and this table gets a row. Until then, copy the recipe exactly — divergence is the thing this table exists to prevent.

---

## 8. Interaction & Motion

- **Touch targets ≥ 44×44px** for anything a thumb hits in a hurry (nav tabs, FAB, category grid, chips). Inline meta-actions (rename/archive/✕) may be smaller since they're deliberate, two-handed actions.
- **Feedback within 100ms** of every tap: `active:` state (`active:bg-emerald-100` on category tiles, `active:bg-emerald-700` on the FAB), disabled state while a mutation is pending (`disabled={isPending}`).
- **Motion is functional only.** The bottom sheet slides, progress bars fill; nothing else animates. No page transitions, no skeleton shimmer, no springs. This app is opened 10× a day — animation delight on day 1 is friction on day 40.
- **No hover-dependent affordances.** Everything must be discoverable and operable by touch alone; `hover:` styles are progressive enhancement for desktop, never the only cue.
- Optimistic feel comes from TanStack Query invalidation, not optimistic writes — with the offline queue in play, honest "saved/queued" states beat pretend-instant ones.

---

## 9. States — every screen must define all five

| State | Treatment |
|---|---|
| **Loading** | Quiet `text-sm text-neutral-400` "Loading…" line. No spinners, no skeletons — local API, sub-100ms typical. |
| **Empty** | One centered, friendly sentence (localized). No illustrations, no CTAs shouting. |
| **Error** | `text-sm text-red-600` inline near the action that failed, with the server's message when it's human-readable. Never a toast that disappears before it's read. |
| **Offline / queued** | The amber top banner (`⏳ N waiting to sync`) is the single global truth; tapping it retries the drain. Individual screens don't invent their own offline UI. |
| **Unverified data** | Amber non-dismissible banner (tax figures). Any future estimated/unverified number follows the same pattern. |

---

## 10. Responsive Behavior

The single-column, phone-first layout means "responsive" reduces to a short checklist:

- **Design width: 360px** (mid-range Android). Everything must work there without horizontal scroll — `min-w-0` + `truncate` on flexible text, `shrink-0` on amounts and action clusters.
- **Column cap `max-w-lg`** centers the app on anything wider. Desktop is a big phone; that's a feature.
- **Vertical budget:** the quick-add sheet's amount + dates + 9-tile grid must fit within `92vh` on a 640px viewport with the keyboard up. New sheet content goes below the grid, behind the fold.
- **Safe areas:** the PWA runs standalone; fixed bottom chrome should gain `env(safe-area-inset-bottom)` padding when notched-device testing shows clipping (accepted Phase 1 gap).
- Text wraps rather than scales — no viewport-relative font sizes, no `text-[10px]` escape hatches.
- Landscape is untested and unsupported; nothing should *break*, but no design effort goes there.

---

## 11. Bilingual Rendering Rules

- Every user-visible string goes through `t()` with keys in `src/locales/{en,bn}.json`. A hardcoded UI string is a defect, including error fallbacks and aria-labels.
- The two files must stay key-identical — a key added to one is added to both in the same commit.
- Category and payment-method names come from the database in **both** languages (`name_en`/`name_bn`); the UI shows the active language, with the other as a quiet secondary where it aids recognition (Categories screen pattern).
- Language switching is instant client-side (`i18n.changeLanguage`) and persisted server-side (`PATCH /settings`) — both, always, in that order.
- Emoji icons (category, nav, payment) are language-neutral by design — they're the recognition anchor when the user switches scripts.
- Test every new screen in **Bangla first**: it's the longer rendering and breaks layouts English hides.

---

## 12. Accessibility Checklist (per screen)

- [ ] All interactive elements are real `<button>`/`<input>`/`<a>` — no clickable `div`s.
- [ ] Form inputs have placeholders **and** programmatic labels or `aria-label`s (localized).
- [ ] Color is never the only signal — over-budget rows pair red with the numeric `spent / limit`; status bars sit next to their numbers.
- [ ] Focus is visible (don't strip outlines) and the amount field autofocuses in the sheet.
- [ ] `inputMode` set on every numeric field (`decimal` for money, `numeric` for PIN).
- [ ] Contrast AA-checked for any new color pair (§3.3).
- [ ] Screen-reader pass is a stated Phase 2 hardening item, not silently skipped.

---

## 13. Performance Budget

- **First load < 3s on mid-range Android over 3G-ish:** current bundle ~292KB JS (~90KB gzip) — acceptable; alarm threshold is 150KB gzip, at which point split Recharts (the heaviest dependency) behind a lazy Reports route.
- Precache via the service worker makes repeat opens instant — repeat open is the number that matters for the 5-second rule.
- No images anywhere in the UI (emoji + SVG charts only). Keep it that way; the receipt photos of Phase 2 are user content, lazy-loaded.
- Every added dependency answers: does this earn its bytes on a budget phone? (This is why there's no component library, no animation library, and no icon font.)

---

## 14. File & Change Management

```
src/
  components/   shared, reused-on-3+-screens pieces (AppShell, QuickAdd, gates)
  screens/      one file per screen, self-contained
  lib/          money.ts (all formatting), api-client.ts, offline-queue.ts, queries.ts (all hooks)
  locales/      en.json + bn.json, key-identical
  stores/       auth.ts (Zustand) — UI state only, server data lives in TanStack Query
```

- **Server state = TanStack Query hooks in `lib/queries.ts`** (one file until it hurts). **UI state = component state or Zustand.** Never mirror server data into a store.
- Styling is Tailwind utilities in JSX. No CSS files beyond `index.css`, no CSS-in-JS, no `@apply` component classes — the component inventory (§7) is the abstraction layer.
- A new screen = one file in `screens/`, wired into `AppShell`'s tab switch, strings in both locale files, all five §9 states handled. That's the definition of done for UI work.
- This document is updated in the same PR as any change that contradicts it.

---

## 15. Anti-patterns — reject on sight

- A modal where an inline edit or bottom sheet would do.
- A spinner over content that loads in <200ms.
- Toasts for errors (they vanish; errors must persist until acted on).
- A sixth bottom-nav tab.
- `100,000`-style grouping, `$`-style sign placement, or a wrapped/truncated amount.
- Hardcoded UI strings, or an English-only new feature "to be translated later".
- Placeholder cards for unbuilt features (spec §3.1 forbids them explicitly).
- Raw hex colors, arbitrary Tailwind values, or a second shade of green.
- Brand colors (emblem amber/brown/cream) used as UI signals — they identify, never signal (§0).
- Anything that adds a tap to the amount → category → saved path.
