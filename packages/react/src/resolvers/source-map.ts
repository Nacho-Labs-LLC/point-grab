/**
 * React 19 removed `_debugSource`; its `_debugStack` frames point into the module the
 * dev server *served* (after JSX/HMR transforms), e.g.
 * `http://localhost:5173/src/App.jsx?t=1712:160:21`. Those positions are not source
 * positions. This maps them back through the dev server's source map.
 *
 * Maps are fetched asynchronously (warmed on hover) and looked up synchronously, so a
 * grab never blocks. Until a map is loaded we report the file without a line rather
 * than a wrong line.
 */

interface Original { filePath: string; line: number; column: number }
type Segment = [genColumn: number, source: number, line: number, column: number];
interface ParsedMap { sources: string[]; lines: Segment[][] }

const maps = new Map<string, ParsedMap | null | Promise<void>>();
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** True for a same-origin http(s) module URL served by the dev server. */
export function isServedModuleUrl(path: string): boolean {
  if (!/^https?:\/\//.test(path) || typeof location === 'undefined') return false;
  try { return new URL(path).origin === location.origin; } catch { return false; }
}

/** `http://host/src/App.jsx?t=1` → `src/App.jsx`; Vite `/@fs/abs/path` → `/abs/path`. */
export function normalizeServedPath(url: string): string {
  const { pathname } = new URL(url);
  const path = decodeURIComponent(pathname);
  if (path.startsWith('/@fs/')) return path.slice(4);
  return path.replace(/^\/+/, '');
}

function decodeMappings(mappings: string): Segment[][] {
  const lines: Segment[][] = [];
  let source = 0, line = 0, column = 0;
  for (const group of mappings.split(';')) {
    const segments: Segment[] = [];
    let genColumn = 0;
    for (const chunk of group.split(',')) {
      if (!chunk) continue;
      const values: number[] = [];
      let value = 0, shift = 0;
      for (const char of chunk) {
        const digit = B64.indexOf(char);
        if (digit < 0) return lines; // malformed: keep what decoded cleanly
        value += (digit & 31) << shift;
        if (digit & 32) { shift += 5; continue; }
        values.push(value & 1 ? -(value >>> 1) : value >>> 1);
        value = 0; shift = 0;
      }
      genColumn += values[0] ?? 0;
      if (values.length >= 4) {
        source += values[1]; line += values[2]; column += values[3];
        segments.push([genColumn, source, line, column]);
      }
    }
    lines.push(segments);
  }
  return lines;
}

function decodeBase64Utf8(data: string): string {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function load(url: string): Promise<void> {
  try {
    const code = await (await fetch(url)).text();
    const ref = /\/\/[#@] sourceMappingURL=([^\s'"]+)\s*$/.exec(code.trimEnd())?.[1];
    if (!ref) { maps.set(url, null); return; }
    let json: string;
    if (ref.startsWith('data:')) {
      const comma = ref.indexOf(',');
      const meta = ref.slice(5, comma);
      const body = ref.slice(comma + 1);
      json = meta.includes(';base64') ? decodeBase64Utf8(body) : decodeURIComponent(body);
    } else {
      json = await (await fetch(new URL(ref, url))).text();
    }
    const raw = JSON.parse(json) as { sources?: string[]; sourceRoot?: string; mappings?: string };
    const base = new URL(raw.sourceRoot ? `${raw.sourceRoot.replace(/\/?$/, '/')}` : '.', url);
    maps.set(url, {
      sources: (raw.sources ?? []).map((source) => {
        // Absolute filesystem paths (e.g. `/home/me/app/src/App.jsx` for served
        // `/src/App.jsx`) are kept as-is; everything else resolves against the map.
        const served = new URL(url).pathname;
        if (/^[A-Za-z]:[\\/]/.test(source) || (source.startsWith('/') && source !== served && source.endsWith(served))) return source;
        return normalizeServedPath(new URL(source, base).href);
      }),
      lines: decodeMappings(raw.mappings ?? ''),
    });
  } catch {
    maps.set(url, null);
  }
}

/** Start loading the source map for a served module (no-op if cached or in flight). */
export function prefetchSourceMap(url: string): void {
  if (!maps.has(url)) maps.set(url, load(url));
}

/**
 * - `Original`: mapped source position.
 * - `undefined`: map not loaded yet (a fetch is started).
 * - `null`: the module has no usable map.
 */
export function lookupOriginal(url: string, line: number, column: number): Original | null | undefined {
  const map = maps.get(url);
  if (map === undefined) { prefetchSourceMap(url); return undefined; }
  if (map instanceof Promise) return undefined;
  if (map === null) return null;
  const segments = map.lines[line - 1];
  if (!segments?.length) return null;
  let match: Segment | undefined;
  for (const segment of segments) {
    if (segment[0] <= column - 1) match = segment; else break;
  }
  match ??= segments[0];
  const filePath = map.sources[match[1]];
  return filePath ? { filePath, line: match[2] + 1, column: match[3] + 1 } : null;
}

/** Test hook: wait for in-flight loads, or clear the cache. */
export async function settleSourceMaps(): Promise<void> {
  await Promise.all([...maps.values()].filter((v): v is Promise<void> => v instanceof Promise));
}
export function clearSourceMaps(): void { maps.clear(); }
