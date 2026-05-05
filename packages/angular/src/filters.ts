import type { ClassFilter, HtmlCleaner } from '@point-grab/core';

/** Drops Angular-generated classes: ng-*, _ng* */
export const angularClassFilter: ClassFilter = (className: string) =>
  !className.startsWith('ng-') && !className.startsWith('_ng');

const NG_ATTR_QUOTED_RE = /\s_ng(?:host|content)-[a-z0-9-]+="[^"]*"/gi;
const NG_ATTR_BARE_RE = /\s_ng(?:host|content)-[a-z0-9-]+/gi;

/** Strips _nghost-* and _ngcontent-* attributes from serialized HTML. */
export const angularHtmlCleaners: HtmlCleaner[] = [
  { pattern: NG_ATTR_QUOTED_RE, replacement: '' },
  { pattern: NG_ATTR_BARE_RE, replacement: '' },
];
