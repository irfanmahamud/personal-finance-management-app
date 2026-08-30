# 💰 Personal Finance & Budget Management Web App
## Product Specification Document
**Version:** 1.0 | **Date:** July 2026 | **Language Support:** English & বাংলা

---

## 1. Executive Summary

A full-featured personal finance management web app tailored for Bangladeshi households. It covers income tracking with tax deductions, budget planning with templates, daily expense logging, family member tracking, and AI-powered financial insights. Built for mobile-first use with bilingual support (English & Bengali).

**Core Problem It Solves:**
- No single app handles Bangladeshi household structure (extended family allowances, infant care, domestic help)
- No tax-aware income tracking for BD salaried individuals
- No AI that understands Bangla financial context
- Existing apps are too generic — no baby/childcare category intelligence
- Data is lost between sessions (solved with persistent cloud storage)

---

## 2. Target Users

| User Type | Description |
|---|---|
| Primary | Salaried professionals in Bangladesh, aged 25–45 |
| Secondary | Small business owners, freelancers with variable income |
| Household | Families with infants, extended family responsibilities |
| Future | NRBs (Non-Resident Bangladeshis) managing remittance budgets |

---

## 3. Core Modules

### 3.1 Dashboard (হোম / Home)
The landing screen after login. Provides a full financial health snapshot.

**Components:**
- Monthly income vs. spent vs. remaining — large, prominent
- Budget health bar (color-coded: green / yellow / red)
- Today's spending summary
- Top 3 budget alerts (categories nearing limit)
- Quick add expense button (floating, always visible)
- AI insight card — one-line smart observation (e.g. "Safeer's food budget runs out in 3 days at current pace")
- Net worth ticker (if assets/liabilities configured)

**Widgets (toggleable):**
- Daily spend sparkline (last 30 days)
- Category donut chart
- Upcoming bills reminder
- Savings goal progress bars

---

### 3.2 Income Manager (আয় ব্যবস্থাপনা)

#### 3.2.1 Income Sources
Users can add multiple income sources:

| Field | Options |
|---|---|
| Source Name | Salary, Business, Freelance, Rental, Remittance, Investment Return, Other |
| Amount | Monthly fixed or variable |
| Currency | BDT (primary), USD, GBP, SAR (for NRBs) |
| Frequency | Monthly, Weekly, Bi-weekly, Irregular |
| Tax Status | Taxable / Tax-exempt |

#### 3.2.2 Tax Deduction at Source (TDS) Module
Bangladesh-specific tax handling:

**Salaried Tax Slabs (FY 2025–26):**
| Income Range | Rate |
|---|---|
| Up to ৳3,50,000/yr | 0% |
| ৳3,50,001 – ৳4,50,000 | 5% |
| ৳4,50,001 – ৳7,50,000 | 10% |
| ৳7,50,001 – ৳11,50,000 | 15% |
| ৳11,50,001 – ৳17,50,000 | 20% |
| Above ৳17,50,000 | 25% |

**Features:**
- Auto-calculate monthly TDS based on annual income
- Show gross vs. net (take-home) salary
- Track tax certificates (AIT)
- Investment rebate tracking (life insurance, DPS, savings bonds up to ৳10 lakh)
- Generate tax summary for annual return filing
- Provident fund deduction tracking (employer + employee contribution)

#### 3.2.3 Deductibles Tracker
- Professional tax
- Provident fund contribution
- Loan EMI deductions
- Union/association fees
- Insurance premium (life, health)

---

### 3.3 Budget Planner (বাজেট পরিকল্পনা)

#### 3.3.1 Default Budget Templates
Users can start from pre-built templates:

**Template 1: Young Professional (সিঙ্গেল)**
Optimized for single earner, Dhaka-based

**Template 2: Young Family (নতুন পরিবার)**
Couple + 1 child, includes infant care categories

**Template 3: Extended Family (যৌথ পরিবার)**
Nuclear + extended family allowances

**Template 4: NRB Remittance Budget**
For managing money sent home from abroad

**Template 5: Custom**
Build from scratch

Each template includes:
- Pre-filled category structure
- Suggested allocation percentages
- Bangla labels alongside English
- Contextual tips per category

#### 3.3.2 Budget Categories (Default Set)

```
🏠 আবাসন (Housing)
  ├── বাসা ভাড়া (Rent)
  ├── সার্ভিস চার্জ (Service Charge)
  ├── গ্যাস (Gas)
  └── বাড়ি মেরামত (Maintenance)

⚡ ইউটিলিটি (Utilities)
  ├── বিদ্যুৎ (Electricity)
  ├── ইন্টারনেট (Internet)
  ├── পানি (Water)
  └── মোবাইল রিচার্জ (Mobile)

🛒 বাজার ও খাবার (Grocery & Food)
  ├── বাজার - মাছ/মাংস (Fish & Meat)
  ├── বাজার - সবজি (Vegetables)
  ├── বাজার - চাল/ডাল (Staples)
  ├── বাজার - ফল (Fruits)
  ├── বাইরের খাবার (Outside Food)
  └── রান্নাঘর সামগ্রী (Kitchen Items)

👶 শিশু পরিচর্যা (Child Care)
  ├── শিশু খাবার (Baby Food)
  ├── ডায়াপার (Diaper)
  ├── শিশু চিকিৎসা (Baby Medical)
  ├── খেলনা ও বই (Toys & Books)
  └── শিশু পোশাক (Baby Clothes)

🏫 শিক্ষা (Education)
  ├── স্কুল ফি (School Fees)
  ├── টিউশন (Tuition)
  ├── বই ও স্টেশনারি (Books & Stationery)
  └── কোচিং (Coaching)

🏥 স্বাস্থ্য (Health & Medical)
  ├── ওষুধ (Medicine)
  ├── ডাক্তার ফি (Doctor Fees)
  ├── ল্যাব টেস্ট (Lab Tests)
  ├── হাসপাতাল যাতায়াত (Hospital Commute)
  └── স্বাস্থ্য বীমা (Health Insurance)

🚗 যানবাহন (Transport)
  ├── মোটরসাইকেল তেল (Motorcycle Oil)
  ├── রিকশা/উবার (Rickshaw/Ride)
  ├── বাস/পাবলিক (Public Transport)
  └── গাড়ি রক্ষণাবেক্ষণ (Vehicle Maintenance)

👗 পোশাক (Clothing)
  ├── নিজের পোশাক (Personal Clothing)
  ├── পরিবারের পোশাক (Family Clothing)
  └── ঈদ/উৎসব পোশাক (Festival Clothing)

👨‍👩‍👧‍👦 পারিবারিক ভাতা (Family Allowances)
  ├── [configurable family members]
  └── গৃহকর্মী / বুয়া (Domestic Help)

💊 মেডিক্যাল (Member-specific)
  ├── [per family member]
  └── ওষুধ ট্র্যাকার (Medicine Tracker)

🎉 উৎসব ও বিনোদন (Festivals & Entertainment)
  ├── ঈদ খরচ (Eid Expenses)
  ├── বিনোদন (Entertainment)
  └── উপহার (Gifts)

💳 ঋণ ও EMI (Loans & EMI)
  ├── ব্যাংক লোন (Bank Loan)
  ├── ক্রেডিট কার্ড (Credit Card)
  └── ব্যক্তিগত ঋণ (Personal Loan)

💰 সঞ্চয় ও বিনিয়োগ (Savings & Investment)
  ├── পেনশন/প্রভিডেন্ট (Pension/PF)
  ├── জমানো (DPS/Savings)
  ├── সঞ্চয়পত্র (Sanchayapatra)
  └── মিউচুয়াল ফান্ড (Mutual Fund)

🏗 এককালীন খরচ (One-time/Irregular)
  ├── আসবাবপত্র (Furniture)
  ├── ইলেকট্রনিক্স (Electronics)
  └── বাড়ি সংস্কার (Home Renovation)
```

#### 3.3.3 Budget Rules Engine
- **50/30/20 Rule** — auto-apply: 50% needs, 30% wants, 20% savings
- **Custom split** — user defines percentages
- **Zero-based budgeting** — every taka assigned
- **Envelope method** — virtual envelope per category
- Rollover option (unused budget carries to next month)
- Budget lock (prevent overspend — warning or hard block)

---

### 3.4 Expense Tracker (খরচ ট্র্যাকার)

#### 3.4.1 Expense Entry
**Quick Add (< 5 seconds):**
- Voice input (Bangla + English)
- Smart parsing: type "bazar mach 500" → auto-categorizes
- Photo receipt upload (OCR extracts amount + merchant)
- Repeat last entry button

**Full Entry:**
- Date (default: today)
- Category → Sub-category
- Amount
- Description (Bangla/English)
- Payment method (Cash, bKash, Nagad, Card, Bank Transfer)
- Person (who spent / for whom)
- Tags (optional)
- Receipt photo
- Notes

#### 3.4.2 Payment Methods Tracking
| Method | Icon |
|---|---|
| নগদ (Cash) | 💵 |
| bKash | 📱 |
| Nagad | 📱 |
| Rocket | 📱 |
| Credit Card | 💳 |
| Debit Card | 💳 |
| Bank Transfer | 🏦 |

#### 3.4.3 Recurring Expenses
- Set up auto-entries (rent, internet, electricity)
- Due date reminders
- Mark as paid in one tap
- Skip month option

#### 3.4.4 Split Expenses
- Split among family members
- Track who paid what
- Settle balances

---

### 3.5 Family Member Management (পরিবার ব্যবস্থাপনা)

Each family member gets a profile:

```
Name | Relation | DOB | Budget Allocation
─────────────────────────────────────────
Safeer  | Son (5 months) | Feb 2026 | ৳18,000
Mim     | Wife           | —        | ৳10,000 + medical
Irfan   | Self           | —        | Primary account holder
Ammu    | Mother         | —        | ৳2,000/month
Yousha  | —              | —        | ৳2,000/month
Nuyera  | —              | —        | ৳2,000/month
Adib    | —              | —        | ৳1,000/month
```

**Per-member features:**
- Individual spending dashboard
- Medical history & medicine tracker
- Monthly allowance auto-debit
- Age-based smart suggestions (e.g. infant food tracker)
- School/education fee tracker per child

---

### 3.6 Ledger & Reporting (হিসাব ও রিপোর্ট)

#### 3.6.1 Ledger Views
- **Daily** — all expenses for a selected day
- **Weekly** — week-by-week breakdown
- **Monthly** — full month with budget vs. actual
- **Category** — drill into any category across time
- **Person** — per family member spending
- **Custom range** — pick any start/end date

#### 3.6.2 Reports
- **Monthly Summary Report** — income, expenses, savings, surplus
- **Category Analysis** — where money goes, trends
- **Budget vs. Actual** — variance report
- **Savings Progress** — goals tracking
- **Tax Summary** — annual tax position
- **Yearly Overview** — month-by-month comparison
- **Net Worth Report** — assets minus liabilities
- **Spending Patterns** — day-of-week, time-of-month analysis

#### 3.6.3 Export
- PDF (printable report)
- Excel/CSV (for manual analysis)
- Share via WhatsApp/Email

---

### 3.7 Savings & Goals (সঞ্চয় ও লক্ষ্য)

#### 3.7.1 Goal Types
- Emergency Fund (আপদকালীন তহবিল)
- Child Education Fund (সন্তানের শিক্ষা)
- Hajj/Umrah Fund
- Home Purchase
- Vehicle Purchase
- Wedding
- Custom goal

#### 3.7.2 Goal Features
- Target amount + target date
- Monthly contribution calculator
- Progress bar with projected completion date
- "What if I save more?" slider
- Link to specific savings account/DPS

#### 3.7.3 Investment Tracker
- Sanchayapatra (rate + maturity tracking)
- DPS (monthly contribution, bank, maturity)
- FDR (Fixed Deposit)
- Mutual Fund units
- Stocks (DSE)
- Gold holdings

---

### 3.8 Bills & Reminders (বিল ও অনুস্মারক)

- Recurring bill calendar
- Push notification reminders (1 day, 3 days before)
- Overdue bill alerts
- One-tap mark as paid
- Bill payment history

---

### 3.9 Debt Manager (ঋণ ব্যবস্থাপনা)

- Track loans (bank, personal, family)
- EMI calculator with amortization schedule
- Credit card balance tracker
- Payoff date projection
- Debt avalanche / snowball strategies
- Interest paid vs. principal tracker

---

### 3.10 Net Worth Tracker (সম্পদের হিসাব)

**Assets:**
- Cash & bank balance
- Savings instruments
- Property value
- Vehicle value
- Gold & jewelry
- Investment portfolio

**Liabilities:**
- Bank loans
- Credit card balance
- Personal debts

**Output:** Monthly net worth chart over time

---

## 4. AI Financial Advisor Module (AI আর্থিক উপদেষ্টা)
*Phase 2 — Post-launch*

### 4.1 Natural Language Query (Bangla + English)
Users can ask questions in plain language:

**Examples:**
- "এই মাসে আমি কত খরচ করেছি?" (How much did I spend this month?)
- "Safeer-এর diaper এ কত গেছে?" (How much on Safeer's diapers?)
- "আমার কোন category তে বেশি খরচ হচ্ছে?" (Which category is overspending?)
- "Next month এ আমি কত বাঁচাতে পারব?" (How much can I save next month?)
- "Show me all medical expenses in July"
- "বাজারে সবচেয়ে বেশি কোন দিন খরচ হয়?"

### 4.2 AI Insights Engine
Proactive suggestions without being asked:

| Insight Type | Example |
|---|---|
| Overspend alert | "Bazar is 80% used with 15 days left" |
| Pattern detection | "You spend 40% more on Fridays" |
| Anomaly detection | "Medical expense this month is 3x the average" |
| Savings opportunity | "Cutting outside food by ৳2,000 saves ৳24,000/year" |
| Goal projection | "At this rate, emergency fund ready in 4 months" |
| Tax optimization | "Invest ৳50,000 more in Sanchayapatra to save ৳5,000 in tax" |
| Baby milestone alerts | "Safeer turns 6 months — budget may change for food" |
| Seasonal warnings | "Eid is 45 days away — plan ৳15,000–20,000" |

### 4.3 AI Planning Mode
- "Plan my next month budget" → AI generates draft based on history
- "How do I save ৳1 lakh in 6 months?" → Custom plan
- "What if I take a ৳5 lakh loan?" → Impact simulation
- "Optimize my budget for maximum savings" → AI restructures

### 4.4 AI Features Roadmap
- Phase 2A: Natural language query (read-only)
- Phase 2B: AI budget generation & recommendations
- Phase 2C: Predictive spend forecasting
- Phase 2D: Voice assistant (Bangla TTS/STT)
- Phase 2E: WhatsApp bot integration (log expenses via chat)

---

## 5. Language & Localization (ভাষা)

### 5.1 Bilingual Support
- All UI labels in both English and Bengali simultaneously (or toggle)
- Currency: ৳ BDT primary, USD/SAR secondary
- Number formatting: Bangladeshi style (1,00,000 not 100,000)
- Date format: DD/MM/YYYY
- Fiscal year: July–June (BD government) OR January–December (user choice)

### 5.2 Bangla Input
- Native Bangla keyboard support
- Avro/Bijoy transliteration
- English phonetic Bangla (type "bazar" → বাজার auto-suggest)
- Voice input in Bangla

### 5.3 Regional Context
- BD-specific categories (bKash, Nagad, Sanchayapatra)
- BD tax slabs and rules
- Islamic finance options (halal investment tracking)
- Eid/Ramadan budget mode
- Zakat calculator

---

## 6. User Experience Design

### 6.1 Design Principles
- **Mobile-first** — 80% of users on phone
- **5-second rule** — adding an expense in under 5 seconds
- **Offline-first** — works without internet, syncs when connected
- **One thumb usability** — all key actions reachable with one hand
- **Progressive disclosure** — simple by default, powerful when needed

### 6.2 Key UX Flows

**Flow 1: Daily Expense Entry**
```
Home → Float Button (+) → Amount → Category → Done (3 taps)
```

**Flow 2: Month Review**
```
Home → Reports → Monthly → Tap Category → Drill Down → Share
```

**Flow 3: Budget Setup (First Time)**
```
Onboarding → Pick Template → Enter Income → Adjust Categories → Done
```

**Flow 4: AI Query**
```
Home → AI Button → Type/Speak Question → View Answer + Chart
```

### 6.3 Onboarding (প্রথমবার ব্যবহার)
5-step wizard:
1. Language selection (English / বাংলা)
2. Income setup (salary + sources)
3. Tax profile (TDS calculation)
4. Budget template selection
5. Family member setup

### 6.4 Notifications
- Daily spending summary (evening, 9 PM)
- Budget limit warnings (at 75% and 95%)
- Bill due reminders
- Monthly report ready
- Savings goal milestone reached
- AI weekly insight digest

---

## 7. Technical Architecture

### 7.1 Frontend
- **Framework:** React (PWA — installable on Android/iOS)
- **State:** Redux or Zustand
- **UI:** Tailwind CSS + custom component library
- **Charts:** Recharts / D3.js
- **Offline:** Service Workers + IndexedDB cache
- **i18n:** react-i18next (EN + BN)

### 7.2 Backend
- **API:** Node.js + Express or Next.js API routes
- **Database:** PostgreSQL (structured financial data)
- **Auth:** JWT + OTP via SMS (01XXXXXXXXX format)
- **Storage:** AWS S3 / Cloudflare R2 (receipt images)
- **Cache:** Redis (dashboard data)
- **Queue:** Bull (recurring expense jobs, reminders)

### 7.3 AI Layer (Phase 2)
- **LLM:** Claude API (claude-sonnet-4-6)
- **Context:** User's financial data passed as context
- **RAG:** Vector DB for financial knowledge base (BD tax laws, investment products)
- **Prompt:** System prompt with user's budget, categories, history
- **Languages:** Multilingual (EN + BN) natively handled

### 7.4 Security
- End-to-end encryption for financial data
- Biometric login (fingerprint / face)
- PIN lock
- Session timeout
- No financial data in AI training (opt-out by default)
- HTTPS only
- GDPR-aligned data handling

### 7.5 Integrations (Phase 2+)
- **bKash API** — auto-import transactions
- **Nagad API** — auto-import
- **Bank SMS parser** — read bank SMS for auto-expense logging
- **Google Sheets** — two-way sync
- **WhatsApp Bot** — log expense via message

---

## 8. Gaps Identified from Current Tracker

These were missing in the manual tracking we did and must be built in:

| Gap | Solution in App |
|---|---|
| Data lost on refresh | Persistent cloud storage + local cache |
| No tax awareness | Full TDS module |
| No savings tracking | Dedicated savings & goals module |
| Bazar too generic | Sub-categories: groceries, cloth, outside food |
| No payment method tracking | Cash / bKash / Card per entry |
| No recurring expense reminders | Bills & Reminders module |
| No net worth view | Asset & liability tracker |
| No year-on-year comparison | Annual reports |
| No credit card debt tracking | Debt manager module |
| No Eid/festival planning | Seasonal budget mode |
| No investment tracking | Investment portfolio module |
| No loan EMI tracking | Debt manager with amortization |
| No zakat calculator | Islamic finance module |
| Manual date entry (errors) | Smart date: today / yesterday / pick |
| No receipt capture | Camera → OCR → auto-entry |
| No multi-currency | BDT + USD/SAR for NRBs |
| No goal planning | Goals & savings module |
| Language barrier | Full Bangla UI + voice |

---

## 9. Monetization Model

| Tier | Price | Features |
|---|---|---|
| Free | ৳0 | 1 user, 3 months history, basic reports, 2 goals |
| Premium | ৳199/month | Unlimited history, AI advisor, all reports, receipt OCR, bank SMS sync |
| Family | ৳349/month | Up to 5 members, shared budget, family reports |
| Annual (Premium) | ৳1,799/year | ~25% discount |

---

## 10. Development Phases

### Phase 1 — MVP (Month 1–3)
- User auth (OTP login)
- Income + basic TDS
- Budget setup with templates
- Expense entry (manual)
- Category management
- Basic ledger & monthly report
- Bilingual UI (EN + BN)
- PWA (installable)

### Phase 2 — Core Features (Month 4–6)
- Family member management
- Recurring expenses & reminders
- Savings goals
- Investment tracker
- Debt manager
- Advanced reports (PDF export)
- Receipt photo upload
- bKash/Nagad SMS auto-import

### Phase 3 — AI Layer (Month 7–9)
- Natural language query (EN + BN)
- AI insights engine
- AI budget planning
- Predictive forecasting
- WhatsApp bot (expense logging)

### Phase 4 — Scale (Month 10–12)
- Bank API integration
- Full tax return assistance
- Business/freelancer mode
- NRB remittance features
- DSE stock portfolio tracker
- Multi-device sync

---

## 11. Success Metrics

| Metric | Target (6 months) |
|---|---|
| Active users | 5,000 |
| Daily active rate | >40% |
| Avg expenses logged/user/month | >30 |
| Premium conversion | >8% |
| App rating | >4.5 ★ |
| Expense entry time | <5 seconds |
| AI query satisfaction | >85% |

---

## 12. Competitive Landscape

| App | Weakness vs. This App |
|---|---|
| Money Manager | No Bangla, no BD tax, no AI |
| Wallet | No BD-specific categories, no family mode |
| YNAB | Too complex, English only, USD-focused |
| Manual Excel | No mobile, no reminders, no AI |
| bKash History | Only bKash transactions, no budgeting |

**Our edge:** Bangladesh-first design + AI in Bangla + infant/family care + tax-aware + offline-capable.

---

*Document Version 1.0 — Prepared July 2026*
*Ready for handoff to design and engineering team*
