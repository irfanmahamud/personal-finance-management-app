/** Shared TanStack Query hooks for M2 resources.
 *
 * The domain interfaces these hooks return live in @app/shared (types.ts)
 * so app/mobile shares the exact same shapes. They are re-exported here
 * unchanged, so every screen's existing `from '../lib/queries'` import
 * keeps working. */

import type {
  NeedWantSave,
  CategoryNode,
  Settings,
  Category,
  Expense,
  ExpenseCreate,
  RecentOut,
  PaymentMethod,
  Receipt,
  Budget,
  BudgetSummary,
  MonthlySummary,
  BudgetVariance,
  CategoryReport,
  YearlySummary,
  IncomeSource,
  Deduction,
  TaxEstimate,
  DeductionCreate,
  OneTimeIncome,
  OneTimeIncomeCreate,
  Suggestion,
  Member,
  RecurringRule,
  Goal,
  GoalContribution,
  AllocationSuggestionOut,
  Investment,
  InvestmentTransactionType,
  InvestmentTransaction,
  Portfolio,
  InvestmentCreate,
  Debt,
  DebtPayment,
  EmiCalculation,
  PayoffComparison,
  DebtCreate,
  LoanGiven,
  LoanGivenPayment,
  LoanSummary,
  LoanGivenCreate,
  Asset,
  NetWorthBreakdown,
  NetWorthSnapshot,
  AssetCreate,
  ZakatEstimate,
  ZakatConfig,
  Insight,
  TimeseriesGranularity,
  SpendingTimeseries,
} from '@app/shared'

export type {
  NeedWantSave,
  CategoryNode,
  Settings,
  Category,
  Expense,
  ExpenseCreate,
  RecentOut,
  PaymentMethod,
  Receipt,
  BudgetLine,
  Budget,
  BudgetSummary,
  CategorySpend,
  MonthlySummary,
  BudgetVariance,
  CategoryReport,
  YearlyMonthPoint,
  YearlySummary,
  IncomeSource,
  Deduction,
  TaxEstimate,
  DeductionCreate,
  OneTimeIncome,
  OneTimeIncomeCreate,
  Suggestion,
  Member,
  RecurringRule,
  Goal,
  GoalContribution,
  AllocationSuggestion,
  AllocationSuggestionOut,
  InstrumentType,
  Investment,
  InvestmentTransactionType,
  InvestmentTransaction,
  PortfolioByType,
  Portfolio,
  InvestmentCreate,
  DebtType,
  Debt,
  DebtPayment,
  AmortizationRow,
  EmiCalculation,
  PayoffStrategy,
  PayoffComparison,
  DebtCreate,
  LoanGiven,
  LoanGivenPayment,
  LoanSummary,
  LoanGivenCreate,
  AssetCategory,
  Asset,
  NetWorthBreakdown,
  NetWorthSnapshot,
  AssetCreate,
  ZakatEstimate,
  ZakatConfig,
  Insight,
  TimeseriesGranularity,
  TimeseriesPoint,
  SpendingTimeseries,
} from '@app/shared'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, getAccessToken } from './api-client'
import { submitWrite } from './offline-queue'

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

/** Hard delete - sub-categories only (services/categories.py enforces this
 * server-side too). Every expense logged under it becomes Uncategorized
 * rather than being blocked or deleted, so both expenses and reports need
 * a refetch alongside categories. */
export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] })
      void qc.invalidateQueries({ queryKey: ['expenses'] })
      void qc.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}

// ---- Expenses (M3) ----

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
    mutationFn: (
      { id, ...patch }: { id: string; for_member_id?: string | null } & Partial<Omit<ExpenseCreate, 'client_uuid' | 'category_id'>> & {
        // Explicit null lets EditRow revert an already-Uncategorized expense
        // back to a real category, or leave it null on unrelated saves.
        category_id?: string | null
      },
    ) => api<Expense>(`/api/v1/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] })
      // A category (or amount/date) change moves which budget line this
      // expense counts against - budget/report totals must refetch too.
      void qc.invalidateQueries({ queryKey: ['budget'] })
      void qc.invalidateQueries({ queryKey: ['reports'] })
    },
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

/** Sub-category spend breakdown for one top-level category within a date
 * range - the Reports "by category" list's drill-down. */
export function useCategoryReport(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  categoryId: string | null,
) {
  return useQuery({
    queryKey: ['reports', 'category', dateFrom, dateTo, categoryId],
    queryFn: () =>
      api<CategoryReport>(
        `/api/v1/reports/category?date_from=${dateFrom}&date_to=${dateTo}&category_id=${categoryId}`,
      ),
    enabled: dateFrom != null && dateTo != null && categoryId != null,
  })
}

export function useYearlyReport() {
  return useQuery({
    queryKey: ['reports', 'yearly'],
    queryFn: () => api<YearlySummary>('/api/v1/reports/yearly'),
  })
}

// ---- Income & tax (M6) ----

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
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string
      name?: string
      type?: string
      amount?: number
      frequency?: string
      taxable?: boolean
      active?: boolean
      tds_at_source?: boolean
      tds_amount_monthly?: number | null
    }) => api<IncomeSource>(`/api/v1/income-sources/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['income-sources'] })
      void qc.invalidateQueries({ queryKey: ['deductions'] }) // percentage-based ones recompute
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
    mutationFn: (body: DeductionCreate) =>
      api<Deduction>('/api/v1/deductions', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deductions'] })
      void qc.invalidateQueries({ queryKey: ['tax'] })
    },
  })
}

export function usePatchDeduction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Omit<DeductionCreate, 'type'>) =>
      api<Deduction>(`/api/v1/deductions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
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

// ---- One-time income ----
// Ad-hoc income events (a bonus, a one-off payment, a gift) - distinct from
// the standing recurring IncomeSource. Always counts toward the calendar
// month it's dated in (reports/monthly's income figure); a taxable one also
// feeds tax/estimate's gross_annual for the current fiscal year - both
// server-computed, so both query keys get invalidated here.

export function useOneTimeIncome() {
  return useQuery({
    queryKey: ['one-time-income'],
    queryFn: () => api<OneTimeIncome[]>('/api/v1/one-time-income'),
  })
}

function invalidateOneTimeIncome(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['one-time-income'] })
  void qc.invalidateQueries({ queryKey: ['reports'] })
  void qc.invalidateQueries({ queryKey: ['tax'] })
}

export function useCreateOneTimeIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: OneTimeIncomeCreate) =>
      api<OneTimeIncome>('/api/v1/one-time-income', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateOneTimeIncome(qc),
  })
}

export function usePatchOneTimeIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<OneTimeIncomeCreate>) =>
      api<OneTimeIncome>(`/api/v1/one-time-income/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateOneTimeIncome(qc),
  })
}

export function useDeleteOneTimeIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/one-time-income/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateOneTimeIncome(qc),
  })
}

// ---- Description suggestions ----

/** Past descriptions for the household (optionally narrowed to a category),
 * fetched once and filtered client-side - no per-keystroke network. */
export function useDescriptionSuggestions(categoryId?: string | null, enabled = true) {
  const params = categoryId ? `?category_id=${categoryId}` : ''
  return useQuery({
    queryKey: ['expenses', 'suggestions', categoryId ?? 'all'],
    queryFn: () => api<Suggestion[]>(`/api/v1/expenses/suggestions${params}`),
    enabled,
    staleTime: 60_000,
  })
}

// ---- Family members (Phase 2, spec §3.5) ----

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
      investment_id?: string | null
    }) => api<RecurringRule>('/api/v1/recurring', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recurring'] })
      void qc.invalidateQueries({ queryKey: ['investments'] })
    },
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
      investment_id?: string | null
      clear_investment?: boolean
    }) => api<RecurringRule>(`/api/v1/recurring/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recurring'] })
      void qc.invalidateQueries({ queryKey: ['investments'] })
    },
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
      qc.invalidateQueries({ queryKey: ['investments'] })
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

export function useInvestmentTransactions(investmentId: string | null) {
  return useQuery({
    queryKey: ['investments', 'transactions', investmentId],
    queryFn: () => api<InvestmentTransaction[]>(`/api/v1/investments/${investmentId}/transactions`),
    enabled: investmentId != null,
  })
}

export function useAddInvestmentTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      investmentId,
      type,
      amount,
      date,
      notes,
    }: {
      investmentId: string
      type: InvestmentTransactionType
      amount: number
      date?: string
      notes?: string | null
    }) =>
      api<Investment>(`/api/v1/investments/${investmentId}/transactions`, {
        method: 'POST',
        body: JSON.stringify({ type, amount, date, notes }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['investments'] })
      qc.invalidateQueries({ queryKey: ['investments', 'transactions', vars.investmentId] })
    },
  })
}

// ---- Debt manager (Phase 2, spec §3.9) ----

export function useDebts(includeInactive = false) {
  return useQuery({
    queryKey: ['debts', includeInactive],
    queryFn: () => api<Debt[]>(`/api/v1/debts?include_inactive=${includeInactive}`),
  })
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

// ---- Loans given (money lent to people, not spec-numbered) ----

export function useLoans(includeInactive = false) {
  return useQuery({
    queryKey: ['loans', includeInactive],
    queryFn: () => api<LoanGiven[]>(`/api/v1/loans?include_inactive=${includeInactive}`),
  })
}

export function useLoanSummary() {
  return useQuery({
    queryKey: ['loans', 'summary'],
    queryFn: () => api<LoanSummary>('/api/v1/loans/summary'),
  })
}

export function useCreateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LoanGivenCreate) =>
      api<LoanGiven>('/api/v1/loans', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      // log_as_expense may have created an Expense row against the budget.
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['budget'] })
    },
  })
}

export function usePatchLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...patch
    }: {
      id: string
      borrower_name?: string
      borrower_contact?: string | null
      principal?: number
      current_balance?: number
      interest_rate_bps?: number | null
      start_date?: string | null
      due_date?: string | null
      active?: boolean
      notes?: string | null
    }) => api<LoanGiven>(`/api/v1/loans/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans'] }),
  })
}

export function useDeleteLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/api/v1/loans/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loans'] }),
  })
}

export function useLoanPayments(loanId: string | null) {
  return useQuery({
    queryKey: ['loans', 'payments', loanId],
    queryFn: () => api<LoanGivenPayment[]>(`/api/v1/loans/${loanId}/payments`),
    enabled: loanId != null,
  })
}

export function useAddLoanPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ loanId, date, amount, notes }: { loanId: string; date?: string; amount: number; notes?: string | null }) =>
      api<LoanGiven>(`/api/v1/loans/${loanId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ date, amount, notes }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loans', 'payments', vars.loanId] })
    },
  })
}

// ---- Net worth (Phase 2, spec §3.10) ----

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

export function useInsights() {
  return useQuery({
    queryKey: ['insights'],
    queryFn: () => api<Insight[]>('/api/v1/insights'),
  })
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
