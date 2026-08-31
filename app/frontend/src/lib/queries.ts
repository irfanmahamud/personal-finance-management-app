/** Shared TanStack Query hooks for M2 resources. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api-client'
import { submitWrite } from './offline-queue'

export interface CategoryNode {
  id: string
  parent_id: string | null
  name_en: string
  name_bn: string
  icon: string | null
  sort_order: number
  archived: boolean
  children: Omit<CategoryNode, 'children'>[]
}

export interface Settings {
  household_id: string
  household_name: string
  fiscal_year_start: number
  base_currency: string
  locale: 'en' | 'bn'
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
    mutationFn: (patch: Partial<Pick<Settings, 'household_name' | 'fiscal_year_start' | 'locale'>>) =>
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

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { parent_id?: string | null; name_en: string; name_bn: string; icon?: string | null }) =>
      api('/api/v1/categories', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function usePatchCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name_en?: string; name_bn?: string; archived?: boolean; sort_order?: number }) =>
      api(`/api/v1/categories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
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

export function useExpenses(filters: { date_from?: string; date_to?: string; category_id?: string } = {}) {
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
    mutationFn: (body: { template?: string; total_amount?: number; lines?: { category_id: string; amount: number }[] }) =>
      api<Budget>('/api/v1/budgets', { method: 'POST', body: JSON.stringify(body) }),
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

// ---- Members (read-only in Phase 1 - attribution only) ----

export interface Member {
  id: string
  name: string
  name_bn: string | null
  relation: string | null
  active: boolean
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: () => api<Member[]>('/api/v1/members'),
    staleTime: 300_000,
  })
}
