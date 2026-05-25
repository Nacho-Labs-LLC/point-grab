import http from 'http';
import { spawn } from 'child_process';
import assert from 'assert';
import path from 'path';

async function runTests() {
  console.log('Starting build...');
  const build = spawn('pnpm', ['run', 'build'], { stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    build.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Build failed with code ${code}`));
    });
  });

  console.log('Starting mcp-server...');
  const server = spawn('node', ['packages/mcp-server/dist/index.js'], {
    env: { ...process.env, POINT_GRAB_PORT: '9876', POINT_GRAB_HISTORY_PATH: '/tmp/history.json' }
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('Testing CORS...');

  const testRequest = (origin) => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 9876,
      path: '/inspect',
      method: 'OPTIONS',
      headers: origin ? { 'Origin': origin } : {}
    }, (res) => {
      resolve(res.headers);
    });
    req.on('error', reject);
    req.end();
  });

  try {
    const headers1 = await testRequest('http://localhost:3000');
    assert.strictEqual(headers1['access-control-allow-origin'], 'http://localhost:3000');
    console.log('✅ Localhost origin allowed');

    const headers2 = await testRequest('http://127.0.0.1:8080');
    assert.strictEqual(headers2['access-control-allow-origin'], 'http://127.0.0.1:8080');
    console.log('✅ 127.0.0.1 origin allowed');

    const headers3 = await testRequest('https://evil.com');
    assert.strictEqual(headers3['access-control-allow-origin'], undefined);
    console.log('✅ External origin rejected');

    const headers4 = await testRequest();
    assert.strictEqual(headers4['access-control-allow-origin'], undefined);
    console.log('✅ No origin rejected');

    console.log('All tests passed!');
  } catch (e) {
    console.error('Test failed:', e);
    process.exit(1);
  } finally {
    server.kill();
  }
}

runTests();
