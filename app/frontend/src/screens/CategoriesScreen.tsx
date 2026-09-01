import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { transliterate } from '../lib/bangla'
import {
  useCategories,
  useCreateCategory,
  usePatchCategory,
  type CategoryNode,
  type NeedWantSave,
} from '../lib/queries'

const NEED_WANT_SAVE: NeedWantSave[] = ['need', 'want', 'save']

/** Category management: rename, archive, add. Two levels only (spec §3.3.2). */
export default function CategoriesScreen({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation()
  const [showArchived, setShowArchived] = useState(false)
  const { data: tree, isLoading } = useCategories(showArchived)
  const [addingTop, setAddingTop] = useState(false)
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null)

  const bn = i18n.language === 'bn'

  return (
    <main className="mx-auto max-w-lg p-4 lg:mx-0 lg:max-w-2xl lg:p-0">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-neutral-500">← {t('settings.title')}</button>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          {t('categories.showArchived')}
        </label>
      </div>
      <h1 className="mt-2 text-xl font-bold text-neutral-900">{t('categories.title')}</h1>

      {isLoading && <p className="mt-4 text-sm text-neutral-400">{t('common.loading')}</p>}

      <ul className="mt-4 space-y-3">
        {tree?.map((cat) => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            bn={bn}
            addingSub={addingSubFor === cat.id}
            onAddSub={() => setAddingSubFor(cat.id)}
            onCancelSub={() => setAddingSubFor(null)}
          />
        ))}
      </ul>

      {addingTop ? (
        <AddForm parentId={null} onDone={() => setAddingTop(false)} />
      ) : (
        <button
          onClick={() => setAddingTop(true)}
          className="mt-4 w-full rounded-xl border border-dashed border-neutral-300 py-3 text-sm text-neutral-500"
        >
          + {t('categories.add')}
        </button>
      )}
    </main>
  )
}

function CategoryRow({
  cat,
  bn,
  addingSub,
  onAddSub,
  onCancelSub,
}: {
  cat: CategoryNode
  bn: boolean
  addingSub: boolean
  onAddSub: () => void
  onCancelSub: () => void
}) {
  const { t } = useTranslation()
  const patch = usePatchCategory()
  const [editing, setEditing] = useState(false)
  const [nameEn, setNameEn] = useState(cat.name_en)
  const [nameBn, setNameBn] = useState(cat.name_bn)

  function save() {
    patch.mutate({ id: cat.id, name_en: nameEn, name_bn: nameBn })
    setEditing(false)
  }

  return (
    <li className={`rounded-xl border border-neutral-200 bg-white p-3 shadow-sm ${cat.archived ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        {editing ? (
          <span className="flex flex-1 gap-2">
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={t('categories.nameEn')}
              className="w-1/2 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <input
              value={nameBn}
              onChange={(e) => setNameBn(e.target.value)}
              placeholder={t('categories.nameBn')}
              className="w-1/2 rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </span>
        ) : (
          <span className="font-medium text-neutral-900">
            {cat.icon} {bn ? cat.name_bn : cat.name_en}
            <span className="ml-2 text-xs text-neutral-400">
              {bn ? cat.name_en : cat.name_bn}
            </span>
          </span>
        )}
        <span className="ml-2 flex shrink-0 gap-2 text-xs">
          {editing ? (
            <button onClick={save} className="text-brand-700">{t('categories.save')}</button>
          ) : (
            <button onClick={() => setEditing(true)} className="text-neutral-500">
              {t('categories.rename')}
            </button>
          )}
          <button
            onClick={() => patch.mutate({ id: cat.id, archived: !cat.archived })}
            className="text-neutral-400"
          >
            {cat.archived ? t('categories.unarchive') : t('categories.archive')}
          </button>
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-[11px] text-neutral-400">{t('categories.needWantSave')}:</span>
        {NEED_WANT_SAVE.map((tag) => (
          <button
            key={tag}
            onClick={() => patch.mutate({ id: cat.id, need_want_save: cat.need_want_save === tag ? null : tag })}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              cat.need_want_save === tag
                ? 'bg-brand-600 text-white'
                : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            {t(`categories.needWantSaveOptions.${tag}`)}
          </button>
        ))}
      </div>
      {cat.children.length > 0 && (
        <ul className="mt-2 space-y-1 border-l border-neutral-100 pl-4">
          {cat.children.map((sub) => (
            <li key={sub.id} className="text-sm text-neutral-600">
              {bn ? sub.name_bn : sub.name_en}
            </li>
          ))}
        </ul>
      )}
      {addingSub ? (
        <div className="mt-2 border-l border-neutral-100 pl-4">
          <p className="mb-1 text-[11px] text-neutral-400">
            {t('categories.addingSubTo', { name: bn ? cat.name_bn : cat.name_en })}
          </p>
          <AddForm parentId={cat.id} onDone={onCancelSub} />
        </div>
      ) : (
        <button onClick={onAddSub} className="mt-2 text-xs text-neutral-400">
          + {t('categories.addSub')}
        </button>
      )}
    </li>
  )
}

function AddForm({ parentId, onDone }: { parentId: string | null; onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateCategory()
  const [nameEn, setNameEn] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [icon, setIcon] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    create.mutate(
      { parent_id: parentId, name_en: nameEn, name_bn: nameBn, icon: icon || null },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <input
        required
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        placeholder={t('categories.nameEn')}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-1.5">
        <input
          required
          value={nameBn}
          onChange={(e) => setNameBn(e.target.value)}
          placeholder={t('categories.nameBn')}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        {nameEn.trim() && (
          <button
            type="button"
            title={t('categories.transliterate')}
            onClick={() => setNameBn(transliterate(nameEn))}
            className="shrink-0 rounded border border-neutral-300 px-2.5 text-sm text-neutral-500 hover:text-brand-700"
          >
            অআ
          </button>
        )}
      </div>
      <input
        value={icon}
        onChange={(e) => setIcon(e.target.value)}
        placeholder={t('categories.icon')}
        maxLength={4}
        className="w-24 rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">
          {t('categories.save')}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-neutral-500">
          {t('categories.cancel')}
        </button>
      </div>
    </form>
  )
}
