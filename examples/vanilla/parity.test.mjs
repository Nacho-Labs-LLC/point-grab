import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
for (const [name, files] of Object.entries({ angular: ['src/app/app.html','src/app/app.css'], vanilla: ['index.html','style.css'], 'web-components': ['main.js'] })) {
  test(`${name}: native walkthrough and shared motion contract`, () => {
    const source = files.map(f => readFileSync(new URL(`examples/${name}/${f}`, root), 'utf8')).join('\n');
    for (const id of ['grab-guide','motion-sample','freeze-trigger','freeze-popover']) assert.ok(source.includes(`data-testid="${id}"`), `missing ${id}`);
    assert.match(source, /prefers-reduced-motion/);
    assert.match(source, /role="tooltip"/);
    assert.match(source, /aria-describedby/);
    assert.match(source, /localhost:3456/);
  });
}
