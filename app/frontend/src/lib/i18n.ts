import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import bn from '../locales/bn.json'

// The server-persisted user locale is applied after login (Shell syncs it);
// this initial value only covers the pre-auth screens - LandingPage's own
// language toggle persists here so a reload doesn't lose the choice.
function initialLanguage(): 'en' | 'bn' {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'bn') return saved
  } catch {
    // Storage blocked: fall back to the default below.
  }
  return 'bn'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, bn: { translation: bn } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
