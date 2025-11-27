import en from './locales/en.json'
import ja from './locales/ja.json'
import zhCN from './locales/zh-CN.json'

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
    'ja': ja,
  },
}))
