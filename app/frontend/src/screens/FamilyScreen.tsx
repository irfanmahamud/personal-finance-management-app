import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTakaSigned, parseTakaInput, type Locale } from '../lib/money'
import {
  useCreateMember,
  useExpenses,
  useMembers,
  usePatchMember,
  type Member,
} from '../lib/queries'

const RELATIONS = ['spouse', 'child', 'parent', 'sibling', 'other'] as const

function monthRange(): { from: string; to: string } {
  const now = new Date()
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { from, to }
}

/** Family member management + per-member spending view (spec §3.5). */
export default function FamilyScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [showInactive, setShowInactive] = useState(false)
  const [adding, setAdding] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data: members, isLoading } = useMembers(showInactive)

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-neutral-500">
          ← {t('settings.title')}
        </button>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          {t('family.showInactive')}
        </label>
      </div>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('family.title')}</h1>

      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}
      {!isLoading && (members?.length ?? 0) === 0 && !adding && (
        <p className="mt-4 text-sm text-neutral-400">{t('family.empty')}</p>
      )}

      <ul className="mt-4 space-y-2">
        {members?.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            expanded={expandedId === m.id}
            onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
          />
        ))}
      </ul>

      {adding ? (
        <AddForm onDone={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-brand-700"
        >
          + {t('family.add')}
        </button>
      )}
    </main>
  )
}

function MemberCard({
  member,
  expanded,
  onToggle,
}: {
  member: Member
  expanded: boolean
  onToggle: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language as Locale) ?? 'en'
  const bn = locale === 'bn'
  const patch = usePatchMember()
  const [editing, setEditing] = useState(false)

  const range = monthRange()
  const { data: expenseData } = useExpenses({
    date_from: range.from,
    date_to: range.to,
    member_id: member.id,
  })
  const spent = (expenseData?.items ?? []).reduce((sum, e) => sum + e.amount_bdt, 0)

  return (
    <li className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      {editing ? (
        <EditForm member={member} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <button onClick={onToggle} className="text-left">
              <p className="text-sm font-medium text-neutral-900">
                {bn && member.name_bn ? member.name_bn : member.name}
              </p>
              {member.relation && (
                <p className="text-xs text-neutral-400">
                  {t(`family.relations.${member.relation}`, member.relation)}
                </p>
              )}
            </button>
            <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-neutral-900">
              {formatTakaSigned(spent, locale)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            {t('family.spentThisMonth')}
            {member.monthly_allowance > 0 &&
              ` · ${t('family.allowance')}: ${formatTakaSigned(member.monthly_allowance, locale)}`}
          </p>

          {expanded && (
            <ul className="mt-2 space-y-1 border-t border-neutral-100 pt-2">
              {(expenseData?.items ?? []).length === 0 && (
                <p className="text-xs text-neutral-400">{t('family.noExpenses')}</p>
              )}
              {expenseData?.items.map((e) => (
                <li key={e.id} className="flex justify-between text-xs text-neutral-600">
                  <span>
                    {e.date} · {bn ? e.category_name_bn : e.category_name_en}
                    {e.description ? ` — ${e.description}` : ''}
                  </span>
                  <span className="tabular-nums">{formatTakaSigned(e.amount_bdt, locale)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex gap-2">
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-brand-700">
              {t('family.edit')}
            </button>
            <button
              onClick={() => patch.mutate({ id: member.id, active: !member.active })}
              className="text-xs text-neutral-400"
            >
              {member.active ? t('family.deactivate') : t('family.reactivate')}
            </button>
          </div>
        </>
      )}
    </li>
  )
}

function EditForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const { t } = useTranslation()
  const patch = usePatchMember()
  const [name, setName] = useState(member.name)
  const [nameBn, setNameBn] = useState(member.name_bn ?? '')
  const [relation, setRelation] = useState(member.relation ?? '')
  const [dob, setDob] = useState(member.dob ?? '')
  const [allowanceText, setAllowanceText] = useState(String(member.monthly_allowance / 100))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const allowance = parseTakaInput(allowanceText) ?? 0
    patch.mutate(
      {
        id: member.id,
        name,
        name_bn: nameBn || null,
        relation: relation || null,
        dob: dob || null,
        monthly_allowance: allowance,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('family.name')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        value={nameBn}
        onChange={(e) => setNameBn(e.target.value)}
        placeholder={t('family.nameBn')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <select
        value={relation}
        onChange={(e) => setRelation(e.target.value)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="">{t('family.relation')}</option>
        {RELATIONS.map((r) => (
          <option key={r} value={r}>
            {t(`family.relations.${r}`)}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          inputMode="decimal"
          value={allowanceText}
          onChange={(e) => setAllowanceText(e.target.value)}
          placeholder={`${t('family.allowance')} ৳`}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {patch.isError && <p className="text-xs text-red-600">{t('family.createFailed')}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={patch.isPending}
          className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {t('family.save')}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-neutral-500">
          {t('family.cancel')}
        </button>
      </div>
    </form>
  )
}

function AddForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateMember()
  const [name, setName] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [relation, setRelation] = useState('')
  const [dob, setDob] = useState('')
  const [allowanceText, setAllowanceText] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const allowance = parseTakaInput(allowanceText) ?? 0
    create.mutate(
      {
        name,
        name_bn: nameBn || null,
        relation: relation || null,
        dob: dob || null,
        monthly_allowance: allowance,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
    >
      <input
        required
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('family.name')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        value={nameBn}
        onChange={(e) => setNameBn(e.target.value)}
        placeholder={t('family.nameBn')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <select
        value={relation}
        onChange={(e) => setRelation(e.target.value)}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="">{t('family.relation')}</option>
        {RELATIONS.map((r) => (
          <option key={r} value={r}>
            {t(`family.relations.${r}`)}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          inputMode="decimal"
          value={allowanceText}
          onChange={(e) => setAllowanceText(e.target.value)}
          placeholder={`${t('family.allowance')} ৳`}
          className="w-1/2 rounded border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {create.isError && <p className="text-xs text-red-600">{t('family.createFailed')}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={create.isPending}
          className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {t('family.add')}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-neutral-500">
          {t('family.cancel')}
        </button>
      </div>
    </form>
  )
}
