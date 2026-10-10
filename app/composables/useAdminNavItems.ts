import { computed } from 'vue'

export interface AdminNavItem {
  label: string
  to: string
  icon: string
}

/**
 * Admin destinations, shared by the header (mobile pills) and the sidebar,
 * plus which one the current route belongs to.
 */
export function useAdminNavItems() {
  const { t } = useI18n()
  const route = useRoute()

  const items = computed<AdminNavItem[]>(() => [
    { label: t('admin.nav.upload'), to: '/admin/upload', icon: 'jannchie:upload' },
    { label: t('admin.nav.files'), to: '/admin/files', icon: 'jannchie:list' },
    { label: t('admin.nav.series'), to: '/admin/series', icon: 'jannchie:layers' },
    { label: t('admin.nav.backfill'), to: '/admin/backfill', icon: 'jannchie:tools' },
    { label: t('admin.nav.site'), to: '/admin/site', icon: 'jannchie:globe' },
  ])

  const isActive = (to: string): boolean => route.path === to || route.path.startsWith(`${to}/`)
  const current = computed(() => items.value.find(item => isActive(item.to)))

  return { items, isActive, current }
}
