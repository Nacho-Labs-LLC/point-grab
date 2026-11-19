// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { resolveComponent } from '../component-resolver';

function resolveMeta(meta: { loc?: { file?: string }; name?: string }) {
  const element = document.createElement('div');
  Object.assign(element, { __svelte_meta: meta });
  return { element, result: resolveComponent(element) };
}

describe('filename-derived component names', () => {
  it.each([
    ['Card.svelte', 'Card'],
    ['/src/components/Card.svelte', 'Card'],
    ['C:\\src\\components\\Card.svelte', 'Card'],
    ['/src\\components/Card.test.svelte', 'Card.test'],
    ['../Card.part.svelte', 'Card.part'],
    ['..svelte', '.'],
    ['.svelte', null],
    ['/src/.svelte', null],
    ['C:\\src\\.svelte', null],
    ['', null],
    [undefined, null],
    ['/src/Card', null],
    ['/src/Card.vue', null],
    ['/src/Card.SVELTE', null],
    ['/src/Card.svelte/Child', null],
    ['/src/Card.svelte\\Child', null],
    ['/src/Card.svelte?raw', null],
    ['/src/Card.svelte\n', null],
    ['/src/Card.svelte\r\n', null],
    ['/src/Card.svelte\u2028', null],
  ])('derives %j as %j', (file, name) => {
    const { element, result } = resolveMeta({ loc: { file } });
    expect(result).toEqual(name === null
      ? { name: null, hostElement: null, stack: [] }
      : { name, hostElement: element, stack: [{ name, hostElement: element }] });
  });

  it('keeps explicit names ahead of filename fallback', () => {
    expect(resolveMeta({ name: 'ExplicitName', loc: { file: 'File.svelte\n' } }).result.name).toBe('ExplicitName');
    expect(resolveMeta({ name: '', loc: { file: 'File.svelte' } }).result.name).toBe('File');
    expect(resolveMeta({}).result.name).toBeNull();
  });

  it('handles long dot sequences and terminal junk without regex matching', () => {
    const stem = 'Card' + '.'.repeat(2048);
    // Guard String.match usage in this fallback, not backtracking through every regex API.
    const match = vi.spyOn(String.prototype, 'match');
    let names: Array<string | null>;
    let matchCalls: number;
    try {
      names = ['.svelte', '.svelte!', '.svelte\n'].map((suffix) =>
        resolveMeta({ loc: { file: `/src/${stem}${suffix}` } }).result.name);
      matchCalls = match.mock.calls.length;
    } finally {
      match.mockRestore();
    }
    expect(names).toEqual([stem, null, null]);
    expect(matchCalls).toBe(0);
  });
});
