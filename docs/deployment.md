# Deployment

This covers running SLA on your own infrastructure with Docker — a VPS, a
bare-metal box, or any host that can run `docker compose`. There is no
managed-hosting target; this is the self-host path.

The stack is three containers:

- **postgres** — the database.
- **web** (`apps/web`) — the Next.js app: sign-in, dashboard, settings,
  webhook receivers.
- **worker** (`apps/worker`) — the background poller: OAuth token refresh,
  event ingestion, SLA/OLA evaluation, notifications.

Both app containers are stateless and read/write nothing but Postgres —
there's no shared filesystem between them to worry about.

## Prerequisites

- Docker Engine with the Compose plugin (`docker compose version`) on the
  host.
- A Postgres instance reachable from the host — either the `postgres`
  service in [`docker-compose.prod.yml`](../docker-compose.prod.yml), or
  your own managed database, in which case skip that service and point
  `DATABASE_URL` at it.

## 1. Configure environment

Copy [`.env.example`](../.env.example) to `.env.prod` and fill in real
values. `docker-compose.prod.yml` refuses to start any service that's
missing a required variable, so this errors loudly rather than booting with
blanks:

```bash
cp .env.example .env.prod
```

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | web, worker | `postgresql://user:password@host:5432/db?schema=public`. If you're using the bundled `postgres` service, the host is `postgres` (the Compose service name) and the user/password/db must match `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` below. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | postgres | Only read by the bundled `postgres` service. Omit if you're pointing `DATABASE_URL` at your own database instead. |
| `NEXTAUTH_SECRET` | web | Random secret used to sign session tokens. Generate one with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | web, worker | The public URL the app is served at, e.g. `https://sla.example.com`. The worker uses this to build OAuth redirect URIs — it must match what's registered with each provider. |
| `INTEGRATION_CONFIG_ENCRYPTION_KEY` | web, worker | Encrypts each org's Zendesk/Jira/Slack OAuth client secrets at rest. Generate with `openssl rand -base64 32`. Rotating it invalidates every saved integration config. |
| `SMTP_ENCRYPTION_KEY` | web, worker | Encrypts each org's saved SMTP password at rest. Generate with `openssl rand -base64 32`, keep distinct from the two secrets above so rotating one doesn't invalidate the others. |
| `WORKER_ACTIVE_POLL_MS`, `WORKER_RECONCILIATION_MS` | web, worker | Optional; bootstrap defaults are 300000 (5 min) and 3600000 (1 hour), used only to seed the database on a fresh install. Once an organization owner changes either interval from the Monitoring settings page, the saved database value is authoritative and these env vars are no longer read. |

None of these secrets are baked into the images — the Dockerfiles only ever
see fixed placeholder values at build time (see the comments in
[`apps/web/Dockerfile`](../apps/web/Dockerfile) and
[`apps/worker/Dockerfile`](../apps/worker/Dockerfile)). Real values are
supplied at container start via `environment:`/`--env-file`, the same as any
other 12-factor deployment.

## 2. Build and start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

This builds `apps/web/Dockerfile` and `apps/worker/Dockerfile` from the
repo root and starts all three services.

## 3. Run migrations

Nothing above applies the Prisma schema — that's a deliberate one-off step,
not something a container should do on every restart. Run it once after the
first `up`, and again after pulling any update that adds a migration:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm --user root worker \
  pnpm --filter @sla/db exec prisma migrate deploy
```

`--user root` is required here: the `worker` image otherwise runs as an
unprivileged user (see [Security notes](#security-notes)), which can't
write into `node_modules` — something `migrate deploy` occasionally needs
to do (state files, generated client checks). The long-running `worker`
process itself never runs this way.

## 4. Create the first account

Sign-up is self-serve — visit `${NEXTAUTH_URL}/sign-up` and create an
account with an email and password (see
[Getting Started](getting-started.md)). There is no separate seed/admin
bootstrap step.

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
# then, only if the update added new migrations:
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm --user root worker pnpm --filter @sla/db exec prisma migrate deploy
```

## Security notes

- Both app containers run as a non-root user (`nextjs` in the web image,
  `worker` in the worker image) — everything except the one-off migration
  command above.
- Put a reverse proxy (Caddy, nginx, Traefik) in front of `web` for TLS.
  Zendesk and Jira webhooks, and the OAuth redirect flows, all require
  HTTPS in practice.
- `NEXTAUTH_SECRET`, `INTEGRATION_CONFIG_ENCRYPTION_KEY`, and
  `SMTP_ENCRYPTION_KEY` are three independent secrets by design — see the
  table above and the comments on each in `.env.example`. Back them up
  alongside the database: losing any of them makes the data it encrypts
  unrecoverable, not just un-decryptable-until-fixed.
- Security headers, CSRF hardening, rate limiting, and health-check
  endpoints are tracked separately in the
  [roadmap](../implementation-plans/roadmap.md) (steps 29–33) and aren't
  addressed by containerizing alone.

## Image notes

- **web** builds with Next.js's `output: "standalone"`
  (`apps/web/next.config.mjs`), so the runtime image ships only the traced
  server bundle and pruned `node_modules` — none of the pnpm workspace or
  devDependencies.
- **worker** has no equivalent bundling step: `apps/worker`'s own `start`
  script runs its TypeScript directly via `tsx` rather than a compiled
  `dist/`, and every `@sla/*` package it imports is consumed as workspace
  TypeScript source (each package's `main` points at `src/index.ts`, not a
  build artifact). The worker image therefore keeps the full monorepo
  install, including devDependencies — there's no way to slim it down
  without changing how the package is run, which is out of scope here.
- Neither image needs Prisma query-engine binaries or `libssl`/OpenSSL —
  `packages/db` generates Prisma's driver-adapter client
  (`@prisma/adapter-pg`), which is pure JS/TS with no native engine, so
  plain `node:22-alpine` is enough for both.
