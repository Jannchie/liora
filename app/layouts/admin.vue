<script setup lang="ts">
/*
 * Admin shell — the ground fill, the container rhythm and the nav bar,
 * in one place.
 *
 * Every admin page used to carry its own copy of this wrapper, so a
 * change to the page background, the container spacing or the nav's
 * position meant editing five files and keeping them in step. The login
 * page stays out of it deliberately: it is a centred card with no nav,
 * shown to someone who is not admin yet.
 */
</script>

<template>
  <div class="min-h-screen bg-chrome">
    <UContainer class="space-y-8 py-8">
      <AdminNav />
      <slot />
    </UContainer>
  </div>
</template>
