import type { ClassFilter, HtmlCleaner } from '@point-grab/core';

/** Solid does not generate framework-specific class names that need filtering. */
export const solidClassFilter: ClassFilter = () => true;

const SOLID_METADATA_RE = /\sdata-point-grab-(?:source|component)(?:="[^"]*")?/gi;
const SOLID_HYDRATION_RE = /\sdata-hk(?:="[^"]*")?/gi;

/** Removes development metadata and Solid hydration attributes from copied HTML. */
export const solidHtmlCleaners: HtmlCleaner[] = [
  { pattern: SOLID_METADATA_RE, replacement: '' },
  { pattern: SOLID_HYDRATION_RE, replacement: '' },
];
