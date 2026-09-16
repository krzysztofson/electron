<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

/** A titled, scrollable section. Both features are laid out with this. */
const props = defineProps<{
  title: string;
  /** Small count/badge next to the title. */
  badge?: string | number;
  /** Let the body take remaining vertical space and scroll. */
  grow?: boolean;
  /**
   * Auto-scroll to the newest content as it grows -- e.g. new transcript
   * lines. Suspended while the user has scrolled up to read something older,
   * so a live feed does not yank the view out from under them.
   */
  stickToBottom?: boolean;
}>();

/** Within this many px of the bottom still counts as "at the bottom" -- exact
 *  equality is too strict once fractional scroll heights are involved. */
const BOTTOM_THRESHOLD_PX = 24;

const bodyEl = ref<HTMLElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);
let stuckToBottom = true;
let resizeObserver: ResizeObserver | null = null;

function isNearBottom(el: HTMLElement): boolean {
  return (
    el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX
  );
}

function handleScroll(): void {
  if (bodyEl.value) stuckToBottom = isNearBottom(bodyEl.value);
}

onMounted(() => {
  if (!props.stickToBottom) return;
  const body = bodyEl.value;
  const content = contentEl.value;
  if (!body || !content) return;

  body.addEventListener("scroll", handleScroll, { passive: true });
  // The body's own box size is fixed by the surrounding flex layout -- it's
  // the *content* growing past that box that changes `scrollHeight`, so the
  // inner wrapper is what needs observing, not the scroll container itself.
  resizeObserver = new ResizeObserver(() => {
    if (stuckToBottom) body.scrollTop = body.scrollHeight;
  });
  resizeObserver.observe(content);
});

onUnmounted(() => {
  bodyEl.value?.removeEventListener("scroll", handleScroll);
  resizeObserver?.disconnect();
});
</script>

<template>
  <section class="panel" :class="{ 'panel--grow': grow }">
    <header class="panel__head">
      <h3 class="panel__title">
        {{ title }}
        <span v-if="badge !== undefined" class="panel__badge">{{ badge }}</span>
      </h3>
      <div class="panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <div ref="bodyEl" class="panel__body">
      <div ref="contentEl" class="panel__content">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid var(--border-subtle);
}

.panel--grow {
  flex: 1;
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
}

.panel__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.panel__badge {
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--surface-overlay);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  letter-spacing: 0;
}

.panel__actions {
  display: flex;
  gap: var(--space-2);
}

.panel__body {
  min-height: 0;
  padding: 0 var(--space-3) var(--space-3);
  overflow-y: auto;
}

.panel__content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
