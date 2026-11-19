// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { resolveComponent } from '../component-resolver';

function resolveType(type: { __file?: string; __name?: string; name?: string }) {
  const element = document.createElement('div');
  Object.assign(element, {
    __vueParentComponent: { type, parent: null, vnode: { el: element } },
  });
  return { element, result: resolveComponent(element) };
}

describe('filename-derived component names', () => {
  it.each([
    ['Card.vue', 'Card'],
    ['/src/components/Card.vue', 'Card'],
    ['C:\\src\\components\\Card.vue', 'Card'],
    ['/src\\components/Card.test.vue', 'Card.test'],
    ['../Card.part.vue', 'Card.part'],
    ['..vue', '.'],
    ['.vue', null],
    ['/src/.vue', null],
    ['C:\\src\\.vue', null],
    ['', null],
    [undefined, null],
    ['/src/Card', null],
    ['/src/Card.svelte', null],
    ['/src/Card.VUE', null],
    ['/src/Card.vue/Child', null],
    ['/src/Card.vue\\Child', null],
    ['/src/Card.vue?raw', null],
    ['/src/Card.vue\n', null],
    ['/src/Card.vue\r\n', null],
    ['/src/Card.vue\u2028', null],
  ])('derives %j as %j', (file, name) => {
    const { element, result } = resolveType({ __file: file });
    expect(result).toEqual(name === null
      ? { name: null, hostElement: null, stack: [] }
      : { name, hostElement: element, stack: [{ name, hostElement: element }] });
  });

  it('keeps explicit names ahead of filename fallback', () => {
    expect(resolveType({ __name: 'SetupName', name: 'OptionName', __file: 'File.vue' }).result.name).toBe('SetupName');
    expect(resolveType({ name: 'OptionName', __file: 'File.vue\n' }).result.name).toBe('OptionName');
    expect(resolveType({ __name: '', name: '', __file: 'File.vue' }).result.name).toBe('File');
  });

  it('handles long dot sequences and terminal junk without regex matching', () => {
    const stem = 'Card' + '.'.repeat(2048);
    // Guard String.match usage in this fallback, not backtracking through every regex API.
    const match = vi.spyOn(String.prototype, 'match');
    let names: Array<string | null>;
    let matchCalls: number;
    try {
      names = [`.vue`, '.vue!', '.vue\n'].map((suffix) =>
        resolveType({ __file: `/src/${stem}${suffix}` }).result.name);
      matchCalls = match.mock.calls.length;
    } finally {
      match.mockRestore();
    }
    expect(names).toEqual([stem, null, null]);
    expect(matchCalls).toBe(0);
  });
});
