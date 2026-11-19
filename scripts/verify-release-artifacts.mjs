import { execFileSync } from 'node:child_process';
import { constants, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const pnpm = 'pnpm';
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar';
const packages = [
  { name: '@point-grab/core', dir: 'packages/core', install: ['@point-grab/core'] },
  { name: '@point-grab/react', dir: 'packages/react', install: ['react', 'react-dom', '@point-grab/core', '@point-grab/react'] },
  { name: '@point-grab/solid', dir: 'packages/solid', install: ['solid-js', '@point-grab/core', '@point-grab/solid'] },
  { name: '@point-grab/vue', dir: 'packages/vue', install: ['vue', '@point-grab/core', '@point-grab/vue'] },
  { name: '@point-grab/svelte', dir: 'packages/svelte', install: ['svelte', '@point-grab/core', '@point-grab/svelte'] },
  { name: '@point-grab/angular', dir: 'packages/angular', install: ['@angular/core', '@angular/common', '@angular/compiler', '@angular/platform-browser', 'rxjs', '@point-grab/core', '@point-grab/angular'] },
  { name: '@point-grab/web-components', dir: 'packages/web-components', install: ['@point-grab/core', '@point-grab/web-components'] },
  { name: '@point-grab/mcp-server', dir: 'packages/mcp-server', install: ['@point-grab/mcp-server'] },
];

const versions = packages.map((pkg) => JSON.parse(readFileSync(path.join(root, pkg.dir, 'package.json'), 'utf8')).version);
if (new Set(versions).size !== 1) throw new Error(`Package versions differ: ${versions.join(', ')}`);
const version = versions[0];

const tarballs = new Map();
const tempRoot = mkdtempSync(path.join(tmpdir(), 'point-grab-release-'));
const outputDir = process.env.POINT_GRAB_RELEASE_DIR
  ? path.resolve(process.env.POINT_GRAB_RELEASE_DIR)
  : undefined;

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32' && (cmd === pnpm || cmd === 'npm'),
    stdio: 'pipe',
  });
}

function runPnpm(args, cwd) {
  if (process.env.npm_execpath) {
    return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
  }
  return run(pnpm, args, cwd);
}

try {
  for (const pkg of packages) {
    const cwd = path.join(root, pkg.dir);
    runPnpm(['pack', '--pack-destination', tempRoot], cwd);
    const tgz = `${pkg.name.replace('@', '').replace('/', '-')}-${version}.tgz`;
    const tgzPath = path.join(tempRoot, tgz);
    tarballs.set(pkg.name, tgzPath);

    const inspectDir = path.join(tempRoot, pkg.name.replace(/[@/]/g, '_'));
    mkdirSync(inspectDir, { recursive: true });
    run(tar, ['-xzf', tgzPath, '-C', inspectDir], root);
    const manifest = JSON.parse(readFileSync(path.join(inspectDir, 'package', 'package.json'), 'utf8'));
    if (JSON.stringify(manifest).includes('workspace:')) {
      throw new Error(`${pkg.name} packed manifest still contains workspace protocol`);
    }
    const packageRoot = path.join(inspectDir, 'package');
    function checkTargets(value) {
      if (typeof value === 'string' && value.startsWith('./')) {
        if (!statSync(path.join(packageRoot, value)).isFile()) {
          throw new Error(`${pkg.name} export is not a file: ${value}`);
        }
      } else if (value && typeof value === 'object') {
        for (const target of Object.values(value)) checkTargets(target);
      }
    }
    checkTargets(manifest.exports);
    for (const target of [manifest.main, manifest.module, manifest.types, ...Object.values(manifest.bin ?? {})]) {
      if (target && !statSync(path.join(packageRoot, target)).isFile()) {
        throw new Error(`${pkg.name} missing entry point: ${target}`);
      }
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
  // Retain only artifacts that completed every package's verification. Never repack for publication.
  if (outputDir) {
    mkdirSync(outputDir, { recursive: true });
    for (const tgz of tarballs.values()) {
      copyFileSync(tgz, path.join(outputDir, path.basename(tgz)), constants.COPYFILE_EXCL);
    }
    console.log(`Verified publish tarballs retained in ${outputDir}`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
