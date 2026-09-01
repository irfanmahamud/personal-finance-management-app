/** Shared TanStack Query hooks for M2 resources. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, getAccessToken } from './api-client'
import { submitWrite } from './offline-queue'

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

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api<Settings>('/api/v1/settings'),
  })
}

export function usePatchSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Pick<Settings, 'household_name' | 'fiscal_year_start' | 'locale' | 'eid_mode_enabled'>>) =>
      api<Settings>('/api/v1/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: (data) => qc.setQueryData(['settings'], data),
  })
}

export function useCategories(includeArchived = false) {
  return useQuery({
    queryKey: ['categories', includeArchived],
    queryFn: () =>
      api<CategoryNode[]>(`/api/v1/categories?include_archived=${includeArchived}`),
  })
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

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { parent_id?: string | null; name_en: string; name_bn: string; icon?: string | null }) =>
      api<Category>('/api/v1/categories', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function usePatchCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string
      name_en?: string
      name_bn?: string
      archived?: boolean
      sort_order?: number
      need_want_save?: NeedWantSave | null
    }) => api(`/api/v1/categories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

// ---- Expenses (M3) ----

export interface Expense {
  id: string
  date: string
  category_id: string
  category_name_en: string
  category_name_bn: string
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

export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api<PaymentMethod[]>('/api/v1/payment-methods'),
  })
}

export function useRecent() {
  return useQuery({
    queryKey: ['expenses', 'recent'],
    queryFn: () => api<RecentOut>('/api/v1/expenses/recent'),
  })
}

export function useExpenses(
  filters: { date_from?: string; date_to?: string; category_id?: string; member_id?: string } = {},
) {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v != null) as [string, string][],
  )
  return useQuery({
    queryKey: ['expenses', 'list', filters],
    queryFn: () => api<{ items: Expense[]; total: number }>(`/api/v1/expenses?${params}`),
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    // Through the offline queue: 'saved' went to the server, 'queued' is
    // waiting in IndexedDB for reconnect (writes never fail - spec §6.1).
    mutationFn: (body: ExpenseCreate) =>
      submitWrite<Expense>('/api/v1/expenses', 'POST', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function usePatchExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; for_member_id?: string | null } & Partial<Omit<ExpenseCreate, 'client_uuid'>>) =>
      api<Expense>(`/api/v1/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

// ---- Receipt photo upload (Phase 2, storage only - no OCR) ----

export interface Receipt {
  id: string
  mime_type: string
  size_bytes: number
  created_at: string
}

export function useUploadReceipt() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const token = getAccessToken()
      const res = await fetch('/api/v1/receipts', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}) as { detail?: string })
        throw new ApiError(res.status, detail.detail ?? res.statusText)
      }
      return (await res.json()) as Receipt
    },
  })
}

/** Fetches a receipt image as an object URL the caller must revoke. */
export async function fetchReceiptUrl(receiptId: string): Promise<string> {
  const token = getAccessToken()
  const res = await fetch(`/api/v1/receipts/${receiptId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

// ---- Budgets (M4) ----

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

export function useCurrentBudget() {
  return useQuery({
    queryKey: ['budget', 'current'],
    queryFn: () => api<Budget>('/api/v1/budgets/current'),
    retry: (count, err) =>
      // 404 = no budget yet, a normal state - don't retry it.
      !(err instanceof Error && 'status' in err && (err as { status: number }).status === 404) && count < 1,
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      period_start?: string
      template?: string
      total_amount?: number
      lines?: { category_id: string; amount: number }[]
      apply_rollover?: boolean
      assignable_amount?: number
    }) => api<Budget>('/api/v1/budgets', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget'] }),
  })
}

export function useAddBudgetLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      budgetId,
      ...body
    }: {
      budgetId: string
      category_id: string
      amount: number
      rollover_enabled?: boolean
    }) => api<Budget>(`/api/v1/budgets/${budgetId}/lines`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget'] }),
  })
}

export function usePatchBudgetLine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ budgetId, lineId, ...patch }: { budgetId: string; lineId: string; amount?: number; rollover_enabled?: boolean }) =>
      api<Budget>(`/api/v1/budgets/${budgetId}/lines/${lineId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget'] }),
  })
}

export interface BudgetSummary {
  id: string
  period_start: string
  period_end: string
  method: string
  total_amount: number
  total_spent: number
}

export function useBudgetHistory(limit = 12) {
  return useQuery({
    queryKey: ['budget', 'history', limit],
    queryFn: () => api<BudgetSummary[]>(`/api/v1/budgets/history?limit=${limit}`),
  })
}

// period: "YYYY-MM"
export function useBudgetForPeriod(period: string | null) {
  return useQuery({
    queryKey: ['budget', 'period', period],
    queryFn: () => api<Budget>(`/api/v1/budgets/${period}`),
    enabled: period != null,
    retry: (count, err) =>
      !(err instanceof Error && 'status' in err && (err as { status: number }).status === 404) && count < 1,
  })
}

// ---- Reports (M5) ----

export interface CategorySpend {
  category_id: string
  name_en: string
  name_bn: string
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

export function useMonthlyReport(month: string) {
  return useQuery({
    queryKey: ['reports', 'monthly', month],
    queryFn: () => api<MonthlySummary>(`/api/v1/reports/monthly?month=${month}-01`),
  })
}

export function useBudgetVariance(month: string) {
  return useQuery({
    queryKey: ['reports', 'variance', month],
    queryFn: () => api<BudgetVariance>(`/api/v1/reports/budget-variance?month=${month}-01`),
    retry: false,
  })
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

export function useYearlyReport() {
  return useQuery({
    queryKey: ['reports', 'yearly'],
    queryFn: () => api<YearlySummary>('/api/v1/reports/yearly'),
  })
}

// ---- Income & tax (M6) ----

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
  amount: number
  frequency: string
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
}

export function useIncomeSources() {
  return useQuery({
    queryKey: ['income-sources'],
    queryFn: () => api<IncomeSource[]>('/api/v1/income-sources'),
  })
}

export function useCreateIncomeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; type: string; amount: number; taxable?: boolean; tds_at_source?: boolean; tds_amount_monthly?: number | null }) =>
      api<IncomeSource>('/api/v1/income-sources', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['income-sources'] })
      void qc.invalidateQueries({ queryKey: ['tax'] })
    },
  })
}

export function usePatchIncomeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; amount?: number; taxable?: boolean; active?: boolean; tds_at_source?: boolean; tds_amount_monthly?: number | null }) =>
      api<IncomeSource>(`/api/v1/income-sources/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['income-sources'] })
      void qc.invalidateQueries({ queryKey: ['tax'] })
    },
  })
}

export function useDeductions() {
  return useQuery({
    queryKey: ['deductions'],
    queryFn: () => api<Deduction[]>('/api/v1/deductions'),
  })
}

export function useCreateDeduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { type: string; amount: number }) =>
      api<Deduction>('/api/v1/deductions', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deductions'] })
      void qc.invalidateQueries({ queryKey: ['tax'] })
    },
  })
}

export function useDeleteDeduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/deductions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deductions'] })
      void qc.invalidateQueries({ queryKey: ['tax'] })
    },
  })
}

export function useTaxEstimate(enabled: boolean) {
  return useQuery({
    queryKey: ['tax', 'estimate'],
    queryFn: () => api<TaxEstimate>('/api/v1/tax/estimate'),
    enabled,
    retry: false,
  })
}

// ---- Description suggestions ----

export interface Suggestion {
  description: string
  category_id: string
  count: number
  last_used: string
}

/** Past descriptions for the household (optionally narrowed to a category),
 * fetched once and filtered client-side - no per-keystroke network. */
export function useDescriptionSuggestions(categoryId?: string, enabled = true) {
  const params = categoryId ? `?category_id=${categoryId}` : ''
  return useQuery({
    queryKey: ['expenses', 'suggestions', categoryId ?? 'all'],
    queryFn: () => api<Suggestion[]>(`/api/v1/expenses/suggestions${params}`),
    enabled,
    staleTime: 60_000,
  })
}

// ---- Family members (Phase 2, spec §3.5) ----

export interface Member {
  id: string
  name: string
  name_bn: string | null
  relation: string | null
  dob: string | null
  monthly_allowance: number // poisha
  active: boolean
}

export function useMembers(includeInactive = false) {
  return useQuery({
    queryKey: ['members', includeInactive],
    queryFn: () => api<Member[]>(`/api/v1/members?include_inactive=${includeInactive}`),
    staleTime: 300_000,
  })
}

export function useCreateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      name_bn?: string | null
      relation?: string | null
      dob?: string | null
      monthly_allowance?: number
    }) => api<Member>('/api/v1/members', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })
}

export function usePatchMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string
      name?: string
      name_bn?: string | null
      relation?: string | null
      dob?: string | null
      monthly_allowance?: number
      active?: boolean
    }) => api<Member>(`/api/v1/members/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })
}

// ---- Recurring expenses & bills (Phase 2, spec §3.4.5 / §3.8) ----

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
}

export function useRecurringRules(includeInactive = false) {
  return useQuery({
    queryKey: ['recurring', includeInactive],
    queryFn: () => api<RecurringRule[]>(`/api/v1/recurring?include_inactive=${includeInactive}`),
  })
}

export function useCreateRecurringRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      category_id: string
      amount: number
      payment_method_id?: string | null
      for_member_id?: string | null
      day_of_month: number
      notes?: string | null
    }) => api<RecurringRule>('/api/v1/recurring', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function usePatchRecurringRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string
      name?: string
      category_id?: string
      amount?: number
      payment_method_id?: string | null
      for_member_id?: string | null
      day_of_month?: number
      active?: boolean
      notes?: string | null
    }) => api<RecurringRule>(`/api/v1/recurring/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useDeleteRecurringRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/recurring/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

export function useMarkRecurringPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, date, amount }: { id: string; date?: string; amount?: number }) =>
      api<Expense>(`/api/v1/recurring/${id}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({ date, amount }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['budget'] })
    },
  })
}

export function useSkipRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<RecurringRule>(`/api/v1/recurring/${id}/skip`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }),
  })
}

// ---- Savings goals (Phase 2, spec §3.7) ----

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

export function useGoals(includeInactive = false) {
  return useQuery({
    queryKey: ['goals', includeInactive],
    queryFn: () => api<Goal[]>(`/api/v1/savings/goals?include_inactive=${includeInactive}`),
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      name_bn?: string | null
      goal_type: Goal['goal_type']
      target_amount: number
      target_date?: string | null
      priority?: number
    }) => api<Goal>('/api/v1/savings/goals', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function usePatchGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string
      name?: string
      name_bn?: string | null
      goal_type?: Goal['goal_type']
      target_amount?: number
      target_date?: string | null
      priority?: number
      active?: boolean
    }) => api<Goal>(`/api/v1/savings/goals/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useGoalContributions(goalId: string | null) {
  return useQuery({
    queryKey: ['goals', 'contributions', goalId],
    queryFn: () => api<GoalContribution[]>(`/api/v1/savings/goals/${goalId}/contributions`),
    enabled: goalId != null,
  })
}

export function useAddContribution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, date, amount, notes }: { goalId: string; date?: string; amount: number; notes?: string | null }) =>
      api<Goal>(`/api/v1/savings/goals/${goalId}/contributions`, {
        method: 'POST',
        body: JSON.stringify({ date, amount, notes }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      qc.invalidateQueries({ queryKey: ['goals', 'contributions', vars.goalId] })
    },
  })
}

export function useAllocationSuggestion() {
  return useQuery({
    queryKey: ['goals', 'allocation-suggestion'],
    queryFn: () => api<AllocationSuggestionOut>('/api/v1/savings/allocation-suggestion'),
  })
}

// ---- Investments (Phase 2, spec §3.7A) ----

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

export function useInvestments(includeInactive = false) {
  return useQuery({
    queryKey: ['investments', includeInactive],
    queryFn: () => api<Investment[]>(`/api/v1/investments?include_inactive=${includeInactive}`),
  })
}

export function usePortfolio() {
  return useQuery({
    queryKey: ['investments', 'portfolio'],
    queryFn: () => api<Portfolio>('/api/v1/investments/portfolio'),
  })
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

export function useCreateInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: InvestmentCreate) =>
      api<Investment>('/api/v1/investments', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  })
}

export function usePatchInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<InvestmentCreate> & { active?: boolean }) =>
      api<Investment>(`/api/v1/investments/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  })
}

export function useDeleteInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/investments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investments'] }),
  })
}

// ---- Debt manager (Phase 2, spec §3.9) ----

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

export function useDebts(includeInactive = false) {
  return useQuery({
    queryKey: ['debts', includeInactive],
    queryFn: () => api<Debt[]>(`/api/v1/debts?include_inactive=${includeInactive}`),
  })
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

export function useCreateDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: DebtCreate) =>
      api<Debt>('/api/v1/debts', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })
}

export function usePatchDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<DebtCreate> & { active?: boolean }) =>
      api<Debt>(`/api/v1/debts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })
}

export function useDeleteDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/debts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  })
}

export function useDebtPayments(debtId: string | null) {
  return useQuery({
    queryKey: ['debts', 'payments', debtId],
    queryFn: () => api<DebtPayment[]>(`/api/v1/debts/${debtId}/payments`),
    enabled: debtId != null,
  })
}

export function useAddDebtPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ debtId, date, amount, notes }: { debtId: string; date?: string; amount: number; notes?: string | null }) =>
      api<Debt>(`/api/v1/debts/${debtId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ date, amount, notes }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['debts', 'payments', vars.debtId] })
    },
  })
}

export function useEmiCalculator(principal: number | null, annualRateBps: number | null, termMonths: number | null) {
  const enabled = principal != null && principal > 0 && annualRateBps != null && annualRateBps >= 0 && termMonths != null && termMonths > 0
  return useQuery({
    queryKey: ['debts', 'emi-calculator', principal, annualRateBps, termMonths],
    queryFn: () =>
      api<EmiCalculation>(
        `/api/v1/debts/emi-calculator?principal=${principal}&annual_rate_bps=${annualRateBps}&term_months=${termMonths}`,
      ),
    enabled,
  })
}

export function usePayoffComparison(extraMonthly: number) {
  return useQuery({
    queryKey: ['debts', 'payoff-comparison', extraMonthly],
    queryFn: () => api<PayoffComparison>(`/api/v1/debts/payoff-comparison?extra_monthly=${extraMonthly}`),
  })
}

// ---- Net worth (Phase 2, spec §3.10) ----

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

export function useNetWorth() {
  return useQuery({
    queryKey: ['networth', 'current'],
    queryFn: () => api<NetWorthBreakdown>('/api/v1/networth/current'),
  })
}

export function useNetWorthHistory(limit = 24) {
  return useQuery({
    queryKey: ['networth', 'history', limit],
    queryFn: () => api<NetWorthSnapshot[]>(`/api/v1/networth/history?limit=${limit}`),
  })
}

export function useAssets(includeInactive = false) {
  return useQuery({
    queryKey: ['networth', 'assets', includeInactive],
    queryFn: () => api<Asset[]>(`/api/v1/networth/assets?include_inactive=${includeInactive}`),
  })
}

export interface AssetCreate {
  category: AssetCategory
  name: string
  value: number
  valued_on?: string | null
  notes?: string | null
}

function invalidateNetWorth(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['networth'] })
}

export function useCreateAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AssetCreate) =>
      api<Asset>('/api/v1/networth/assets', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateNetWorth(qc),
  })
}

export function usePatchAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<AssetCreate> & { active?: boolean }) =>
      api<Asset>(`/api/v1/networth/assets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateNetWorth(qc),
  })
}

export function useDeleteAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/networth/assets/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateNetWorth(qc),
  })
}

// ---- Zakat calculator (Phase 2, spec §5.3) ----

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

export function useZakatEstimate() {
  return useQuery({
    queryKey: ['zakat', 'estimate'],
    queryFn: () => api<ZakatEstimate>('/api/v1/zakat/estimate'),
  })
}

export function useZakatConfig() {
  return useQuery({
    queryKey: ['zakat', 'config'],
    queryFn: () => api<ZakatConfig>('/api/v1/zakat/config'),
  })
}

export function usePatchZakatConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: { nisab_threshold?: number; rate_bps?: number; verified?: boolean }) =>
      api<ZakatConfig>('/api/v1/zakat/config', { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zakat'] })
    },
  })
}

// ---- Insights (Phase 3, deterministic tier - spec §4.2 rows 1-5) ----

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

export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: () => api<Insight[]>('/api/v1/insights'),
  })
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

export function useSpendingTimeseries(
  granularity: TimeseriesGranularity,
  dateFrom?: string,
  dateTo?: string,
) {
  const params = new URLSearchParams({ granularity })
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  return useQuery({
    queryKey: ['reports', 'timeseries', granularity, dateFrom, dateTo],
    queryFn: () => api<SpendingTimeseries>(`/api/v1/reports/timeseries?${params}`),
  })
}
