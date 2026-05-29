// @vitest-environment jsdom
import { bench, describe } from 'vitest';
import { createHistoryPopover } from '../toolbar/history-popover';

describe('History Popover Render', () => {
  // Generate 1000 history entries
  const entries = Array.from({ length: 1000 }, (_, i) => ({
    id: `entry-${i}`,
    context: { selector: 'div', componentName: null, filePath: null, line: null, column: null, element: null as any, html: '', componentStack: [], cssClasses: [] },
    snippet: '',
    timestamp: Date.now()
  }));

  const callbacks = {
    onEntryClick: () => {}
  };

  bench('render performance', () => {
    const popover = createHistoryPopover(callbacks);
    popover.show(entries as any);

    // simulate clicking the last item
    const el = document.getElementById('__point-grab-history-popover__');
    const items = el?.querySelectorAll('.point-grab-history-item');
    if (items && items.length > 0) {
      const lastItem = items[items.length - 1] as HTMLElement;
      lastItem.click();
    }

    popover.dispose();
  });
});
