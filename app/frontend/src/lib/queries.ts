/** Shared TanStack Query hooks for M2 resources. */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api-client'

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
    mutationFn: (body: ExpenseCreate) =>
      api<Expense>('/api/v1/expenses', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function usePatchExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<Omit<ExpenseCreate, 'client_uuid'>>) =>
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
