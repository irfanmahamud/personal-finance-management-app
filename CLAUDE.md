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
2. **`household_id` comes from the JWT (`user.household_id` via `get_current_user`), never from a request body or query param.** Every table carries it even though one household exists — that's the productization path (spec §2.2).
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

## Phase discipline

Phase 1 is done. Phase 2 (spec §9) is being built incrementally, working
through the spec's Phase 2 list one item at a time (per explicit instruction
to proceed without re-asking each time) — still do NOT build ahead into
Phase 3+ items. Built so far:
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
  holding and the rebate, per spec). NOT built: contribution schedules that
  spin up recurring_rule entries for DPS/pension installments, and zakat-
  calculator linkage (the `zakatable` flag is stored — reserved, like
  `member` rows were pre-Phase-2 — but no calculator exists yet to consume it).
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

Still out of scope until reached in sequence: Blog (§3.11.2, Phase 5), PDF
export, receipt OCR, voice, AI layer, push notifications, multi-tenancy,
live FX, weekly/per-member ledger *views* (per-member list exists in
FamilyScreen; a dedicated Reports-side per-member view is still open),
50/30/20 & zero-based budgeting, Bangla transliteration input, zakat/Eid
mode, Google Sheets sync.
`expense.receipt_id` column is reserved. The AI insight card and net-worth
ticker must not appear on the **dashboard** (HomeScreen) — not even
placeholders; the net worth feature itself now exists under Settings.

Never describe the app as end-to-end encrypted — the E2E decision is a
Phase 3 gate (spec §7.4) and the claim is currently false.

## Open items (spec §13)

- Q1 (blocks DoD #3): verified NBR slabs/thresholds/rebate rules → update `tax_config`, set `verified=true`.
- DoD #1/#6 need a real Android phone (5s entry timing, home-screen install).
- Deployment for two phones: managed Postgres + host, or Tailscale (M8 note in README).
