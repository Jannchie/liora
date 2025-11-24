<script setup lang="ts">
const { t } = useI18n()

definePageMeta({
  middleware: 'admin-auth',
})

navigateTo('/admin/upload')
</script>

<template>
  <div class="p-6 text-sm text-muted">
    {{ t('admin.redirecting') }}
  </div>
</template>
