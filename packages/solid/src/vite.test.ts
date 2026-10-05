import { describe, expect, it } from 'vitest';
import pointGrabSolid from './vite';

describe('pointGrabSolid', () => {
  it('annotates intrinsic JSX with source and component metadata before Solid compiles it', async () => {
    const plugin = pointGrabSolid({ root: '/project' });
    const output = await plugin.transform?.(
      'export function Card() {\n  return <button>Save</button>;\n}\n',
      '/project/src/components/Card.tsx',
    );
    const code = output;

    expect(code).toContain('data-point-grab-source="src/components/Card.tsx:2:10"');
    expect(code).toContain('data-point-grab-component="Card"');
  });

  it('uses a variable name for arrow-function components', async () => {
    const plugin = pointGrabSolid({ root: '/project' });
    const output = await plugin.transform?.(
      'const Card = () => <button>Save</button>;\n',
      '/project/src/components/Card.tsx',
    );

    expect(output).toContain('data-point-grab-component="Card"');
  });

  it('runs only in Vite dev mode so metadata is not shipped to production', () => {
    expect(pointGrabSolid().apply).toBe('serve');
  });

  it('does not annotate JSX components because they do not produce DOM elements directly', async () => {
    const plugin = pointGrabSolid({ root: '/project' });
    const output = await plugin.transform?.(
      'export function App() {\n  return <Card />;\n}\n',
      '/project/src/App.tsx',
    );
    const code = output;

    expect(code).not.toContain('data-point-grab-source');
  });
});
