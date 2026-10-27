<script setup lang="ts">
/*
 * Admin sidebar — sticky under the header, ruled on the right so its
 * line continues the header's brand-cell divider. Links follow the icons
 * site's category list: quiet text, a sunken fill on hover and for the
 * current page.
 */
const { t } = useI18n()
const { items, isActive } = useAdminNavItems()
</script>

<template>
  <aside
    class="sticky top-[var(--admin-header-h)] h-[calc(100vh-var(--admin-header-h))] self-start overflow-y-auto border-r border-border px-2.5 pb-10 pt-5"
  >
    <p class="label-caption px-2.5 pb-2.5">{{ t('admin.nav.label') }} · {{ items.length }}</p>
    <nav class="flex flex-col gap-px" :aria-label="t('admin.nav.label')">
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="group flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[13.5px] outline-none transition-colors focus-visible:shadow-[var(--ring-focus)]"
        :class="isActive(item.to) ? 'bg-muted text-highlighted' : 'text-muted hover:bg-muted hover:text-fg-highlighted'"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <Icon
          :name="item.icon"
          class="h-4 w-4 shrink-0 transition-colors"
          :class="isActive(item.to) ? 'text-highlighted' : 'text-dimmed group-hover:text-fg-highlighted'"
        />
        <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
      </NuxtLink>
    </nav>

    <div class="mt-6 border-t border-border pt-4">
      <NuxtLink
        to="/"
        class="group flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[13.5px] text-muted outline-none transition-colors hover:bg-muted hover:text-fg-highlighted focus-visible:shadow-[var(--ring-focus)]"
      >
        <Icon name="jannchie:external-link" class="h-4 w-4 shrink-0 text-dimmed group-hover:text-fg-highlighted" />
        <span class="min-w-0 flex-1 truncate">{{ t('admin.nav.viewFrontend') }}</span>
      </NuxtLink>
    </div>
  </aside>
</template>
