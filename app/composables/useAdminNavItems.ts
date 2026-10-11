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
  // The router's own `currentRoute`, not `useRoute()`: in the layout (where
  // the sidebar and header live) `useRoute()` hands back Nuxt's page-route
  // snapshot, which can lag a client-side navigation — the highlight then
  // only caught up on a second click.
  const route = useRouter().currentRoute

  const items = computed<AdminNavItem[]>(() => [
    { label: t('admin.nav.upload'), to: '/admin/upload', icon: 'jannchie:upload' },
    { label: t('admin.nav.files'), to: '/admin/files', icon: 'jannchie:list' },
    { label: t('admin.nav.series'), to: '/admin/series', icon: 'jannchie:layers' },
    { label: t('admin.nav.backfill'), to: '/admin/backfill', icon: 'jannchie:tools' },
    { label: t('admin.nav.site'), to: '/admin/site', icon: 'jannchie:globe' },
  ])

  const isActive = (to: string): boolean => route.value.path === to || route.value.path.startsWith(`${to}/`)
  const current = computed(() => items.value.find(item => isActive(item.to)))

  return { items, isActive, current }
}
