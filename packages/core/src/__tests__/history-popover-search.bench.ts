// @vitest-environment jsdom
import { bench, describe } from 'vitest';
import { createHistoryPopover } from '../toolbar/history-popover';

describe('History Popover Search Performance', () => {
  // Generate 1000 history entries
  const numEntries = 5000;
  const entries = Array.from({ length: numEntries }, (_, i) => ({
    id: `entry-${i}`,
    context: { selector: 'div', componentName: null, filePath: null, line: null, column: null, element: null as any, html: '', componentStack: [], cssClasses: [] },
    snippet: '',
    timestamp: Date.now()
  }));

  const callbacks = {
    onEntryClick: () => {}
  };

  const popover = createHistoryPopover(callbacks);
  popover.show(entries as any);

  const el = document.getElementById('__point-grab-history-popover__');
  const items = el?.querySelectorAll('.point-grab-history-item');

  // Choose an item towards the end of the array to trigger O(n) worst case
  const itemToClick = items ? items[numEntries - 1] as HTMLElement : null;

  bench('click event search performance', () => {
    if (itemToClick) {
      itemToClick.click();
    }
  });

});
