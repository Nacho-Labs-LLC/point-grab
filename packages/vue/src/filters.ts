import type { ClassFilter, HtmlCleaner } from '@point-grab/core';

/**
 * Vue does not add framework-specific CSS classes by default.
 * This filter is a pass-through that keeps all classes.
 */
export const vueClassFilter: ClassFilter = () => true;

const VUE_SCOPED_ATTR_RE = /\sdata-v-[a-f0-9]+(?:="[^"]*")?/gi;

/** Strips Vue scoped style attributes (data-v-*) from serialized HTML. */
export const vueHtmlCleaners: HtmlCleaner[] = [
  { pattern: VUE_SCOPED_ATTR_RE, replacement: '' },
];
