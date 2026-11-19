// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { createHistoryPopover } from '../toolbar/history-popover';
import { showToast, disposeToast } from '../overlay/toast';
import { Z_INDEX_LABEL, Z_INDEX_TOAST, Z_INDEX_TOOLBAR, Z_INDEX_POPOVER } from '../constants';

it('keeps informational labels and copy feedback below interactive toolbar and popovers', () => {
  expect(Z_INDEX_TOOLBAR).toBeGreaterThan(Z_INDEX_LABEL);
  expect(Z_INDEX_TOOLBAR).toBeGreaterThan(Z_INDEX_TOAST);
  expect(Z_INDEX_POPOVER).toBeGreaterThan(Z_INDEX_TOOLBAR);
});

it('keeps interactive history above a recent-copy toast so entry labels are not obscured', () => {
  const history = createHistoryPopover({ onEntryClick: () => {} });
  try {
    showToast('Copied to clipboard');
    history.show([]);
    const popup = document.getElementById('__point-grab-history-popover__')!;
    const toast = document.getElementById('__point-grab-toast__')!;
    expect(Number(getComputedStyle(popup).zIndex)).toBeGreaterThan(Number(getComputedStyle(toast).zIndex));
  } finally {
    history.dispose();
    disposeToast();
  }
});
