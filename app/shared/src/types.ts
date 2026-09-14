export type NeedWantSave = 'need' | 'want' | 'save'

export interface CategoryNode {
  id: string
  parent_id: string | null
  name_en: string
  name_bn: string
  icon: string | null
  sort_order: number
  archived: boolean
  need_want_save: NeedWantSave | null
  children: Omit<CategoryNode, 'children'>[]
}

export interface Settings {
  household_id: string
  household_name: string
  fiscal_year_start: number
  base_currency: string
  locale: 'en' | 'bn'
  eid_mode_enabled: boolean
}

export interface Category {
  id: string
  parent_id: string | null
  name_en: string
  name_bn: string
  icon: string | null
  sort_order: number
  archived: boolean
}

export interface Expense {
  id: string
  date: string
  // Null when the sub-category this expense was logged under has since
  // been deleted (Settings > Categories) - shown as "Uncategorized".
  category_id: string | null
  category_name_en: string | null
  category_name_bn: string | null
  amount: number // poisha
  currency: string
  amount_bdt: number
  description: string | null
  payment_method_id: string | null
  logged_by_user_id: string
  for_member_id: string | null
  notes: string | null
  receipt_id: string | null
  created_at: string
  client_uuid: string
}

export interface ExpenseCreate {
  client_uuid: string
  date: string
  category_id: string
  amount: number
  description?: string | null
  payment_method_id?: string | null
  for_member_id?: string | null
  notes?: string | null
  receipt_id?: string | null
}

export interface RecentOut {
  last: Expense | null
  category_ranking: string[]
}

export interface PaymentMethod {
  id: string
  name: string
  name_bn: string | null
  icon: string | null
  sort_order: number
}

export interface Receipt {
  id: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export interface BudgetLine {
  id: string
  category_id: string
  category_name_en: string
  category_name_bn: string
  icon: string | null
  amount: number
  rolled_over_amount: number
  spent: number
  available: number
  status: 'ok' | 'warn75' | 'warn95'
  rollover_enabled: boolean
}

export interface Budget {
  id: string
  period_start: string
  period_end: string
  fiscal_year: string
  method: string
  total_amount: number
  total_spent: number
  lines: BudgetLine[]
  assignable_amount: number | null
  unassigned_amount: number | null
}

export interface BudgetSummary {
  id: string
  period_start: string
  period_end: string
  method: string
  total_amount: number
  total_spent: number
}

export interface CategorySpend {
  // All null together = the "Uncategorized" bucket (a deleted sub-category).
  category_id: string | null
  name_en: string | null
  name_bn: string | null
  icon: string | null
  spent: number
  entries: number
}

export interface MonthlySummary {
  period_start: string
  period_end: string
  fiscal_year: string
  income: number
  total_spent: number
  surplus: number
  entries: number
  by_category: CategorySpend[]
  daily: { date: string; spent: number }[]
}

export interface BudgetVariance {
  period_start: string
  period_end: string
  lines: {
    category_id: string
    name_en: string
    name_bn: string
    icon: string | null
    budgeted: number
    spent: number
    variance: number
  }[]
  total_budgeted: number
  total_spent: number
}

export interface CategoryReport {
  date_from: string
  date_to: string
  total_spent: number
  by_category: CategorySpend[]
  subcategories: CategorySpend[] | null
}

export interface YearlyMonthPoint {
  month: string
  income: number
  spent: number
  surplus: number
}

export interface YearlySummary {
  fiscal_year: string
  months: YearlyMonthPoint[]
  total_income: number
  total_spent: number
  total_surplus: number
}

export interface IncomeSource {
  id: string
  name: string
  type: string
  currency: string
  amount: number
  amount_bdt: number
  frequency: string
  taxable: boolean
  tds_at_source: boolean
  tds_amount_monthly: number | null
  active: boolean
}

export interface Deduction {
  id: string
  type: string
  amount: number // computed effective monthly employee amount, poisha
  frequency: string
  income_source_id: string | null
  percentage_bps: number | null
  employer_match_bps: number | null
  employer_amount: number // poisha/month - not part of take-home (e.g. employer PF match)
}

export interface TaxEstimate {
  fiscal_year: string
  verified: boolean
  gross_annual: number
  exemption: number
  taxable_annual: number
  gross_tax: number
  rebate: number
  net_tax_annual: number
  monthly_tds: number
  lines: { label: string; detail: string; amount: number }[]
  withheld_annual: number
  remaining_payable_annual: number
  monthly_withheld: number
  monthly_set_aside: number
  monthly_gross: number
  monthly_deductions: number
  monthly_net: number
  provident_fund_employer_monthly: number
}

export interface DeductionCreate {
  type: string
  amount?: number
  income_source_id?: string | null
  percentage_bps?: number | null
  employer_match_bps?: number | null
}

export interface OneTimeIncome {
  id: string
  label: string
  amount: number
  date: string
  taxable: boolean
  notes: string | null
}

export interface OneTimeIncomeCreate {
  label: string
  amount: number
  date: string
  taxable?: boolean
  notes?: string | null
}

export interface Suggestion {
  description: string
  category_id: string
  count: number
  last_used: string
}

export interface Member {
  id: string
  name: string
  name_bn: string | null
  relation: string | null
  dob: string | null
  monthly_allowance: number // poisha
  active: boolean
}

export interface RecurringRule {
  id: string
  name: string
  category_id: string
  category_name_en: string
  category_name_bn: string
  icon: string | null
  amount: number // poisha
  payment_method_id: string | null
  for_member_id: string | null
  day_of_month: number
  next_due_date: string
  status: 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'inactive'
  active: boolean
  notes: string | null
  last_paid_date: string | null
  investment_id: string | null
  investment_name: string | null
}

export interface Goal {
  id: string
  name: string
  name_bn: string | null
  goal_type: 'emergency_fund' | 'child_education' | 'hajj_umrah' | 'home' | 'vehicle' | 'wedding' | 'custom'
  target_amount: number // poisha
  target_date: string | null
  priority: number
  active: boolean
  total_contributed: number
  progress_pct: number
  remaining: number
  achieved: boolean
  avg_monthly_contribution: number | null
  projected_completion_date: string | null
  milestones_reached: number[]
}

export interface GoalContribution {
  id: string
  date: string
  amount: number
  notes: string | null
}

export interface AllocationSuggestion {
  goal_id: string
  goal_name: string
  suggested_amount: number
}

export interface AllocationSuggestionOut {
  monthly_income: number
  spent_so_far: number
  surplus: number
  suggestions: AllocationSuggestion[]
}

export type InstrumentType =
  | 'dps'
  | 'fdr'
  | 'sanchayapatra'
  | 'pension'
  | 'provident_fund'
  | 'business'
  | 'mutual_fund_gold'

export interface Investment {
  id: string
  instrument_type: InstrumentType
  name: string
  amount: number // poisha
  rate_bps: number | null
  start_date: string | null
  maturity_date: string | null
  tenure_months: number | null
  auto_renewal: boolean
  current_value: number | null
  effective_value: number
  projected_maturity_value: number | null
  rebate_eligible: boolean
  zakatable: boolean
  active: boolean
  notes: string | null
  maturity_status: 'overdue' | 'renewal_due' | 'maturity_soon' | 'upcoming' | 'none'
  // Business investment sub-module (§3.7A.1) - zero/null for every other type.
  total_capital_in: number
  total_capital_out: number
  total_profit_withdrawn: number
  simple_roi_bps: number | null
}

export type InvestmentTransactionType = 'capital_in' | 'capital_out' | 'profit_withdrawal'

export interface InvestmentTransaction {
  id: string
  investment_id: string
  type: InvestmentTransactionType
  amount: number // poisha
  date: string
  notes: string | null
}

export interface PortfolioByType {
  instrument_type: InstrumentType
  count: number
  invested: number
  current_value: number
}

export interface Portfolio {
  total_invested: number
  total_current_value: number
  by_type: PortfolioByType[]
  next_maturities: Investment[]
}

export interface InvestmentCreate {
  instrument_type: InstrumentType
  name: string
  amount: number
  rate_bps?: number | null
  start_date?: string | null
  maturity_date?: string | null
  tenure_months?: number | null
  auto_renewal?: boolean
  current_value?: number | null
  rebate_eligible?: boolean
  zakatable?: boolean
  notes?: string | null
}

export type DebtType = 'bank_loan' | 'personal_loan' | 'family_loan' | 'credit_card'

export interface Debt {
  id: string
  name: string
  lender: string | null
  debt_type: DebtType
  principal: number // poisha
  current_balance: number
  interest_rate_bps: number | null
  term_months: number | null
  minimum_payment: number | null
  start_date: string | null
  active: boolean
  notes: string | null
  paid_off: boolean
  total_paid: number
  total_interest_paid: number
  total_principal_paid: number
  calculated_emi: number | null
  avg_monthly_payment: number | null
  projected_payoff_date: string | null
}

export interface DebtPayment {
  id: string
  date: string
  amount: number
  interest_portion: number
  principal_portion: number
  notes: string | null
}

export interface AmortizationRow {
  month: number
  payment: number
  interest: number
  principal: number
  balance: number
}

export interface EmiCalculation {
  emi: number
  total_payment: number
  total_interest: number
  schedule: AmortizationRow[]
}

export interface PayoffStrategy {
  order: string[]
  months_to_debt_free: number | null
  total_interest_paid: number
}

export interface PayoffComparison {
  extra_monthly: number
  avalanche: PayoffStrategy
  snowball: PayoffStrategy
}

export interface DebtCreate {
  name: string
  lender?: string | null
  debt_type: DebtType
  principal: number
  current_balance?: number | null
  interest_rate_bps?: number | null
  term_months?: number | null
  minimum_payment?: number | null
  start_date?: string | null
  notes?: string | null
}

export interface LoanGiven {
  id: string
  borrower_name: string
  borrower_contact: string | null
  principal: number // poisha
  current_balance: number
  interest_rate_bps: number | null // null = interest-free
  start_date: string | null
  due_date: string | null
  active: boolean
  notes: string | null
  paid_off: boolean
  status: 'overdue' | 'due_soon' | 'upcoming' | 'no_due_date' | 'paid_off' | 'inactive'
  total_repaid: number
  total_interest_earned: number
  total_principal_repaid: number
}

export interface LoanGivenPayment {
  id: string
  date: string
  amount: number
  interest_portion: number
  principal_portion: number
  notes: string | null
}

export interface LoanSummary {
  total_outstanding: number
  total_lent: number
  total_repaid: number
  total_interest_earned: number
  active_count: number
  overdue_count: number
}

export interface LoanGivenCreate {
  borrower_name: string
  borrower_contact?: string | null
  principal: number
  interest_rate_bps?: number | null
  start_date?: string | null
  due_date?: string | null
  notes?: string | null
  // Whether handing over this loan should also log an Expense (real cash
  // leaving now). Off by default - e.g. backfilling a loan given before
  // the household started tracking shouldn't hit spending.
  log_as_expense?: boolean
  category_id?: string | null // required when log_as_expense is true
  payment_method_id?: string | null
  for_member_id?: string | null
}

export type AssetCategory = 'cash_bank' | 'property' | 'vehicle' | 'gold_jewelry' | 'other'

export interface Asset {
  id: string
  category: AssetCategory
  name: string
  value: number // poisha
  valued_on: string
  logged_by_user_id: string
  active: boolean
  notes: string | null
}

export interface NetWorthBreakdown {
  cash_bank: number
  property: number
  vehicle: number
  gold_jewelry: number
  other: number
  investments: number
  total_assets: number
  total_liabilities: number
  net_worth: number
  as_of: string
}

export interface NetWorthSnapshot {
  id: string
  snapshot_date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
}

export interface AssetCreate {
  category: AssetCategory
  name: string
  value: number
  valued_on?: string | null
  notes?: string | null
}

export interface ZakatEstimate {
  cash_and_bank: number
  gold_and_jewelry: number
  zakatable_investments: number
  liabilities: number
  zakatable_wealth: number
  nisab_threshold: number
  meets_nisab: boolean
  rate_bps: number
  zakat_due: number
  verified: boolean
}

export interface ZakatConfig {
  id: string
  nisab_threshold: number
  rate_bps: number
  effective_from: string
  verified: boolean
}

export interface Insight {
  type: 'overspend' | 'pattern' | 'anomaly' | 'savings_opportunity' | 'goal_projection'
  severity: 'info' | 'warning'
  category_id: string | null
  category_name_en: string | null
  category_name_bn: string | null
  pct: number | null
  days_left: number | null
  weekday: number | null // 0=Sunday..6=Saturday
  extra_pct: number | null
  multiplier: number | null
  cut_amount: number | null
  annual_savings: number | null
  goal_id: string | null
  goal_name: string | null
  goal_name_bn: string | null
  months_remaining: number | null
  projected_completion_date: string | null
}

export type TimeseriesGranularity = 'day' | 'week' | 'month'

export interface TimeseriesPoint {
  period: string
  spent: number
}

export interface SpendingTimeseries {
  granularity: TimeseriesGranularity
  date_from: string
  date_to: string
  points: TimeseriesPoint[]
  total_spent: number
}
