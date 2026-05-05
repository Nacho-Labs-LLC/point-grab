import type { ClassFilter, HtmlCleaner } from '@point-grab/core';

/** Strips Svelte internal classes: s-* and svelte-* prefixed. */
export const svelteClassFilter: ClassFilter = (className: string) =>
  !className.startsWith('s-') && !className.startsWith('svelte-');

const SVELTE_ATTR_RE = /\ssvelte-[a-z0-9]+(?:="[^"]*")?/gi;

/** Strips svelte-* attributes from serialized HTML. */
export const svelteHtmlCleaners: HtmlCleaner[] = [
  { pattern: SVELTE_ATTR_RE, replacement: '' },
];
