/** Matches core's ComponentStackEntry */
export interface ComponentStackEntry {
  name: string;
  filePath: string | null;
  line: number | null;
  column: number | null;
}

/** Context captured when an element is inspected */
export interface GrabContext {
  html: string;
  componentName: string | null;
  filePath: string | null;
  line: number | null;
  column: number | null;
  componentStack: ComponentStackEntry[];
  selector: string;
  cssClasses: string[];
  textContent: string | null;
  ariaLabel: string | null;
  role: string | null;
  elementDescription: string | null;
  /** Which framework adapter captured this grab */
  framework: string | null;
  /** Computed CSS styles snapshot (for future use) */
  computedStyles?: Record<string, string>;
}

/** A single inspected element entry */
export interface GrabEntry {
  id: string;
  context: GrabContext;
  snippet: string;
  timestamp: number;
}

export interface GrabHistory {
  entries: GrabEntry[];
  maxEntries: number;
}
