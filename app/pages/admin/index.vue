<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
})

navigateTo('/admin/upload')
</script>

<template>
  <div class="p-6 text-sm text-muted">
    正在跳转到上传管理…
  </div>
</template>
