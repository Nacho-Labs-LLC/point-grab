// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSourceMaps, lookupOriginal, normalizeServedPath, settleSourceMaps } from '../source-map';
import { resolveSource } from '../source-resolver';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const vlq = (n: number) => {
  let v = n < 0 ? (-n << 1) | 1 : n << 1, out = '';
  do { let d = v & 31; v >>>= 5; if (v) d |= 32; out += B64[d]; } while (v);
  return out;
};
/** One mapped segment per generated line: [genCol, srcLine, srcCol] (0-based, absolute). */
function mappings(lines: [number, number, number][]): string {
  let prevLine = 0, prevCol = 0;
  return lines.map(([gen, line, col]) => {
    const seg = vlq(gen) + vlq(0) + vlq(line - prevLine) + vlq(col - prevCol);
    prevLine = line; prevCol = col; return seg;
  }).join(';');
}
function serve(map: object, origin = location.origin) {
  const json = btoa(JSON.stringify(map));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ text: async () => (String(url).startsWith(origin) ? `code()\n//# sourceMappingURL=data:application/json;base64,${json}` : '') })));
}
afterEach(() => { clearSourceMaps(); vi.unstubAllGlobals(); });

describe('React dev-server source maps', () => {
  it('maps a served module position back to the original source line', async () => {
    const url = `${location.origin}/src/App.jsx?t=1712`;
    serve({ version: 3, sources: ['App.jsx'], mappings: mappings([[0, 0, 0], [4, 111, 8], [20, 67, 0]]) });
    expect(lookupOriginal(url, 2, 21)).toBeUndefined(); // not loaded yet: starts a fetch
    await settleSourceMaps();
    expect(lookupOriginal(url, 2, 21)).toEqual({ filePath: 'src/App.jsx', line: 112, column: 9 });
    expect(lookupOriginal(url, 3, 25)).toEqual({ filePath: 'src/App.jsx', line: 68, column: 1 });
  });

  it('reports the file without a wrong line while the map loads, then the mapped line', async () => {
    serve({ version: 3, sources: ['Card.tsx'], mappings: mappings([[0, 0, 0], [2, 41, 4]]) });
    const element = document.createElement('p');
    Object.assign(element, { '__reactFiber$x': { tag: 5, type: 'p', return: null, _debugStack: { stack: `at Card (${location.origin}/src/Card.tsx?t=9:2:7)` } } });
    expect(resolveSource(element)).toEqual({ filePath: 'src/Card.tsx', line: null, column: null });
    await settleSourceMaps();
    expect(resolveSource(element)).toEqual({ filePath: 'src/Card.tsx', line: 42, column: 5 });
  });

  it('falls back to the raw position when a module has no source map', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => 'code()' })));
    const url = `${location.origin}/src/Plain.js`;
    lookupOriginal(url, 3, 4); await settleSourceMaps();
    expect(lookupOriginal(url, 3, 4)).toBeNull();
  });

  it('normalizes served paths, including Vite /@fs/ absolute paths', () => {
    expect(normalizeServedPath('http://localhost:5173/src/App.jsx?t=1')).toBe('src/App.jsx');
    expect(normalizeServedPath('http://localhost:5173/@fs/home/me/pkg/Button.tsx?v=2')).toBe('/home/me/pkg/Button.tsx');
  });
});
