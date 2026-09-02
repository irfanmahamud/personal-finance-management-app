# CLAUDE.md

Household finance & budget app for a Bangladeshi family (Phase 1 complete).
Spec: `finance_app_spec_v1.1.md` is authoritative; v1.0 is superseded.
Frontend UI/UX rules: `frontend_design_spec.md` — follow it for any UI work.
Implementation plan history: `~/.claude/plans/let-s-see-the-implementation-peaceful-taco.md`.

## Layout

```
app/backend/    FastAPI + SQLAlchemy 2.0 async + Alembic — Python 3.11, uv
  server/       the importable package (NOT `app/` — avoids colliding with the app/ dir)
    core/       config (pydantic-settings), deps, security, errors
    db/         models, session, seed, queries/ (raw SQL for reports)
    schemas/    Pydantic request/response models
    services/   business logic — framework-free, takes (db, household_id)
    api/v1/routers/
  tests/        pytest + httpx.ASGITransport against finance_test DB
app/frontend/   Vite + React + TS PWA — npm
  src/lib/      api-client.ts, offline-queue.ts, money.ts (the load-bearing modules)
  src/api/generated.ts   openapi-typescript output — NEVER hand-edit
  e2e/          Playwright (needs: sudo npx playwright install-deps chromium)
docker-compose.yml   Postgres 17 only; apps run natively
.env             secrets + seed credentials (gitignored); .env.example is the template
```

## Run / test

`make start` = db (healthy) → migrate → backend + frontend in parallel.
`make start-backend` = the same without the frontend. `make backend`/`make frontend`
run one dev server (assume Postgres is up).
Also: `make seed | test | test-backend | test-frontend | gen-api | build | stop`.
Manually:

```bash
docker compose up -d
cd app/backend && uv run alembic upgrade head && uv run python -m server.db.seed
uv run uvicorn server.main:app --reload --port 8000
cd app/frontend && npm run dev        # :5173, proxies /api and /health to :8000
```

- Backend tests: `cd app/backend && uv run pytest` (needs the `finance_test` DB:
  `docker compose exec db psql -U finance -d finance -c "CREATE DATABASE finance_test OWNER finance;"`)
- Frontend tests: `cd app/frontend && npm test`
- E2E: `npm run test:e2e` (backend must be running, seeded)
- Seed script reads `SEED_*` from the environment — `set -a && source ../../.env && set +a` first when running it manually.
- After changing any Pydantic schema: `cd app/frontend && npm run gen:api` (backend running) and commit the regenerated file.
- `BACKEND_PORT` in `.env` (default 8000) flows through make -> uvicorn, the Vite
  proxy, and `gen:api`. Changing it needs no code edits.
- Production single-artifact mode: `STATIC_DIR=$(realpath ../frontend/dist)` makes FastAPI serve the built SPA; `COOKIE_SECURE=true` behind TLS.

## Invariants — do not break these

1. **Money is integer poisha (1/100 taka) everywhere** — Python `int`, `BigInteger` columns, JSON number, TS `number`. Never `Numeric`/`Float`/float. All arithmetic server-side; `src/lib/money.ts` formats only.
2. **`household_id` comes from the JWT (`user.household_id` via `get_current_user`), never from a request body or query param.** Every table carries it even though one household exists — that's the productization path (spec §2.2). `POST /auth/signup` is the one place a new household is *created*; it still never accepts a client-supplied `household_id` — the new row's id becomes the JWT's `household_id` server-side.
3. **`POST /api/v1/expenses` is idempotent on `client_uuid`** (`ON CONFLICT DO NOTHING`, UNIQUE column) — the offline queue's replay contract. 201 = created, 200 = replay. Every new write endpoint the queue may carry needs the same shape.
4. **Offline queue rules** (`src/lib/offline-queue.ts`): never store the Authorization header with a queued request; refresh the access token BEFORE draining; a repeated 401 stops the drain with entries kept — queued writes are never discarded. Do NOT switch to Workbox Background Sync (it replays stale auth headers).
5. **Access token lives in memory only** (never localStorage); the refresh token is an httpOnly cookie path-scoped to `/api/v1/auth`, rotated on every refresh, sha256-hashed at rest.
6. **Nothing tax-related is hardcoded** — slabs/thresholds/rebates live in the versioned `tax_config` table. The current row is `verified=false` (spec §13 Q1 pending); the UI shows an UNVERIFIED banner off that flag. Verified NBR figures = a row update, not a code change.
7. **No family member names or amounts anywhere in source** (DoD #8) — identity comes from `.env` via the seed script. `grep -riE "safeer|yousha|nuyera|adib|mim|ammu" app/` must stay clean.
8. **Number grouping is Bangladeshi**: `Intl.NumberFormat('en-IN')` → `1,00,000`; `'bn-BD'` → `১,০০,০০০`. `en-US` grouping is a DoD failure.
9. **The product name is undecided** — no package, module, DB, env var, or class named after "Hishabi". Role-based names only (`server/`, `finance` DB).
10. **Soft budget warnings only (75%/95%), never a hard block** — users route around blocks by not logging (spec §3.3.3).

## Conventions

- Routers are thin (<~15 lines/endpoint): inject deps, validate, call a service, return `response_model`. Services never touch `Request`/cookies/headers. Service errors come from `server/core/errors.py` (`NotFoundError`, `ConflictError`, `DomainValidationError`, `AuthError`) — never raise `HTTPException` in routers.
- Cross-household access returns 404 (indistinguishable from absent), not 403.
- Reporting aggregates are hand-written SQL via `text()` in `server/db/queries/` — not ORM composition. Parent-category rollup: `COALESCE(c.parent_id, c.id)`.
- Category tree is two levels max (enforced in the service). Per-member medical is a filter on Health by member, NOT a separate category (v1.0's parallel tree double-counted).
- `logged_by_user_id` (who entered) and `for_member_id` (who it was for) are different questions — keep both.
- Migrations: `uv run alembic revision --autogenerate -m "..."` then review — adding NOT NULL columns to populated tables needs `server_default`.
- i18n: every user-facing string goes through `t()` with keys in `src/locales/{en,bn}.json`. All screens must work in both languages (DoD #5).
- Template allocations are basis points (10_000 = 100%) in `server/services/budgets.py::TEMPLATES`.
- Test emails must use real-looking domains (`@example.com`) — `email-validator` rejects `.local`.
- Theme accent color is `brand-*` (a custom Tailwind v4 scale in `src/index.css` `@theme`, ramped from the Open Hands emblem's gold `#e2a33b` — same source as `BrandMark.tsx`/`public/favicon.svg`), not a stock Tailwind color. Use `brand-*`, never reintroduce `emerald-*`, for any new accent/CTA styling.

## Phase discipline

Phase 1 is done. Phase 2 (spec §9) was built incrementally, working through
the spec's Phase 2 list one item at a time (per explicit instruction to
proceed without re-asking each time). It is now functionally complete
except Google Sheets sync (see below). Phase 3 has since started on a
narrow, explicitly-authorized slice (see below), and **Phase 4 has also
started on an explicitly-authorized slice** (user picked which Phase 4
items to build and which to skip — see the Phase 4 section further
below) — do NOT build further into either phase without the same kind of
explicit go-ahead. Phase 2 built so far:
- Recurring expenses & bills/reminders: `recurring_rule` table,
  `server/services/recurring.py`, `/api/v1/recurring`, `RecurringScreen.tsx`,
  the "Bills due" card on the dashboard.
- Family members: full CRUD on the `member` table (`server/services/members.py`,
  `/api/v1/members` POST/PATCH), `FamilyScreen.tsx` (Settings → Family members)
  with per-member monthly spend/expense list (`GET /expenses?member_id=`) and
  allowance tracking. Age-derived suggestions stay Phase 3 (needs the AI layer).
- Savings goals: `goal` + `goal_contribution` tables, `server/services/savings.py`,
  `/api/v1/savings/goals` (+ `/contributions`, `/allocation-suggestion`),
  `SavingsScreen.tsx` (Settings → Savings goals). Deterministic forecast
  (§3.7.2 Phase 2 tier: projected completion from actual avg. monthly
  contribution) and funding-priority allocation suggestion (this month's
  income − spend so far, split top-down by goal priority, user confirms
  each). Auto-contribution link to the budget's Savings & Investment
  category is NOT built — contributions are logged manually for now.
  Milestone events (25/50/75/100%) surface as a UI badge only, no push
  notification (matches the recurring-bills precedent: in-app, not push).
- Investments: single flexible `investment` table across DPS/FDR/Sanchayapatra/
  pension/provident fund/business/mutual-fund-gold (spec §3.7A.1 — DSE stocks
  stay Phase 4, no price source). `server/services/investments.py`,
  `/api/v1/investments` (+ `/portfolio`), `InvestmentsScreen.tsx` (Settings →
  Investments). Built: maturity status (overdue/renewal_due ≤7d/
  maturity_soon ≤30d, spec's own thresholds), a deterministic simple-interest
  projected-maturity estimate, portfolio overview (by-type totals + next 3
  maturities), and **automatic tax-rebate linkage** — a `rebate_eligible`
  investment's principal now feeds `eligible_investment` in
  `services/income.py::tax_estimate` automatically (one entry, both the
  holding and the rebate, per spec). Contribution schedules (spec
  §3.7A.2) are now built too: `recurring_rule` gained a nullable
  `investment_id` FK — a DPS/pension/PF row can carry a monthly recurring
  contribution reminder rather than duplicating the due-date/status/mark-
  paid machinery. Marking that occurrence paid still logs an `Expense`
  (as any recurring rule does) AND accumulates the paid amount into
  `Investment.current_value` (`services/recurring.py::mark_paid` —
  `current_value = (current_value or 0) + amount_paid`, initializing from
  0 the first time), so the investment's tracked value stays current
  without a second manual entry. `RecurringScreen.tsx`'s add form gained
  an optional "link to investment" picker; a linked rule shows a
  "Contributes to ⟨name⟩" tag. A global `NotificationBell` (bell icon in
  `AppShell`'s header, both mobile and desktop — not just the dashboard's
  own "Bills due" card) surfaces any active recurring rule (bill or
  investment-linked) due within 2 days, with an inline mark-paid button —
  its own threshold, deliberately separate from `RecurringScreen`'s
  3-day `due_soon` badge. The `zakatable` flag now feeds the Zakat
  calculator (built later — see the Zakat bullet below).
- Debt manager: `debt` + `debt_payment` tables, `server/services/debts.py`,
  `/api/v1/debts` (+ `/emi-calculator`, `/payoff-comparison`,
  `/{id}/payments`), `DebtsScreen.tsx` (Settings → Debts). Built: standard
  EMI formula + full amortization schedule (also exposed standalone as a
  calculator, no debt needs to be saved to use it), interest-vs-principal
  split per payment (computed from the balance *then* outstanding, so a
  later rate edit never rewrites past payments — same principle as
  investment rate history), actual-history payoff projection, and an
  avalanche-vs-snowball simulation across all active debts for a given
  extra-monthly amount.
- Net worth: `asset` + `net_worth_snapshot` tables, `server/services/networth.py`,
  `/api/v1/networth/current` (+ `/history`, `/assets` CRUD), `NetWorthScreen.tsx`
  (Settings → Net worth). Assets (cash/bank, property, vehicle, gold/jewelry,
  other) are manual point-in-time entries; investments and liabilities are
  pulled live from the investment/debt tables rather than duplicated — every
  figure entered exactly once. `GET /networth/current` upserts THIS month's
  snapshot as a side effect (one row per household per month, unique-
  constrained) — viewing the screen at least once a month is what builds the
  line-chart history, no cron. Revaluing an asset (PATCH with a new `value`)
  stamps `logged_by_user_id` + `valued_on` fresh, satisfying spec's "records
  who said what and when" — but it overwrites, it does not version, so there
  is no full valuation audit trail, only the current state.
- Tips (§3.11.1 only — Blog is §3.11.2, Phase 5, productization-gated, NOT
  built): a static bilingual bundle at `src/lib/tips.ts` (no backend, no DB,
  no CMS — updating a tip is a data change + redeploy, per spec). `<ContextualTip
  context="...">` shows one dismissible, non-blocking tip per screen per
  session (sessionStorage only, no server-side read tracking) — wired into
  `InvestmentsScreen` (context `"investments"`), `IncomeScreen` near the tax
  estimate (context `"tax"`), and `BudgetScreen` (context
  `"category:<name_en>"`, picking the first budget line with a matching
  tip). `TipsScreen.tsx` (Settings → Tips) is the full searchable library.
- 50/30/20 & zero-based budgeting (§3.3.3): `Category.need_want_save`
  (`need`/`want`/`save`, top-level only) is now exposed via
  `PATCH /categories/{id}` and tagged from `CategoriesScreen.tsx`.
  `POST /budgets` accepts `template: "50_30_20"` (auto-splits 50/30/20
  across tagged categories; 422 if none are tagged yet) or an
  `assignable_amount` alongside explicit `lines` for zero-based (method
  becomes `zero_based`; `BudgetOut.unassigned_amount` is the "every taka
  assigned" surface, shown live on `BudgetView` and during creation).
  Envelope method is NOT built (spec explicitly defers it: "pick one after
  using both" zero-based). Hard-block-on-overspend is NOT built — CLAUDE.md
  invariant #10 rules it out entirely, not just default-off.
- Weekly/per-member ledger views + yearly comparison + PDF export (§3.6):
  `ExpensesScreen.tsx` gained a day/week group-by toggle (client-side,
  Monday-start week buckets) and a member filter chip row (client-side,
  including a "Household" filter for `for_member_id IS NULL` which the
  `member_id` query param can't express). `GET /reports/yearly` returns
  12 months (fiscal-year-start-aligned) of income/spent/surplus —
  `ReportsScreen.tsx` renders it as a bar chart. PDF export is
  `window.print()` against a `#printable-report` container with dedicated
  `@media print` CSS in `index.css` (no client PDF library added) — covers
  the monthly summary + yearly chart, not the ledger list itself.
- Receipt photo upload, storage only, no OCR (spec §3.4 Files note):
  `receipt` table (Postgres `bytea` — no S3/Supabase bucket to provision
  for a dev setup), `POST/GET/DELETE /api/v1/receipts`, JPEG/PNG/WEBP only,
  8MB cap. `expense.receipt_id` is now a real FK (was reserved-but-untyped
  before). Attach/replace/view lives in `ExpensesScreen.tsx`'s edit row —
  deliberately NOT in `ExpenseEntryPanel`'s quick-add flow, to protect the
  5-second rule.
- Zakat calculator + Ramadan/Eid mode (spec §5.3): `zakat_config` table
  (global, versioned like `tax_config` — nisab tracks the market gold/
  silver price, which this app has no live feed for, so it's a household-
  editable figure starting UNVERIFIED, seeded with a placeholder). `GET
  /zakat/estimate` sums cash/bank + gold/jewelry `Asset` rows (by category,
  not a per-asset flag) plus `Investment.zakatable`-flagged holdings, minus
  active `Debt.current_balance` — every figure pulled live, nothing entered
  twice. `ZakatScreen.tsx` (Settings → Zakat calculator). Eid/Ramadan mode
  is a plain `household.eid_mode_enabled` toggle (Settings) that shows a
  static seasonal banner on `HomeScreen` — NOT calendar-computed (no Hijri
  date source in the stack), no automatic budget changes.
- Bangla transliteration input (spec §5.2): `src/lib/bangla.ts` is a
  simplified Avro-style phonetic engine (English keystrokes -> Bangla
  script, e.g. "bazar" -> "বাজার") — a compact subset of the full Avro
  ruleset (common consonants/vowels + a generic doubled-consonant hasanta
  rule), not a byte-exact clone; uncommon conjuncts may not match canonical
  spelling. Manual "অআ" convert-on-click button (not live-as-you-type, to
  avoid cursor-jump complexity) wired into `DescriptionInput` (expense
  descriptions) and `CategoriesScreen`'s add-category form (name_bn, from
  the typed name_en). No native-keyboard input is unaffected — this only
  helps when a household member prefers typing phonetically.
- Editable income sources + percentage-based Provident Fund (spec §3.7A.1's
  "employee + employer contributions ... one entry, both views"): income
  sources now support a full edit (name/type/amount/frequency), not just
  the taxable/tds/active toggles. `Deduction.amount` is nullable —
  a deduction is either a flat monthly `amount` OR a `percentage_bps` of a
  linked `income_source_id`, computed live on every read
  (`server/services/income.py::_deduction_to_out`) rather than stored and
  synced, so an income source's amount changing (e.g. a raise) is reflected
  immediately with no stale duplicate. `provident_fund` deductions can also
  carry an `employer_match_bps`; the resulting `employer_amount` is
  surfaced separately (`DeductionOut.employer_amount`,
  `TaxEstimateOut.provident_fund_employer_monthly`) and is never subtracted
  from take-home — it's additional savings, not a cost, shown as such on
  `IncomeScreen.tsx`. Deliberately NOT built: an auto-synced `Investment`
  row of type `provident_fund` mirroring the deduction (would duplicate the
  same figure and risk drift — same "compute live, don't duplicate" call as
  Net Worth pulling Investment/Debt live instead of copying them);
  contribution-schedule automation into `recurring_rule` remains unbuilt
  too (noted under Investments above).

Phase 2 is functionally complete except **Google Sheets sync**, blocked on
the user's Google Cloud OAuth client ID/secret (ask before starting; do
not fabricate credentials) — and envelope budgeting, which the spec itself
defers ("pick one after using both" zero-based), not just unbuilt.

**Phase 3 (§4 AI Financial Advisor) has started, deterministic-tier only.**
The spec gates Phase 3 on ≥6 months of real logged data and most of §4
needs an LLM (NL query 4.1, insight rows 6-8, planning 4.3) — none of that
is built. What *is* built, because spec §4.2 explicitly calls it
"deterministic rules over SQL, not model output" with zero external
dependency: the **Insights Engine, rows 1-5 only** —
`server/services/insights.py`, `GET /api/v1/insights`. Overspend (existing
budget-line status + days left in period), day-of-week spending pattern
(trailing 3 months, Postgres `EXTRACT(DOW)` convention), category anomaly
(this month vs. trailing 6-month average, ≥2× triggers), savings
opportunity (largest `need_want_save='want'` category, suggests a 20% cut
annualized), and goal projection (reuses `SavingsScreen`'s own
`projected_completion_date` math). The backend returns typed numbers only
— no server-phrased strings — and the frontend composes bilingual messages
via i18n interpolation, same pattern as every other numeric surface in the
app. Rendered on `ReportsScreen.tsx`, **deliberately not HomeScreen** (see
the dashboard rule below) — every insight type degrades to nothing when
there isn't enough history yet, same graceful-degradation philosophy as
the Phase 2 deterministic forecasts.

**Spending-trend charts** (dashboard + Reports, not spec-numbered but
explicitly requested): `GET /reports/timeseries?granularity=day|week|month`
(Postgres `date_trunc`, validated against that fixed set server-side, not
passed through as free text) with an optional custom `date_from`/`date_to`
range; `SpendingTrendChart.tsx` renders it with a day/week/month toggle
(compact variant on `HomeScreen`, full variant with a custom-range picker
on `ReportsScreen`). This is a plain data chart, not an AI/insight
surface, so it doesn't trip the dashboard rule below.

**Income-vs-spent uses net take-home, not gross** (dashboard + Reports,
current month only): `reports/monthly`'s `income` field stays gross
(§ unchanged, still `SUM(income_source.amount_bdt)` monthlyized — no
per-month tax history exists to do otherwise). `HomeScreen.tsx` and
`ReportsScreen.tsx` instead prefer `tax/estimate`'s `monthly_net`
(already nets out TDS + deductions) as the basis for the surplus/deficit
figure shown to the user, falling back to the gross `report.income` when
there's no usable tax estimate (no income sources configured yet) or
when viewing a past/future month (the tax estimate has no history — it's
always "as of today", so it's only trustworthy for the current month).
A small "Monthly budget: ⟨amount⟩" caption underneath gives the budget
figure as a third reference point without merging it into the same
calculation (income/spent/budget are three different concepts and stay
visually distinct, not collapsed into one number).

Still out of scope: Blog (§3.11.2, Phase 5), receipt OCR, voice, the rest
of the AI layer (NL query, insight rows 6-8, planning, WhatsApp),
push notifications, live FX.
The AI insight card and net-worth ticker must not appear on the
**dashboard** (HomeScreen) — not even placeholders; the deterministic
Insights Engine lives on Reports instead, and net worth under Settings.

**Exception — public signup (multi-tenancy), built on explicit request.**
Spec §12 "Non-Goals (v1.x)" explicitly lists "multi-tenant SaaS, signups"
as *not* being built for exactly this reason (scope creep). The user
asked anyway, was told this reverses that call, and confirmed. Built:
`POST /auth/signup` (`server/services/auth.py::signup`) creates a brand
new `Household` + admin `User`, seeded with the same default category
tree/payment methods as `db/seed.py`, then logs the caller in — same
token/cookie shape as `/auth/login`. `LoginPage.tsx` has a sign-in/sign-up
toggle. NOT built (still out of scope, since only signup itself was
asked for): billing/subscription tiers, SMS OTP, any other Phase 4
multi-tenant item, and the household admin's ability to invite/create a
second login within their own household (still no such UI - Settings has
no "invite" flow) - see spec §9 Phase 4 for the rest of that bucket.

Never describe the app as end-to-end encrypted — the E2E decision is a
Phase 3 gate (spec §7.4) and the claim is currently false.

**Phase 4 (§9 "Beyond the Household") has started, on an explicitly
user-picked slice.** Asked to scope it, the user excluded SMS OTP,
household-invite (second login per household), bKash/Nagad partnerships,
native shell, and DSE stock portfolio — none of those are built. Of the
rest, NRB remittance + live FX was also explicitly skipped after a
scoping question (live FX conflicts with §12's own "no live market data"
non-goal and would add an external API dependency — not worth it for a
single budget template). What *is* built:
- **Annual tax summary export** (§3.2.2's "annual tax summary export for
  return filing" requirement — AIT/tax-certificate storage was explicitly
  descoped, export only): `IncomeScreen.tsx` gained an "Export annual
  summary" link next to the tax estimate that calls `window.print()`
  against a `#printable-tax-summary` container (same pattern as Reports'
  monthly/yearly export — `index.css`'s `@media print` block now lists
  both container IDs; no PDF library, no backend change — the summary is
  composed client-side from data already fetched: active income sources,
  deductions, `tax.lines`, and the annual withheld/remaining-payable
  figures). Explicitly a prepared summary for a human to file, never a
  submission (§12 non-goal) — the disclaimer text says so.
- **Business investment sub-module** (§3.7A.1: "capital in / capital out
  events, profit withdrawals, simple ROI%, valuation (manual, point-in-
  time like §3.10)"): new `investment_transaction` table
  (`type`: capital_in | capital_out | profit_withdrawal), scoped to
  `instrument_type == "business"` only (a 422 if attempted on any other
  type). `Investment.current_value` is deliberately **not** touched by
  these events — it stays the existing manual, point-in-time valuation
  field, per spec's own parenthetical; the transaction history only feeds
  a computed `simple_roi_bps` (`total_profit_withdrawn / net capital
  deployed`, where net capital = principal + capital_in − capital_out).
  `server/services/investments.py::_to_out` is now async (it queries
  transactions for business rows only, to avoid the extra query for every
  other instrument type). `InvestmentsScreen.tsx`'s business cards show a
  capital-in/capital-out/profit-withdrawn/ROI% stat row and a collapsible
  transaction log + add-transaction mini-form.

**Loans given — a new module, not in the spec at all, built on explicit
request.** The mirror of the Debt manager (§3.9): money the household
lends to a person, not a bank — same shape, inverted direction, so it
reuses the Debt manager's design almost field-for-field. `loan_given` +
`loan_given_payment` tables, `server/services/loans.py`, `/api/v1/loans`
(+ `/summary`, `/{id}/payments`), `LoansScreen.tsx` (Settings → Loans
given). Interest is optional — a loan with no `interest_rate_bps` is
interest-free and every repayment reduces principal directly; when a
rate is set, repayments split interest/principal the same way Debt does
(computed from the balance *then* outstanding, so a later rate edit
never rewrites history). `status` (overdue/due_soon/upcoming/no_due_date/
paid_off/inactive) uses a 7-day due-soon threshold — its own named
constant (`DUE_SOON_DAYS`), not shared with Debt or Investments, since
each domain picked its own threshold already. Deliberately **not**
built: an EMI calculator or avalanche/snowball-style payoff simulation
(those model structured loans with fixed schedules; lending to a person
is typically irregular and voluntary) and any notification-bell
integration for overdue loans (the bell only watches `recurring_rule`
today — extending it here would be a separate ask). Like Debt, creating
or repaying a loan does **not** touch the Expense/Income ledger — it's
a standalone tracked balance, matching the existing precedent that
principal/debt figures are never duplicated into the general ledger.

## Open items (spec §13)

- Q1 (blocks DoD #3): verified NBR slabs/thresholds/rebate rules → update `tax_config`, set `verified=true`.
- DoD #1/#6 need a real Android phone (5s entry timing, home-screen install).
- Deployment for two phones: managed Postgres + host, or Tailscale (M8 note in README).
