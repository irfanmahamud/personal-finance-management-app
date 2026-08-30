import { useTranslation } from 'react-i18next'
import { useSettings } from '../lib/queries'

/** M2 placeholder dashboard - real widgets land with M4/M5 data. */
export default function HomeScreen() {
  const { t } = useTranslation()
  const { data: settings } = useSettings()

  return (
    <main className="mx-auto max-w-lg p-4">
      <h1 className="text-xl font-bold text-neutral-900">
        {settings?.household_name ?? t('common.loading')}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        {t('app.name')}
      </p>
    </main>
  )
}
