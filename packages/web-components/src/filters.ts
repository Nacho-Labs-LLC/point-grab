import type { ClassFilter, HtmlCleaner } from 'pointgrab';

/**
 * Web Components do not add framework-specific CSS classes.
 * Pass-through filter that keeps all classes.
 */
export const wcClassFilter: ClassFilter = () => true;

/**
 * No standard framework attributes to clean for Web Components.
 * The HTML cleaner list is empty by default; Shadow DOM serialization
 * is handled separately in the shadow-dom utilities.
 */
export const wcHtmlCleaners: HtmlCleaner[] = [];
