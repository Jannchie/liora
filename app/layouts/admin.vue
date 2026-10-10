<script setup lang="ts">
/*
 * Admin shell — the wireframe of the Jannchie Icons site: a centred
 * column with a hairline down each side, a two-cell sticky header, a
 * sticky sidebar whose right rule lines up with the header's brand cell,
 * and a content column that pages fill with full-width `.wire-band`
 * strips. Every line is drawn once; neighbours share edges.
 *
 * The login page stays out of it: it is shown to someone who is not
 * admin yet, so it has no nav.
 */
</script>

<template>
  <div class="min-h-screen bg-bg [--admin-header-h:57px] max-lg:[--admin-header-h:101px]">
    <div class="wire-shell">
      <AdminNav />
      <div class="lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <AdminSidebar class="hidden lg:block" />
        <main class="min-w-0 pb-24">
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>
