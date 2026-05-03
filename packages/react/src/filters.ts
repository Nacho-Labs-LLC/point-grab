import type { ClassFilter, HtmlCleaner } from 'pointgrab';

/**
 * React does not inject framework-specific CSS classes by default.
 * This filter strips r-* prefixed internal classes if a CSS-in-JS
 * solution or internal tooling adds them.
 */
export const reactClassFilter: ClassFilter = (className: string) =>
  !className.startsWith('r-');

const REACT_ROOT_ATTR_RE = /\sdata-reactroot(?:="[^"]*")?/gi;
const REACT_ID_ATTR_RE = /\sdata-reactid="[^"]*"/gi;

/** Strips legacy React attributes (data-reactroot, data-reactid) from serialized HTML. */
export const reactHtmlCleaners: HtmlCleaner[] = [
  { pattern: REACT_ROOT_ATTR_RE, replacement: '' },
  { pattern: REACT_ID_ATTR_RE, replacement: '' },
];
