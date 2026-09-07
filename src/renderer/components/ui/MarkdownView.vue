<script setup lang="ts">
/**
 * The single `v-html` site in the app.
 *
 * `html` must already be sanitized -- pass output from `renderMarkdown()` in
 * `composables/useMarkdown.ts`, never a raw model string.
 */
defineProps<{ html: string }>();
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown selectable" v-html="html" />
</template>

<style scoped>
.markdown {
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.markdown :deep(> *:first-child) {
  margin-top: 0;
}

.markdown :deep(> *:last-child) {
  margin-bottom: 0;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3),
.markdown :deep(h4) {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--text-md);
  font-weight: 600;
}

.markdown :deep(p),
.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 0 0 var(--space-3);
}

.markdown :deep(ul),
.markdown :deep(ol) {
  padding-left: var(--space-4);
}

.markdown :deep(li) {
  margin-bottom: var(--space-1);
}

.markdown :deep(pre) {
  margin: 0 0 var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-input);
  overflow-x: auto;
}

.markdown :deep(code) {
  padding: 1px 4px;
  border-radius: var(--radius-sm);
  background: var(--surface-overlay);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.markdown :deep(pre code) {
  padding: 0;
  background: transparent;
  font-size: var(--text-sm);
  line-height: 1.5;
}

.markdown :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.markdown :deep(a:hover) {
  text-decoration: underline;
}

.markdown :deep(blockquote) {
  margin: 0 0 var(--space-3);
  padding-left: var(--space-3);
  border-left: 2px solid var(--border-strong);
  color: var(--text-secondary);
}

.markdown :deep(table) {
  width: 100%;
  margin-bottom: var(--space-3);
  border-collapse: collapse;
  font-size: var(--text-xs);
}

.markdown :deep(th),
.markdown :deep(td) {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border-subtle);
  text-align: left;
}
</style>
