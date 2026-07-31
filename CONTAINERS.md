# Local Docker development

This Compose stack keeps the Point-grab runtime, pnpm, and dependencies inside Docker Desktop while bind-mounting the checkout for live editing.

## Start the baseline stack

```bash
docker compose up --build
```

It starts:

- `packages`: watch builds for the publishable Point-grab packages.
- `vanilla-demo`: interactive product demo at http://127.0.0.1:5173.
- `site`: Astro marketing/docs site at http://127.0.0.1:4321.

Ports bind only to loopback; they are not LAN-exposed.

## Validation commands

```bash
# Unit/build validation — no watchers or browsers.
docker compose run --rm install pnpm run build
docker compose run --rm install pnpm run lint
docker compose run --rm install pnpm run test
docker compose run --rm install pnpm run verify:release

# Browser validation is deliberately serialized and resource-capped (2 CPUs / 4 GB).
# Run one project at a time on a workstation; do not fan out several --project flags.
docker compose --profile e2e run --rm e2e pnpm exec playwright test --project vanilla
docker compose --profile e2e run --rm e2e pnpm exec playwright test --project react
```

### Workstation safety guardrails

- Browser E2E defaults to **one Playwright worker and zero retries**. CI can opt in to more with `PLAYWRIGHT_WORKERS` / `PLAYWRIGHT_RETRIES`.
- The `e2e` service has a 2-CPU, 4-GB memory cap and is excluded from a normal `docker compose up` via its profile.
- File polling is intentionally disabled. Docker Desktop's normal file-event bridge should be used; do not globally enable `CHOKIDAR_USEPOLLING` or `WATCHPACK_POLLING` on this Windows checkout.
- Stop the local stack when finished: `docker compose down`. Do not run multiple Point-grab Compose commands concurrently.


## Stop without deleting dependencies

```bash
docker compose down
```

The named `point_grab_node_modules` and `point_grab_pnpm_store` volumes intentionally persist to avoid reinstalling dependencies every run. Remove them only when intentionally resetting the local environment:

```bash
docker compose down -v
```
