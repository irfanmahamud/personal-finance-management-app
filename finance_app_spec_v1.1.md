# 💰 Hishabi — Personal Finance & Budget Management
## Product Specification Document

**Version:** 1.1 | **Date:** August 2026 | **Supersedes:** v1.0 (July 2026)
**Language Support:** English & বাংলা
**Build posture:** Personal-first (single household), designed so it can be productized later without a rewrite.

---

## Changelog from v1.0

| # | Change | Reason |
|---|---|---|
| 1 | Reframed as personal-first, product-later | v1.0 read as a commercial spec but used real family data as the canonical example |
| 2 | Unified the roadmap — §4 said "AI = Phase 2", §10 said Phase 3 | Contradiction; §10's sequencing wins |
| 3 | Auth simplified to one household, multiple logins | No multi-tenancy needed until productized |
| 4 | Stack simplified: dropped Redis, Bull, S3, Express from Phase 1 | Three months of infra work for a household of two |
| 5 | E2E encryption demoted to a Phase 3 **decision gate**, not a Phase 1 promise | It structurally conflicts with §4 (AI) and §3.6 (reporting) |
| 6 | Corrected the Claude model ID and added cost/caching guidance | `claude-sonnet-4-6` is not the current default |
| 7 | Tax slabs flagged **UNVERIFIED** pending NBR confirmation | Doc dated July 2026 cites FY 2025–26 slabs |
| 8 | Monetization + success metrics + competitive landscape moved to Appendix B | Not decisions for a household tool; preserved for productization |
| 9 | Added §7.6 data model, §12 non-goals, §13 open questions | v1.0 had no schema and no explicit exclusions |
| 10 | bKash/Nagad/SMS integration re-scoped against actual API availability | v1.0 assumed APIs that aren't publicly available |
| 11 | Added a migration note: start fresh, seed categories from the old tracker | No transaction import needed |

---

## 1. Executive Summary

A household finance manager built for a Bangladeshi family. It covers tax-aware income tracking, budget planning from templates, fast daily expense logging, per-family-member allowances and medical tracking, and — later — an AI advisor that answers questions in Bangla and English.

**What it must do that no existing app does:**
- Model a Bangladeshi household: extended-family allowances, domestic help, infant care as first-class categories
- Compute take-home pay against Bangladesh TDS slabs, not generic tax
- Understand Bangla financial vocabulary (bazar, sanchayapatra, bKash) in both input and analysis
- Survive a refresh — persistent storage, not a session-bound tracker

**What it explicitly is not, in this version:** a multi-tenant SaaS. See §12.

---

## 2. Users

### 2.1 Actual users (v1.x)
| Role | Who | Access |
|---|---|---|
| Household admin | Irfan | Full: income, tax, budgets, all members |
| Household member | Mim | Full ledger + budgets; can log expenses and view reports |
| Tracked-only members | Safeer, Ammu, Yousha, Nuyera, Adib | No login. Profiles exist for allowance/spend attribution only |

Two logins, one shared household. Every expense carries both **who logged it** and **who it was for** — these are different fields and both matter for reporting.

### 2.2 Design-for users (if productized — Appendix B)
Salaried BD professionals 25–45; small business owners and freelancers with irregular income; NRBs managing remittance budgets.

Building for §2.1 while *shaped* for §2.2 costs almost nothing if two rules hold from day one:
- Every table carries a `household_id`, even though there is exactly one household.
- No hardcoded family member names, categories, or amounts anywhere in code — all seeded data.

---

## 3. Core Modules

### 3.1 Dashboard (হোম)

**Above the fold:**
- Monthly income vs. spent vs. remaining — the largest element on screen
- Budget health bar, color-coded (green <75%, yellow 75–95%, red >95%)
- Today's spending total
- Top 3 categories nearing their limit
- Floating "add expense" button, always visible, thumb-reachable

**Below the fold (toggleable widgets):**
- Daily spend sparkline, 30 days
- Category donut
- Upcoming bills
- Savings goal progress
- AI insight card *(Phase 3 — renders nothing before then; do not build a placeholder)*
- Net worth ticker *(Phase 2 — hidden until assets are configured)*

### 3.2 Income Manager (আয় ব্যবস্থাপনা)

#### 3.2.1 Income Sources
| Field | Options |
|---|---|
| Source name | Salary, Business, Freelance, Rental, Remittance, Investment Return, Other |
| Amount | Fixed or variable per period |
| Currency | BDT primary; USD, GBP, SAR for later NRB support |
| Frequency | Monthly, Weekly, Bi-weekly, Irregular |
| Tax status | Taxable / Tax-exempt |

Multi-currency in Phase 1 means **storage and display only** — every amount is stored in its original currency plus a BDT amount at a user-entered rate. No live FX rates until Phase 4.

#### 3.2.2 TDS Module (Bangladesh)

> ⚠️ **UNVERIFIED — blocking for this module.** The slabs below are carried over from v1.0, labelled FY 2025–26, in a document dated July 2026. Confirm the current NBR slabs, the tax-free threshold (it differs for women, senior citizens, persons with disability, and gazetted freedom fighters), the minimum tax floor by area, and the current investment-rebate formula **before writing the calculation engine**. Getting this wrong produces confidently wrong take-home numbers, which is worse than showing none.

**Slabs to verify (individual, general category):**
| Annual income | Rate |
|---|---|
| Up to ৳3,50,000 | 0% |
| ৳3,50,001 – ৳4,50,000 | 5% |
| ৳4,50,001 – ৳7,50,000 | 10% |
| ৳7,50,001 – ৳11,50,000 | 15% |
| ৳11,50,001 – ৳17,50,000 | 20% |
| Above ৳17,50,000 | 25% |

**Engine requirements:**
- Slabs live in a **versioned, dated config table**, never in code. A future fiscal year is a data change, not a deploy.
- Every computed tax figure must be able to explain itself: which slab, which rebate, which deduction, in a line-by-line breakdown the user can read.
- Gross → net monthly walk-through
- Investment rebate tracking (life insurance, DPS, savings certificates)
- Provident fund: employee and employer contributions tracked separately
- Annual tax summary export for return filing
- AIT / tax certificate storage

#### 3.2.3 Deductibles
Professional tax · PF contribution · loan EMI deductions · union or association fees · insurance premiums (life, health).

### 3.3 Budget Planner (বাজেট পরিকল্পনা)

#### 3.3.1 Templates
1. **Young Professional (সিঙ্গেল)** — single earner, Dhaka
2. **Young Family (নতুন পরিবার)** — couple + 1 child, infant categories on
3. **Extended Family (যৌথ পরিবার)** — nuclear + extended allowances *(the household's own starting point)*
4. **NRB Remittance** *(Phase 4)*
5. **Custom** — empty

Each carries a category tree, suggested percentage allocations, Bangla + English labels, and per-category tips.

**Seeding note:** the category tree and typical amounts should be derived from the existing manual tracker. Historical transactions are **not** being imported — the tracker informs the defaults, nothing more.

#### 3.3.2 Category Tree (default set)

Two levels: category → subcategory. Users can rename, hide, reorder, and add — but not nest a third level in v1.

```
🏠 আবাসন (Housing)          বাসা ভাড়া · সার্ভিস চার্জ · গ্যাস · বাড়ি মেরামত
⚡ ইউটিলিটি (Utilities)      বিদ্যুৎ · ইন্টারনেট · পানি · মোবাইল রিচার্জ
🛒 বাজার ও খাবার (Grocery)   মাছ/মাংস · সবজি · চাল/ডাল · ফল · বাইরের খাবার · রান্নাঘর সামগ্রী
👶 শিশু পরিচর্যা (Child Care) শিশু খাবার · ডায়াপার · শিশু চিকিৎসা · খেলনা ও বই · শিশু পোশাক
🏫 শিক্ষা (Education)        স্কুল ফি · টিউশন · বই ও স্টেশনারি · কোচিং
🏥 স্বাস্থ্য (Health)         ওষুধ · ডাক্তার ফি · ল্যাব টেস্ট · হাসপাতাল যাতায়াত · স্বাস্থ্য বীমা
🚗 যানবাহন (Transport)       মোটরসাইকেল তেল · রিকশা/উবার · বাস/পাবলিক · গাড়ি রক্ষণাবেক্ষণ
👗 পোশাক (Clothing)          নিজের · পরিবারের · ঈদ/উৎসব
👨‍👩‍👧‍👦 পারিবারিক ভাতা (Allowances) [per member] · গৃহকর্মী/বুয়া
🎉 উৎসব ও বিনোদন (Festivals)  ঈদ খরচ · বিনোদন · উপহার
💳 ঋণ ও EMI (Loans)          ব্যাংক লোন · ক্রেডিট কার্ড · ব্যক্তিগত ঋণ
💰 সঞ্চয় ও বিনিয়োগ (Savings) পেনশন/প্রভিডেন্ট · জমানো (DPS) · সঞ্চয়পত্র · মিউচুয়াল ফান্ড
🏗 এককালীন (One-time)        আসবাবপত্র · ইলেকট্রনিক্স · বাড়ি সংস্কার
```

**Removed from v1.0:** the standalone `💊 মেডিক্যাল (Member-specific)` category. Per-member medical spend is a **filter on 🏥 স্বাস্থ্য by member**, not a parallel category tree — v1.0 had the same expense reachable through two different paths, which double-counts in reports.

#### 3.3.3 Budget Rules Engine
| Rule | Phase | Notes |
|---|---|---|
| Custom percentage split | 1 | The baseline. User sets an amount or % per category |
| Rollover unused budget | 1 | Per-category toggle |
| Overspend warning | 1 | Soft warning at 75% and 95% |
| 50/30/20 auto-apply | 2 | Requires each category tagged need/want/save |
| Zero-based budgeting | 2 | Every taka assigned; needs an "unassigned" surface |
| Envelope method | 2 | Overlaps heavily with zero-based — pick one after using both |
| Hard block on overspend | 2 | Behaviourally risky: users route around it by not logging. Default off |

### 3.4 Expense Tracker (খরচ ট্র্যাকার)

The **5-second rule** is the single most important requirement in this document. If logging an expense is slow, nothing else in the app matters, because the ledger goes stale and every report becomes fiction.

#### 3.4.1 Quick Add — Phase 1
- Amount → category → save. Three taps, category defaulted to the user's most-used for that time of day.
- "Repeat last entry" button
- Date defaults to today, with one-tap "yesterday"

#### 3.4.2 Quick Add — later phases
- Smart text parsing: `bazar mach 500` → category, subcategory, amount *(Phase 3)*
- Receipt photo → OCR → prefilled entry *(Phase 3)*
- Bangla + English voice input *(Phase 3)*

#### 3.4.3 Full Entry
Date · category → subcategory · amount · description (either language) · payment method · person (spent by / spent for) · tags · receipt photo · notes.

#### 3.4.4 Payment Methods
নগদ (Cash) 💵 · bKash 📱 · Nagad 📱 · Rocket 📱 · Credit Card 💳 · Debit Card 💳 · Bank Transfer 🏦

Stored as a user-editable list, not an enum in code.

#### 3.4.5 Recurring Expenses — Phase 2
Auto-entry templates for rent, internet, electricity. Due-date reminders. One-tap mark-paid. Skip-this-month.

**Implementation note:** generate the pending entry lazily on app open, not from a background job queue. A household app does not need Bull + Redis to know rent is due on the 1st.

#### 3.4.6 Split Expenses — Phase 2
Split across members, track who paid, settle balances.

### 3.5 Family Members (পরিবার ব্যবস্থাপনা) — Phase 2

Each member profile: name, relation, date of birth (optional), monthly allowance, active/inactive.

**Seed data is example data.** The five-column table in v1.0 §3.5 listed real names and amounts. Those belong in a seed script or the onboarding flow, not in the specification and not in the repository.

**Per-member features:**
- Spending view filtered to that member
- Medical history and medicine tracker
- Allowance auto-debit on a chosen day of month
- Age-derived suggestions (infant feeding costs, school-fee cadence) *(Phase 3 — needs the AI layer to be useful)*

### 3.6 Ledger & Reporting (হিসাব ও রিপোর্ট)

**Views (Phase 1):** daily · monthly · category · custom date range
**Views (Phase 2):** weekly · per-member

**Reports (Phase 1):** monthly summary (income, expense, savings, surplus) · budget vs. actual variance · category analysis
**Reports (Phase 2):** savings progress · tax summary · yearly month-by-month · net worth
**Reports (Phase 3):** spending patterns (day-of-week, time-of-month)

**Export:** CSV in Phase 1. PDF in Phase 2. Share sheet handles WhatsApp/email — no per-channel integration needed.

### 3.7 Savings & Goals (সঞ্চয় ও লক্ষ্য) — Phase 2

**Goal types:** emergency fund · child education · Hajj/Umrah · home · vehicle · wedding · custom
**Per goal:** target amount, target date, monthly contribution calculator, progress bar with projected completion, "what if I save more" slider, optional link to a savings instrument.

**Investment tracker:** Sanchayapatra (rate, maturity) · DPS · FDR · mutual funds · gold. DSE stocks deferred to Phase 4 — it needs price data this app has no source for.

### 3.8 Bills & Reminders (বিল ও অনুস্মারক) — Phase 2
Recurring bill calendar · reminders at 3 days and 1 day · overdue alerts · one-tap paid · payment history.

### 3.9 Debt Manager (ঋণ ব্যবস্থাপনা) — Phase 2
Loans (bank, personal, family) · EMI calculator with amortization schedule · credit card balances · payoff projection · avalanche vs. snowball comparison · interest-vs-principal split.

### 3.10 Net Worth (সম্পদের হিসাব) — Phase 2
**Assets:** cash and bank · savings instruments · property · vehicles · gold and jewelry · investments
**Liabilities:** bank loans · credit card balances · personal debts
**Output:** net worth line chart over time, from monthly snapshots.

Valuations are **manual and point-in-time**. Property and gold values are user-entered; the app records who said what and when, and never implies a market valuation.

---

## 4. AI Financial Advisor (AI আর্থিক উপদেষ্টা) — **Phase 3**

> v1.0 labelled this "Phase 2 — Post-launch" in §4 but scheduled it in Phase 3 in §10. **Phase 3 is correct.** The AI layer is worth very little until there are several months of real, consistently-logged data behind it — its quality is bounded by the ledger, not by the model.

### 4.1 Natural Language Query (Bangla + English)
- "এই মাসে আমি কত খরচ করেছি?"
- "Safeer-এর diaper এ কত গেছে?"
- "আমার কোন category তে বেশি খরচ হচ্ছে?"
- "Show me all medical expenses in July"
- "বাজারে সবচেয়ে বেশি কোন দিন খরচ হয়?"

**Architecture decision — query, don't dump.** Do not paste the full ledger into the prompt and ask the model to add it up. Give the model a small set of typed query tools (`get_spend_by_category`, `get_member_spend`, `compare_periods`) and let it call them. Arithmetic happens in SQL, where it is exact. This is cheaper, verifiable, and cannot hallucinate a total.

### 4.2 Insights Engine
| Type | Example |
|---|---|
| Overspend alert | "Bazar is 80% used with 15 days left" |
| Pattern | "You spend 40% more on Fridays" |
| Anomaly | "Medical is 3× the six-month average" |
| Savings opportunity | "Cutting outside food by ৳2,000 saves ৳24,000/year" |
| Goal projection | "Emergency fund complete in 4 months at this rate" |
| Tax optimization | "৳50,000 more in Sanchayapatra reduces tax by ~৳5,000" |
| Milestone | "Safeer turns 6 months — food budget will shift" |
| Seasonal | "Eid is 45 days away — plan ৳15,000–20,000" |

Rows 1–5 are **deterministic rules over SQL**, not model output. Only the phrasing needs a model, and often not even that. Reserve the LLM for rows 6–8 and for §4.1. Anything stated as a number to the user must come from the database.

### 4.3 Planning Mode
"Plan next month's budget" · "How do I save ৳1 lakh in 6 months?" · "What if I take a ৳5 lakh loan?" · "Optimize for maximum savings".

Every AI-generated budget lands as a **draft the user reviews and accepts**. Nothing the model produces writes directly to the budget.

### 4.4 AI Sub-phases
- **3A** — NL query, read-only
- **3B** — insights engine (rules first, model for phrasing)
- **3C** — budget generation and recommendations
- **3D** — predictive forecasting
- **3E** — Bangla voice (STT/TTS)
- **3F** — WhatsApp expense logging

### 4.5 Model & Cost

| Setting | Value |
|---|---|
| Model | `claude-opus-5` — 1M context, $5/MTok in, $25/MTok out |
| Cheaper alternative | `claude-sonnet-5` — 1M context, $2/MTok in, $10/MTok out |
| Thinking | `thinking: {type: "adaptive"}` |
| Effort | `output_config: {effort: "low"}` for routine queries; raise for planning mode |
| Caching | Cache the system prompt + category tree + household config as a stable prefix; put the user's question after the last cache breakpoint |
| Output cap | `max_tokens` ≈ 16000 non-streaming; stream anything longer |

> v1.0 §7.3 specified `claude-sonnet-4-6`. That is not the current default; the Claude 5 family supersedes it. Also note both Opus 5 and Sonnet 5 handle Bangla natively — no separate translation layer, and no fine-tuning, is needed.

**Cost sanity check:** a query that sends a ~2K-token cached system prompt and returns ~500 tokens costs well under ৳1 on Sonnet 5. Even heavy daily use by two people is a rounding error. Cost is not the reason to defer this module — data quality is.

**RAG (BD tax law, investment products):** defer past 3A. It is only worth building once the query layer works, and a curated 20-document set will outperform a vector store at this scale.

---

## 5. Language & Localization (ভাষা)

### 5.1 Bilingual
- **Decision needed (§13, Q3):** simultaneous dual labels vs. a language toggle. v1.0 said "or" and never chose. Recommendation: **toggle**, with Bangla category names always shown, because dual labels double the vertical space on a mobile screen where density already matters.
- Currency: ৳ BDT primary
- **Numbers: Bangladeshi grouping** — `1,00,000` not `100,000`. `Intl.NumberFormat('en-IN')` produces the correct grouping; `bn-BD` produces Bengali digits (১,০০,০০০), which should follow the language toggle.
- Dates: DD/MM/YYYY
- Fiscal year: user choice between July–June (BD government) and January–December. **Default July–June**, since the tax module depends on it.

### 5.2 Bangla Input — Phase 2
Native keyboard support (free — it's the OS keyboard) is Phase 1. Avro/Bijoy transliteration and phonetic auto-suggest (`bazar` → বাজার) are Phase 2. Voice is Phase 3.

### 5.3 Regional Context
BD-native categories and payment methods · BD tax rules · Islamic finance flags on investments · Ramadan/Eid budget mode *(Phase 2)* · Zakat calculator *(Phase 2)*.

---

## 6. User Experience

### 6.1 Principles
1. **Mobile-first** — assume a phone, one hand, in a bazar, in poor light
2. **5-second rule** — see §3.4
3. **Offline-tolerant** — logging an expense must never fail for lack of network. Reads may require it in Phase 1.
4. **Progressive disclosure** — the full-entry form is one tap away from quick-add, never in the way

> **On "offline-first" (v1.0 §6.1):** true offline-first — bidirectional sync with conflict resolution — is a multi-week subsystem. What actually matters here is that *writes never fail*. Phase 1 achieves that with an IndexedDB write queue that drains when connectivity returns. Full offline read/edit is Phase 2 or later, and only if it proves necessary in practice.

### 6.2 Key Flows
```
Expense entry   Home → (+) → Amount → Category → Done            [3 taps]
Month review    Home → Reports → Monthly → Category → Share
First-run setup Onboarding → Template → Income → Adjust → Done
AI query        Home → Ask → Type/Speak → Answer + Chart          [Phase 3]
```

### 6.3 Onboarding
1. Language
2. Income sources
3. Tax profile → shows computed take-home *(skippable; can be completed later)*
4. Budget template
5. Family members *(Phase 2; skipped in Phase 1)*

Every step must be skippable. A user who abandons onboarding at step 2 should still land on a working app.

### 6.4 Notifications — Phase 2
Evening spend summary (9 PM) · budget warnings at 75% and 95% · bill due · monthly report ready · goal milestone · weekly AI digest *(Phase 3)*.

Web push on Android PWA works. **iOS requires the PWA to be installed to the home screen** and is unreliable — do not build a feature that depends on notification delivery.

---

## 7. Technical Architecture

### 7.1 Guiding constraint
This runs for one household. Every architectural choice should be the simplest one that does not foreclose growth. Concretely: keep the schema multi-household-shaped, keep the API layer thin, and do not adopt infrastructure until something actually hurts.

### 7.2 Stack

| Layer | Phase 1 | Why |
|---|---|---|
| App | **Next.js (App Router), PWA-enabled** | One deployable for UI and API. No separate Express service to run |
| State | **TanStack Query + Zustand** for local UI state | Server data is server data; Redux is unnecessary ceremony here |
| Styling | **Tailwind CSS** | As specified in v1.0 |
| Charts | **Recharts** | Sufficient; D3 only if a chart demands it |
| DB | **PostgreSQL** — managed (Neon or Supabase) | Financial data is relational. Managed = no ops |
| ORM | **Drizzle** or Prisma | Typed schema, migrations |
| Auth | **Session-based, 2 accounts, PIN + WebAuthn** | See §7.3 |
| Files | Postgres `bytea` or Supabase Storage *(Phase 2, with receipts)* | No S3 bucket to provision for a feature that doesn't exist yet |
| Offline | Service worker + IndexedDB **write queue** | See §6.1 |
| i18n | `next-intl` or `react-i18next` | Either is fine |
| Hosting | Vercel free tier / any Node host | |

**Dropped from v1.0 §7.2, with the trigger to reconsider:**
| Dropped | Reconsider when |
|---|---|
| Redis cache | A dashboard query exceeds ~300ms on real data |
| Bull job queue | Lazy generation of recurring entries proves insufficient (§3.4.5) |
| S3 / R2 | Receipt storage exceeds the DB plan's limits |
| Separate Express API | A non-web client (native app) needs the API |

### 7.3 Auth
- One `household`. Two `user` rows (Irfan, Mim), both with full access.
- Login: **email + password, or a magic link.** Not SMS OTP — v1.0 specified OTP over SMS, which requires a BD SMS gateway contract, per-message cost, and a delivery-failure path, for two known users.
- On-device: **6-digit PIN + WebAuthn biometric** for re-entry. This is the lock that actually matters, since the threat model is a borrowed or lost phone.
- Session timeout with PIN re-entry.
- SMS OTP returns as a Phase 4 item **only if** the app is opened to outside users.

### 7.4 Security & Privacy

**Phase 1–2:**
- TLS everywhere; HSTS
- Postgres encryption at rest (standard on managed providers)
- App-level PIN + biometric
- Session timeout
- Receipt images access-controlled per household
- No third party receives financial data

**Phase 3 decision gate — resolve before the AI layer ships:**

The conflict is structural, not a detail. End-to-end encryption means the server holds ciphertext it cannot read. But §3.6 reporting aggregates in SQL, and §4 sends financial context to an external API. All three cannot be true at once. Three coherent resolutions:

| Option | Reporting | AI | Cost |
|---|---|---|---|
| **A. At-rest only** (current default) | Server-side SQL, fast | Full Claude API context | Provider could in principle read the DB |
| **B. E2E + client-side aggregation** | Computed on-device | Only user-approved minimal slices sent | Significant work; slow on large ledgers |
| **C. E2E + on-device model only** | Client-side | No §4 as specified | Rules out the advisor |

Deferred by decision. Until then, **do not describe the app as end-to-end encrypted** — that claim is currently false and would be a meaningful one to get wrong.

Independent of the gate: Anthropic does not train on API data by default, so §4 does not put the ledger into a training set. Note that in the privacy copy rather than as an opt-out toggle.

### 7.5 Integrations — reality check

v1.0 §7.5 listed these as Phase 2. Their actual feasibility differs sharply:

| Integration | Reality | Revised phase |
|---|---|---|
| **bKash API** | Merchant/business APIs exist; **there is no public personal-transaction-history API.** Not buildable for a personal account | Phase 4, blocked on partnership. Treat as out of scope |
| **Nagad API** | Same | Same |
| **Bank SMS parsing** | Technically feasible **on Android only, and not from a PWA** — SMS read permission requires a native app or a companion APK. Per-bank format parsing, brittle | Phase 4, and only alongside a native shell |
| **Google Sheets two-way sync** | Fully feasible today via the Sheets API | Phase 2 — genuinely the most achievable of these |
| **WhatsApp bot** | Feasible via WhatsApp Business API; has cost and approval overhead | Phase 3 |

The practical consequence: **manual entry must be excellent, because auto-import is not coming.** This reinforces §3.4 as the make-or-break module. Google Sheets sync is the realistic near-term bulk-entry escape hatch.

### 7.6 Data Model (sketch)

```
household        id, name, fiscal_year_start, base_currency, created_at
user             id, household_id, email, password_hash, role, locale
member           id, household_id, name, name_bn, relation, dob, monthly_allowance, active
                 -- tracked people; not all have a user account

income_source    id, household_id, name, type, currency, amount, frequency, taxable, active
tax_config       id, fiscal_year, slabs jsonb, thresholds jsonb, rebate_rules jsonb, effective_from
                 -- versioned; never hardcoded (§3.2.2)
deduction        id, household_id, type, amount, frequency, income_source_id

category         id, household_id, parent_id, name_en, name_bn, icon, sort_order,
                 need_want_save, archived
budget           id, household_id, period_start, period_end, method
budget_line      id, budget_id, category_id, amount, rollover_enabled, rolled_over_amount

expense          id, household_id, date, category_id, amount, currency, amount_bdt,
                 description, payment_method_id, logged_by_user_id, for_member_id,
                 notes, receipt_id, created_at, client_uuid
                 -- client_uuid: idempotency key for the offline write queue (§6.1)
expense_tag      expense_id, tag_id
payment_method   id, household_id, name, name_bn, icon, sort_order

recurring_rule   id, household_id, category_id, amount, day_of_month, next_due, active
goal             id, household_id, name, target_amount, target_date, linked_account
asset            id, household_id, type, name, value, valued_at
liability        id, household_id, type, name, principal, rate, emi, remaining
```

**Money is stored as integers in poisha (1/100 taka), never as floats.** Currency conversion stores both the original amount and the BDT amount at a recorded rate — never reconstruct one from the other later.

---

## 8. Gaps from the Manual Tracker

Carried from v1.0 §8, with the phase each is addressed in:

| Gap | Solution | Phase |
|---|---|---|
| Data lost on refresh | Persistent DB + local cache | 1 |
| No tax awareness | TDS module | 1 |
| "Bazar" too generic | Subcategory tree | 1 |
| Manual date entry errors | Today/yesterday/picker | 1 |
| No payment method tracking | Per-entry method | 1 |
| No savings tracking | Goals module | 2 |
| No recurring reminders | Bills module | 2 |
| No net worth view | Asset/liability tracker | 2 |
| No credit card debt tracking | Debt manager | 2 |
| No loan EMI tracking | Amortization schedule | 2 |
| No investment tracking | Investment portfolio | 2 |
| No zakat calculator | Islamic finance module | 2 |
| No Eid/festival planning | Seasonal budget mode | 2 |
| No year-on-year comparison | Annual reports | 2 |
| Language barrier | Bilingual UI (voice in 3) | 1 |
| No receipt capture | Camera → OCR | 3 |
| No multi-currency | Storage in 1; live FX in 4 | 1 / 4 |

---

## 9. Roadmap

**One canonical sequence.** v1.0 had §4 and §10 disagreeing; this replaces both.

### Phase 1 — Usable Daily (Month 1–3)
The bar: *the household stops using the old tracker.*

- Household + 2-user auth, PIN/biometric lock
- Income sources + TDS engine (blocked on slab verification, §3.2.2)
- Category tree + budget templates + custom budget
- Expense entry: quick-add and full form
- Payment methods
- Ledger: daily, monthly, category, custom range
- Reports: monthly summary, budget vs. actual, category analysis
- CSV export
- Bilingual UI, BD number formatting
- PWA install + offline write queue

### Phase 2 — Complete Picture (Month 4–6)
- Family members + allowances + per-member views
- Recurring expenses, bills, reminders
- Savings goals + investment tracker
- Debt manager + net worth
- Weekly/per-member views, PDF export, yearly comparison
- Receipt photo upload (storage only, no OCR)
- Zakat calculator, Eid/Ramadan mode
- Google Sheets sync
- 50/30/20 and zero-based budgeting
- Bangla transliteration input

### Phase 3 — AI Layer (Month 7–9)
Gated on ≥6 months of consistently logged data.
- 3A NL query → 3B insights → 3C planning → 3D forecasting → 3E voice → 3F WhatsApp
- Receipt OCR
- Smart text parsing
- **Resolve the §7.4 encryption gate before shipping 3A**

### Phase 4 — Beyond the Household (Month 10+)
Only if productizing (Appendix B).
- Multi-tenant onboarding, SMS OTP
- Full tax return assistance
- Business/freelancer mode
- NRB remittance + live FX
- DSE portfolio
- Native shell (enables SMS parsing)
- bKash/Nagad partnerships

---

## 10. Definition of Done — Phase 1

Objective, checkable:

1. An expense is logged in **under 5 seconds**, measured from app-open to saved, on a mid-range Android phone.
2. Logging an expense **in airplane mode** succeeds and syncs on reconnect, with no duplicate rows.
3. The TDS engine reproduces the household's actual last-year tax figure to within ৳1.
4. The monthly report's category totals reconcile exactly against a CSV export summed in a spreadsheet.
5. Every screen is fully usable in both English and Bangla, with `1,00,000`-style grouping throughout.
6. The app installs to an Android home screen and opens without a browser chrome.
7. Both users can log in, and each expense correctly records who logged it and who it was for.
8. No family member name, category, or amount appears anywhere in source code.

---

## 11. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Tax slabs wrong or stale | Confidently wrong take-home figures | Verify against NBR before building; versioned config; show the calculation breakdown |
| Logging discipline lapses | Every report becomes fiction; AI layer worthless | The 5-second rule is a hard requirement, not an aspiration; evening reminder in Phase 2 |
| Scope creep across 10 modules | Phase 1 never ships | §10's Definition of Done is the gate. Nothing outside Phase 1 is built in Phase 1 |
| Category tree doesn't match real spending | Constant recategorization; users give up | Seed from the actual tracker; make renaming and adding trivial |
| Auto-import never arrives (§7.5) | The "just sync my bKash" expectation is never met | Set the expectation now; invest in manual entry and Sheets sync instead |
| Two-user concurrent edits | Conflicting budget edits | Last-write-wins with an edit timestamp is sufficient at this scale; revisit if productized |

---

## 12. Non-Goals (v1.x)

Explicitly **not** being built, so they stop appearing in scope discussions:

- Multi-tenant SaaS, signups, billing, subscription tiers
- Real bank or MFS API integration (§7.5)
- Investment advice or recommendations — the app reports, it does not advise on securities
- Live market data (FX, DSE, gold prices)
- Native iOS/Android applications — PWA only
- Shared/collaborative budgets outside the one household
- Accounting-grade double-entry bookkeeping
- Tax filing submission — the app prepares a summary, a human files it

---

## 13. Open Questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| 1 | What are the confirmed current NBR slabs, thresholds, and rebate rules? | §3.2.2 — TDS engine | Irfan |
| 2 | Which fiscal year does the household actually budget on — July–June or Jan–Dec? | §5.1 default, all reporting | Irfan |
| 3 | Dual labels or a language toggle? | §5.1, every screen | Irfan |
| 4 | Does Mim need equal access, or view + log only? | §7.3 roles | Irfan |
| 5 | Does the existing tracker's category list differ from §3.3.2? | Seed data | Irfan |
| 6 | Where does this get hosted, and is a paid DB tier acceptable? | §7.2 | Irfan |
| 7 | Should archived/deleted expenses be soft-deleted for audit? | §7.6 schema | — |

Q1 and Q2 block Phase 1 implementation. Q3–Q7 can be decided during the build.

---

## Appendix A — Naming

"Hishabi" (হিসাবি) — from *hishab* (হিসাব), account/reckoning; as an adjective, someone careful with money. Working title; not committed.

---

## Appendix B — If Productized

Preserved from v1.0 §9, §11, §12. **None of this is in scope for v1.x** — it is kept so that the architectural constraints in §2.2 and §7.1 have a documented reason to exist.

**Monetization**
| Tier | Price | Features |
|---|---|---|
| Free | ৳0 | 1 user, 3 months history, basic reports, 2 goals |
| Premium | ৳199/mo | Unlimited history, AI advisor, all reports, OCR |
| Family | ৳349/mo | Up to 5 members, shared budget, family reports |
| Annual | ৳1,799/yr | ~25% off Premium |

**Six-month targets:** 5,000 active users · >40% DAU · >30 expenses/user/month · >8% premium conversion · >4.5★ · <5s entry · >85% AI query satisfaction.

**Competitive position:** Money Manager and Wallet lack Bangla, BD tax, and family structure. YNAB is complex, English-only, USD-centric. bKash History covers one payment rail with no budgeting. The defensible edge is Bangladesh-specific: tax awareness, household structure, Bangla throughout, offline tolerance.

**Reality check before pursuing any of this:** the free tier as specified (3 months history) is close to unusable, and ৳199/month is meaningful money in the target market. Conversion to a paid personal-finance app is difficult in any market. Validate willingness to pay before building billing.

---

*Version 1.1 — August 2026. Supersedes v1.0. Open questions in §13 must be resolved before implementation begins.*
