# System Architecture Document: Mailer

## 1. Executive Summary

Mailer is a headless Gmail worker on Cloudflare. `apps/gateway` is the public origin. It serves the connect UI and accepts the Gmail push. `apps/pipeline` does the slow work. A Cloudflare Queue sits between them so the push returns before classification starts.

Gmail delivers a mailbox watch through Pub/Sub. `users.watch` publishes to a Google Cloud Pub/Sub topic. A push subscription on that topic calls the gateway. Pub/Sub is the required piece outside Cloudflare and Google OAuth.

State lives in D1. The rows belong to one account. A Worker reads them through a binding. The audit trail is SQL in D1.

The schema language is Zod, in `packages/domain`. Workers run every request.

---

## 2. High-Level System Topology

```text
[ Browser ]
    │  HTTPS, one origin
    ▼
[ apps/gateway · Cloudflare Worker ]
  ├── Static assets from apps/web
  ├── Google OAuth callback
  ├── Session cookie
  ├── POST /v1/gmail/push
  └── Status and settings API
    │
    │  verifies Pub/Sub JWT, enqueues, returns
    ▼
[ Cloudflare Queue · mailbox-events ]
    │
    ▼
[ apps/pipeline · Cloudflare Worker ]
  ├── Mailbox Durable Object     ordered history.list
  ├── MailTriage Workflow        one Gmail message
  └── Cron                       watch renewal and catch-up
    │
    ├── [ D1 ]            accounts, tokens, mailbox, activity, policies
    ├── [ KV ]            short-lived Gmail access tokens
    ├── [ Vectorize ]     policy chunks, Phase 2
    ├── [ R2 ]            policy files, Phase 2
    ├── [ AI Gateway ]    classify and draft calls
    └── [ Gmail API ]

[ Google Cloud Pub/Sub ]
  topic mailer-staging-gmail
  push subscription → POST /v1/gmail/push
    ▲
    │  users.watch
[ Gmail ]
```

CI runs `apps/evals`. The deploy set omits it.

---

## 3. Tier-by-Tier Component Breakdown

### Tier 1: Connect UI (`apps/web`)

The client is a React app built with Vite. The gateway Worker serves the built files as static assets. The browser calls the API on the same origin, so the session cookie can use `SameSite=Lax`.

Phase 1 screens:

- `/` explains the product and starts Connect.
- `/connected` shows the Gmail address, the watch state, and Disconnect.
- `/error` shows a denied consent or a failed token exchange.

Phase 2 adds `/policies`, `/activity`, and `/settings`.

The client calls the gateway. The gateway stores the Google token.

### Tier 2: Public Worker (`apps/gateway`)

The gateway ends the user request and the Pub/Sub request. Classification runs on the pipeline.

- Starts OAuth with `access_type=offline` and `prompt=consent`, so Google returns a refresh token.
- Checks the OAuth `state` value from KV. The value expires after 10 minutes.
- Exchanges the code with the client secret.
- Encrypts the refresh token and upserts the account in D1.
- Creates missing Mailer labels and stores their Gmail ids.
- Calls `users.watch` and stores the history cursor and the expiration.
- Sets an `HttpOnly` session cookie. The session row lives for 30 days.
- Verifies the Pub/Sub OIDC token on `POST /v1/gmail/push`.
- Resolves the Gmail address to an account id. An unknown address returns `204` and enqueues nothing.
- Enqueues `{ accountId }` and returns `204`. The mailbox object reads history from its own cursor, so the push history id is not needed.

The OAuth scopes are `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/gmail.modify`.

### Tier 3: Private Worker (`apps/pipeline`)

The pipeline Worker has three handlers.

- **Queue consumer.** It loads the mailbox Durable Object for `accountId` and asks for a history sync.
- **Mailbox Durable Object.** The object id is the account id. It runs one history sync at a time for that account. See the sync steps below.
- **Workflow.** `MailTriage` takes `{ accountId, messageId, threadId }`. The instance id is `<accountId>-<messageId>`. Each step does one side effect and can retry on its own.
- **Cron.** Every six hours it renews a watch that expires within 36 hours. Every hour it enqueues `{ accountId }` for each connected mailbox. The catch-up uses the same Durable Object path as a push.

The object can take a second request while it waits on a Gmail `fetch`. Storage gates do not cover outbound calls. So the object chains each sync on one promise in memory. A new request waits for the previous sync to finish.

History sync steps, in order:

1. Read `mailboxes.gmail_history_id` from D1. When the row is missing, stop. The mailbox is gone or not ready.
2. Call `history.list` with `startHistoryId`, `historyTypes=messageAdded`, and `labelId=INBOX`. Follow each page.
3. Drop each message that has the `SENT` or the `DRAFT` label. That removes the user's own mail and every Mailer draft.
4. Start one `MailTriage` per remaining message. A duplicate instance id fails on create. Treat that error as done.
5. Write the `historyId` from the response to D1. The update keeps the larger value, so the cursor never moves backward.

When `history.list` returns `404`, the cursor is too old. Call `users.getProfile`, write its `historyId` as the cursor, and log the gap with the account id. Mail in that gap stays unlabeled.

Workflow steps, in order:

1. Load the account and reject a disconnected mailbox.
2. Stop when the message id is already in the activity table.
3. Read a cached access token, or refresh one and store it in KV.
4. Fetch the message. Read the subject, the sender, and the plain-text part. When the message has HTML only, derive text from that part. Ignore attachments.
5. Classify through AI Gateway. Parse the result with the Zod schema. Apply the action rules in the PRD.
6. Phase 2 only: when the model returned `draft_reply` and drafts are on, query Vectorize with a metadata filter on `accountId`.
7. Call `users.threads.modify`. Add the label for the action. Remove the other Mailer category labels from the thread. Remove `INBOX` when the action is `archived`.
8. Phase 2 only: create one draft when the action is `drafted`.
9. Write the activity row.

Two guards stop a duplicate draft:

- The fixed instance id stops a second Workflow for the same message while Workflows keeps the instance.
- Step 2 and the unique key `(account_id, gmail_message_id)` stop a run after that retention window.

Inside one instance, a finished step does not run again on retry. A retry of step 7 sends the same label change, so the result does not change.

The Workflow calls the model. The Durable Object stays on history sync.

### Tier 4: Gmail and Pub/Sub

One Google Cloud project holds the OAuth client and the topic `mailer-staging-gmail`. The Worker var `PUBSUB_TOPIC` names the topic.

Grant `gmail-api-push@system.gserviceaccount.com` the Pub/Sub Publisher role on that topic. Point the push subscription at `https://<gateway-host>/v1/gmail/push` with an OIDC token. The gateway checks the issuer, the audience, and the service account email.

`users.watch` uses this body:

```json
{
  "topicName": "projects/<GCP_PROJECT_ID>/topics/<PUBSUB_TOPIC>",
  "labelIds": ["INBOX"],
  "labelFilterBehavior": "INCLUDE"
}
```

The watch covers the inbox. Mail that skips the inbox is out of version 1. Google expires a watch within seven days. The cron renews it.

The push body carries an email address and a history id. The gateway uses the address only. The Durable Object calls `history.list` from the stored cursor. The Workflow then calls `users.messages.get`.

The watch filter limits the pushes to the inbox. It does not filter `history.list`. That call needs its own `labelId=INBOX`.

### Tier 5: Data stores

- **D1** holds accounts, sessions, the encrypted refresh token, mailbox cursors, activity, and policy metadata. Drizzle defines the schema in `packages/db`. SQL files live in `infra/migrations`.
- **KV** holds the OAuth `state` value and the Gmail access token. The access token key is `access:<accountId>`. The TTL is shorter than `expires_in`.
- **Vectorize** holds policy chunks in Phase 2. Each vector metadata includes `accountId` and `documentId`. The same embedding model writes the index and builds the query.
- **R2** holds the original policy file in Phase 2. Mail bodies stay out of R2.
- **Worker secret** `TOKEN_ENCRYPTION_KEY` is 32 bytes, base64. The cipher is AES-256-GCM from Web Crypto. The associated data is the account id. A copied blob fails decryption under another account id. The row stores `encryption_nonce` and `encrypted_refresh_token`.

D1 tables:

- `accounts` — id, google sub claim, Gmail address, created time
- `sessions` — token hash, account id, expiry
- `oauth_tokens` — account id, encrypted refresh token, encryption nonce, consent time
- `mailboxes` — account id, Gmail history id, Gmail watch expiry, label id by name, status
- `activities` — account id, Gmail message id, Gmail thread id, email subject, category, model confidence, Mailer action, model id, prompt tokens, completion tokens, triage duration, created time
- `policies` — id, account id, title, R2 key, created time

`activities` has a unique key on `(account_id, gmail_message_id)`. `category` is null when the model output did not parse. `mailer_action` is one of `ACTIVITY_ACTION` in `packages/domain`.

`mailboxes.gmail_history_id` is the only copy of the cursor. The gateway writes it once on connect. After that, only the mailbox Durable Object writes it. The Durable Object keeps no cursor in its own storage, so disconnect has one row to delete.

### Tier 6: Models

AI Gateway fronts every model call so the activity row can store the model id and the token counts. Turn off request and response logging on that gateway. A prompt holds the mail body.

Phase 1 uses one chat model for classification at temperature 0. The response must be JSON that matches the Zod schema. A parse failure retries the step once with the validation error attached. A second failure writes `needs_review` and still applies that label.

Phase 2 uses the same gateway for the draft. Embeddings use a Workers AI embedding model through the gateway. The model ids are settings. Read the current model list before the first deploy, and store the chosen ids in the Worker config.

### Tier 7: Shared packages

- `packages/domain` exports the queue payload, the email triage schema, the label names, the activity actions, and the thresholds `CLASSIFY_MIN_CONFIDENCE` (`0.7`) and the Phase 2 retrieval threshold.
- `packages/gmail` wraps the REST methods this product calls. The public exports omit send.
- `packages/tokens` encrypts and decrypts the refresh token.
- `packages/db` is the Drizzle schema and the queries. Gateway and pipeline both use it.

---

## 4. Request Lifecycle Scenarios

### Scenario A: The user connects Gmail

1. The browser loads `/` from the gateway assets.
2. Connect navigates to `/v1/oauth/start`.
3. The gateway stores `state` in KV and redirects to Google.
4. Google redirects to `/v1/oauth/callback`.
5. The gateway checks `state`, exchanges the code, and encrypts the refresh token.
6. The gateway upserts the account, creates labels, and calls `users.watch`.
7. The gateway stores the history cursor from that response. That cursor is the start line. Older mail stays out.
8. The gateway sets the session cookie and redirects to `/connected`.

### Scenario B: A new inbox message arrives

1. Gmail publishes to the topic of the environment.
2. Pub/Sub calls `POST /v1/gmail/push` with a Google OIDC token.
3. The gateway verifies the token, maps the address to an account, and enqueues `{ accountId }`.
4. The gateway returns `204`.
5. The queue consumer calls the mailbox Durable Object.
6. The object lists inbox history from the stored cursor and drops sent mail and drafts.
7. The object starts `MailTriage` for each new id and then saves the new cursor.
8. The Workflow fetches the message, classifies it, replaces the category label, and writes activity.
9. In Phase 2, a qualifying Inquiry or Action Required message also gets one draft.

### Scenario C: The user disconnects

1. The browser calls `POST /v1/disconnect`.
2. The gateway reads the refresh token, calls Google revoke, and calls `users.stop`.
3. The gateway deletes the account rows in D1 and the access token in KV.
4. Phase 2 also deletes R2 objects and Vectorize vectors for that account.
5. The gateway clears the session cookie.

A failed revoke still deletes the local rows. The user can also remove the grant in the Google Account page. The next refresh failure marks the mailbox `disconnected`.

### Scenario D: A push is missed

1. The hourly cron enqueues `{ accountId }` for each mailbox in status `connected`.
2. The Durable Object reads history from the stored cursor.
3. When the cursor is still current, the object finishes with no Workflow.
4. When Gmail returns new message ids, the object starts the same Workflow as a push.

---

## 5. Security and Idempotency

### Token use

The pipeline decrypts the refresh token only after a KV miss. It sends the refresh token to Google and stores the access token in KV. The step then drops both values. Logs and activity rows omit tokens.

### Push authentication

A missing or invalid OIDC token gets `401`. Pub/Sub will retry. An unknown mailbox gets `204`. Pub/Sub then stops that retry. A duplicate push enqueues a second `{ accountId }`. The second sync finds no new history and starts no Workflow. The Gmail message id is the idempotency key.

### Prompt boundary

The classifier and the draft model treat the mail body as data. The system instruction says to follow the schema and the policy chunks. Mail text can still contain instructions. The action rules in the PRD run after the model returns. High Priority and Spam stay on `label_only`. A score under `0.7` becomes `needs_review`.

### What the worker can call

Allowed Gmail methods:

- `users.watch`
- `users.stop`
- `users.getProfile` to reset an expired cursor
- `users.history.list`
- `users.messages.get`
- `users.labels.create`
- `users.labels.list`
- `users.threads.modify`
- `users.drafts.create` in Phase 2

Forbidden methods stay out of `packages/gmail`:

- `users.messages.send`
- `users.drafts.send`
- `users.messages.delete`
- `users.threads.delete`

A test imports the package exports and fails when a forbidden name is present.

### Queue and Workflow retries

Cloudflare Queues can deliver a message more than once. The consumer can run the Durable Object again. `history.list` from the stored cursor returns only the unseen tail. When a sync fails before it saves the cursor, the next sync lists the same messages again. The fixed Workflow instance id makes that repeat a no-op.

Pass message ids into the Workflow. Leave the raw body out of the durable argument. The fetch step loads the body. The audit row omits the body.

Read the current Workflow limits before you set step timeouts. Confirm the allowed characters and the length of an instance id, and the retention of a finished instance. Read the current Queues limits before you set consumer concurrency. The mailbox object is the per-account limit, even when the queue runs several accounts at once.

---

## 6. Deployment

Every test runs on Cloudflare. Gmail push needs a public HTTPS URL, so the full flow cannot run on a laptop. Do not use `cf dev` or a `--local` command against D1, KV, a queue, or R2.

### Staging

Mailer has one environment: staging. Each Cloudflare and Google resource name is `mailer-staging-<role>`. The environment sits in the middle. Jobber uses the same order, for example `jobber-staging-db`.

- Workers `mailer-staging-gateway` and `mailer-staging-pipeline`
- D1 database `mailer-staging-db`
- Pub/Sub topic `mailer-staging-gmail`
- A KV namespace, a queue, an R2 bucket, or a Vectorize index takes the form `mailer-staging-<role>`, such as `mailer-staging-events`.

`cloudflare.config.ts` is the Worker config for `cf`. It replaces `wrangler.toml`. Each Worker builds with the Cloudflare Vite plugin. `cf` needs that build tool. It does not run the `build` script in `package.json`.

Name each data store in `cloudflare.config.ts` when the code first binds it. `cf deploy` creates a missing KV namespace or queue from the name. The deploy workflow creates the D1 database, because the migrations run before the deploy.

### Deploy workflow

`.github/workflows/deploy-staging.yml` is the only workflow. It runs on each push to `develop`, and on a manual run. Its jobs follow the Nearcrawl layout:

1. **Detect changes.** A SQL file under `infra/migrations` requests the migrations. A change under `packages/`, in the lockfile, or in the workflow deploys both Workers. A change under `apps/web` deploys the gateway, because the gateway serves the web assets.
2. **Lint, typecheck, test, and build.**
3. **Apply database migrations.** Find the D1 database `mailer-staging-db`, then run `cf d1 migrations apply` on Cloudflare.
4. **Deploy gateway** and **Deploy pipeline.** Each job runs `cf deploy` for one changed Worker, after the migrations succeed or skip.
5. **Staging summary.** Print the result of each job. Fail when a requested job failed.

A manual run can force the migrations and the deploy of each Worker.

Phase 3 adds an eval job to that workflow. The eval job calls the model, so it needs a model secret.

### One-time setup

Do these steps once. CI cannot do them.

1. In GitHub, add the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
   - Phase 1 needs these token permissions: Workers Scripts edit, D1 edit, Workers KV Storage edit, and Queues edit.
   - Phase 2 adds R2 edit and Vectorize edit.
2. Push to `develop`. The first deploy creates the two Workers.
3. Set the Worker secrets on each Worker in the Cloudflare dashboard, or with `npx wrangler secret put <NAME> --name <WORKER_NAME>`. `cf` has no single-secret command yet.
4. In Google Cloud, do the setup below.

### Worker secrets and vars

- `mailer-staging-gateway` serves the assets and the public API.
  - Bind D1, KV, and the queue producer.
  - Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT`, `GCP_PROJECT_ID`, and `PUBSUB_TOPIC`.
- `mailer-staging-pipeline` has no public route. It runs the queue consumer, the Durable Object, the Workflow, and the cron.
  - Bind D1, KV, the queue consumer, Vectorize, R2, AI Gateway, and Workflows.
  - Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `TOKEN_ENCRYPTION_KEY`. A token refresh needs the client secret.
  - Set the AI Gateway identifier and the model ids.

Use the same `TOKEN_ENCRYPTION_KEY` on both Workers. A token written by the gateway must decrypt on the pipeline.

`GOOGLE_CLIENT_ID`, `GCP_PROJECT_ID`, and `PUBSUB_TOPIC` may be vars. The rest are secrets. Do not commit them.

### Google Cloud setup

Google Cloud setup is manual for version 1.

1. Create an OAuth web client. Add the callback URL of the gateway on its `workers.dev` host.
2. Add the test users on the consent screen.
3. Create the topic `mailer-staging-gmail`. Give it one push subscription to `POST /v1/gmail/push` on the gateway.
4. Grant the Gmail push service account the publisher role on that topic.

The OAuth app stays in Google testing mode until Google finishes the restricted-scope review. In testing mode, a refresh token expires 7 days after consent. The next refresh fails with `invalid_grant`, and the mailbox moves to `disconnected`. For a Google Workspace account, an internal OAuth app avoids that expiry.

### Why these Cloudflare products

- **Workers** run the webhook and the jobs. No process stays up between requests.
- **Workers static assets** serve the connect UI on the same origin as the cookie.
- **Queues** release the Pub/Sub request before classification starts.
- **Workflows** retry one Gmail step or one model step. A finished step stays finished.
- **Durable Objects** keep one history cursor per mailbox in order.
- **Cron Triggers** renew the seven-day watch and run the catch-up.
- **D1** stores the relational rows.
- **KV** stores values that expire on their own.
- **Vectorize** and **Workers AI embeddings** store and query policy chunks.
- **R2** stores the policy file.
- **AI Gateway** records model id and tokens for the activity row.

---

## 7. Directory Structure & Repository Layout

The repo is one pnpm workspace. Turborepo runs every package. Node.js 22 is required.

```text
mailer/
├── package.json
├── pnpm-workspace.yaml               # apps/* and packages/*
├── turbo.json
├── .github/
│   └── workflows/
│       └── deploy-staging.yml        # develop → staging: checks, migrations, deploys
├── docs/
│   ├── prd.md
│   ├── architecture.md
│   ├── delivery.md                   # release scope of each phase
│   └── phase-1-plan.md               # Phase 1 setup, schema, routes, checkpoints
├── apps/
│   ├── web/                          # React screens. Built into gateway assets.
│   ├── gateway/                      # Public Worker. cloudflare.config.ts, vite.config.ts
│   ├── pipeline/                     # Private Worker. cloudflare.config.ts, vite.config.ts
│   └── evals/                        # Golden set. Not deployed.
├── packages/
│   ├── db/
│   ├── domain/
│   ├── gmail/
│   └── tokens/
└── infra/
    └── migrations/
```

Scripts at the root match a Nearcrawl-style workspace:

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm typecheck
```

`pnpm dev` starts the web screens and the gateway routes that use no binding. A flow that needs D1, KV, a queue, or Gmail runs on staging. Section 6 describes the deploy.

---

## 8. Phase map

Phase 1 deploys the gateway, the pipeline, D1, KV, the queue, the Workflow, and the cron. Vectorize, R2, and `users.drafts.create` stay out. The classifier still runs, and the only Gmail write is a label.

Phase 2 adds the policy path, the draft step, and the three extra screens.

Phase 3 adds `apps/evals` to CI. The runtime Workers stay the gateway and the pipeline.
