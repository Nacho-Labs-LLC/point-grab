# Contributing to point-grab

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/Nacho-Labs-LLC/point-grab.git
cd point-grab
pnpm install
pnpm run build
pnpm run test
```

**Requirements:** Node.js 18+, pnpm 9+

## Project Structure

This is a pnpm + Turborepo monorepo:

- `packages/core` — Framework-agnostic core (`point-grab` on npm)
- `packages/angular` — Angular adapter
- `packages/react` — React adapter
- `packages/vue` — Vue adapter
- `packages/svelte` — Svelte adapter
- `packages/web-components` — Web Components adapter
- `packages/mcp-server` — MCP server for AI agents
- `site/` — Documentation site (Astro)

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `pnpm run build` and `pnpm run test` to verify
4. Submit a pull request

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include a clear description of what changed and why
- Make sure the build and tests pass
- Add tests for new functionality when applicable

## Reporting Issues

Open an issue at https://github.com/Nacho-Labs-LLC/point-grab/issues with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser/framework versions if relevant

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
