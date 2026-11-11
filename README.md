# mailer

Mailer connects to Gmail, labels new mail, and can leave a draft for you to send.

## Workspace

One pnpm workspace. Turborepo runs the apps.

- `apps/web` — React + Vite connect UI.
- `apps/gateway` — public origin. Health, and later OAuth and the Gmail push.
- `apps/pipeline` — private worker. Queue, mailbox sync, and triage.
- `apps/evals` — golden set. Not deployed.
- `packages/domain` — categories, labels, and the email triage schema. Import it as `mailer-domain`.
- `packages/gmail` — the Gmail method allowlist.
- `packages/tokens` — refresh-token record shape.
- `packages/db` — D1 schema. Tables arrive with the first migration.
- `infra/migrations` — D1 SQL.

## Scripts

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

`pnpm dev` starts the web app and the gateway. The web app is at http://localhost:5173.

Run one app with `pnpm --filter web dev`.
