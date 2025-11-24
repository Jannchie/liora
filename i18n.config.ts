import en from './i18n/locales/en.json'
import zhCN from './i18n/locales/zh-CN.json'

export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en',
  warnHtmlMessage: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    'en': en,
    'zh-CN': zhCN,
  },
}))
