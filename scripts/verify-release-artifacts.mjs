import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const version = '0.1.6';
const packages = [
  { name: '@point-grab/core', dir: 'packages/core', install: ['@point-grab/core'] },
  { name: '@point-grab/react', dir: 'packages/react', install: ['react', 'react-dom', '@point-grab/core', '@point-grab/react'] },
  { name: '@point-grab/vue', dir: 'packages/vue', install: ['vue', '@point-grab/core', '@point-grab/vue'] },
  { name: '@point-grab/svelte', dir: 'packages/svelte', install: ['svelte', '@point-grab/core', '@point-grab/svelte'] },
  { name: '@point-grab/angular', dir: 'packages/angular', install: ['@angular/core', '@angular/common', '@angular/compiler', '@angular/platform-browser', 'rxjs', '@point-grab/core', '@point-grab/angular'] },
  { name: '@point-grab/web-components', dir: 'packages/web-components', install: ['@point-grab/core', '@point-grab/web-components'] },
  { name: '@point-grab/mcp-server', dir: 'packages/mcp-server', install: ['@point-grab/mcp-server'] },
];

const tarballs = new Map();
const createdTarballs = [];
const tempRoot = mkdtempSync(path.join(tmpdir(), 'point-grab-release-'));

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

try {
  for (const pkg of packages) {
    const cwd = path.join(root, pkg.dir);
    run('corepack', ['pnpm', 'pack', '--pack-destination', cwd], cwd);
    const tgz = `${pkg.name.replace('@', '').replace('/', '-')}-${version}.tgz`;
    const tgzPath = path.join(cwd, tgz);
    createdTarballs.push(tgzPath);
    tarballs.set(pkg.name, tgzPath);

    const inspectDir = path.join(tempRoot, pkg.name.replace(/[@/]/g, '_'));
    run('mkdir', ['-p', inspectDir], root);
    run('tar', ['-xzf', tgzPath, '-C', inspectDir], root);
    const manifest = JSON.parse(readFileSync(path.join(inspectDir, 'package', 'package.json'), 'utf8'));
    if (JSON.stringify(manifest).includes('workspace:')) {
      throw new Error(`${pkg.name} packed manifest still contains workspace protocol`);
    }
  }

  for (const pkg of packages) {
    const projectDir = mkdtempSync(path.join(tempRoot, 'install-'));
    run('npm', ['init', '-y'], projectDir);
    const installArgs = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'];
    for (const dep of pkg.install) {
      installArgs.push(dep.startsWith('@point-grab/') ? tarballs.get(dep) : dep);
    }
    run('npm', installArgs, projectDir);
    console.log(`verified ${pkg.name}`);
  }
} finally {
  for (const tgz of createdTarballs) {
    rmSync(tgz, { force: true });
  }
  rmSync(tempRoot, { recursive: true, force: true });
}
