# System Architecture Document: Mailer

## 1. Executive Summary

Mailer is an AI email client for one Gmail account, on Cloudflare. `apps/gateway` is the public origin. It serves the web app and the mail API, and it accepts the Gmail push. `apps/pipeline` does the slow work. A Cloudflare Queue sits between them so the push returns before classification starts.

Phases 1 to 3 run as a headless worker. From Phase 4, the web app is the mail client. It reads Gmail at the time of each view, and it adds no stored mail. From Phase 1, the pipeline keeps an encrypted copy of the text of each email that it classifies. From Phase 6, that copy covers all mail of the last 90 days, and AI search and autocomplete read it.

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
  ├── Status and settings API
  ├── Mail API                   threads, drafts, Send, labels, splits · Phase 4
  ├── AI API                     filters, todos, Organize, writing · Phase 5
  ├── Search API                 find and ask · Phase 6
  └── Suggestion API             autocomplete · Phase 7
    │
    │  verifies Pub/Sub JWT, enqueues, returns
    ▼
[ Cloudflare Queue · mailbox-events ]
    │
    ▼
[ apps/pipeline · Cloudflare Worker ]
  ├── Mailbox Durable Object     ordered history.list
  ├── MailTriage Workflow        one Gmail message
  ├── MailBackfill Workflow      inbox mail of the last 30 days, at connect
  ├── MailStore Workflow         one changed message · Phase 2
  ├── MailImport Workflow        correction · Phase 2. 90-day import · Phase 6
  ├── MailDelete Workflow        delete the store of one account
  └── Cron                       watch renewal, catch-up, daily correction
    │
    ├── [ D1 ]            accounts, tokens, mailbox, activity, policies,
    │                     splits, filters, todos, message rows, data keys
    ├── [ KV ]            short-lived Gmail access tokens
    ├── [ Vectorize ]     policy chunks, Phase 2. Mail chunks, Phase 6
    ├── [ R2 ]            encrypted mail text, Phase 1. Policy files, Phase 2
    ├── [ AI Gateway ]    each model call
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

### Tier 1: Web app (`apps/web`)

The client is a React app built with Vite. The gateway Worker serves the built files as static assets. The browser calls the API on the same origin, so the session cookie can use `SameSite=Lax`.

Phase 1 screens:

- `/` explains the product and starts Connect.
- `/connected` shows the Gmail address, the watch state, and Disconnect.
- `/error` shows a denied consent or a failed token exchange.

Phase 2 adds `/policies`, `/activity`, and `/settings`.

Phase 4 adds the mail client: the inbox with its tabs, the thread view, the compose box, the side list, the search bar, and the splits screen.

- The thread view shows an HTML message in a sandboxed `iframe` with scripts off. Remote images stay off until the user allows them for that message.
- The compose box saves a Gmail draft while the user types. Send is one request for that draft.

Phase 5 adds the filters screen, the todo list, the Organize proposal, and the AI controls in the compose box. Phase 6 adds the find mode and the ask mode to the search bar. Phase 7 adds the grey suggestion to the compose box.

The client calls the gateway. The gateway stores the Google token. The browser holds no Google token.

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
- Enqueues the backfill event after the D1 write of the callback.

The queue payload is `{ accountId, type }`. The type is `sync`, `backfill`, or `delete`. Where this file writes `{ accountId }`, the type is `sync`.

The OAuth scopes are `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/gmail.modify`. Phases 4 to 7 add no scope.

From Phase 4, the gateway is also the mail API. Each route group follows the gateway layout in `.cursor/rules/mailer.mdc`. Each use case takes the account id from the session.

- **Threads, labels, and attachments (Phase 4).** A use case calls the Gmail client and returns JSON. It reads Gmail at the time of the request, and it stores nothing.
  - The thread list calls `users.threads.list`. That call returns ids only. The use case then reads the metadata of those threads in one Gmail batch request.
  - Delete calls `users.threads.trash`. Restore calls `users.threads.untrash`.
- **Drafts and Send (Phase 4).** The compose box saves a Gmail draft with `users.drafts.create` and `users.drafts.update`. Send calls `users.drafts.send` for that draft. This use case is the only caller of a send method.
- **Splits (Phase 4).** A split is a row with a name, a Gmail query, and an order. A tab is `users.threads.list` with that query.
- **Filters and todos (Phase 5).** D1 rows behind repositories. The filter test runs the classifier on each selected thread and returns the action and the reason. It calls no Gmail write.
- **Organize (Phase 5).** One model call receives the subject, the sender, and the snippet of 50 inbox threads at most. It returns the three groups. The screen holds the proposal. A confirm request applies one group.
- **Writing (Phase 5).** One model call for each request. The use case returns text to the compose box. It calls no Gmail method.
- **Search (Phase 6).** Refer to Scenario G.
- **Suggestions (Phase 7).** Refer to Scenario H.

### Tier 3: Private Worker (`apps/pipeline`)

The pipeline Worker has three handlers.

- **Queue consumer.** For a `sync` event, it loads the mailbox Durable Object for `accountId` and asks for a history sync. For a `backfill` event, it starts `MailBackfill`. For a `delete` event, it starts `MailDelete`, but only when the account row is gone.
- **Mailbox Durable Object.** The object id is the account id. It runs one history sync at a time for that account. See the sync steps below.
- **Workflow.** `MailTriage` takes `{ accountId, messageId, threadId, source }`. The source is `sync` or `backfill`. The instance id is `<accountId>-<messageId>`. Each step does one side effect and can retry on its own.
- **Workflow.** `MailBackfill` takes `{ accountId }`. It runs one time for each connection. See the backfill steps below.
- **Workflow.** `MailDelete` takes `{ accountId }`. It deletes the mail store of one account after disconnect. Refer to Scenario C.
- **Cron.** Every six hours it renews a watch that expires within 36 hours. Every hour it enqueues `{ accountId }` for each connected mailbox. The catch-up uses the same Durable Object path as a push.
  - The hourly run also enqueues a delete event for each account id in `messages` that has no `accounts` row.

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
   - The same step stores the encrypted copy of the message. Refer to "Mail store" in Tier 5. The full body and the plain data key stay out of the step output.
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

From Phase 5, step 5 also sends the filters of the account to the classifier, and step 7 adds the actions of each matched filter. A `needs_review` action runs no filter.

A run with the source `backfill` differs in two places:

- In step 4, it stops when the message already has a Mailer category label. It stores no copy of that message. So a label from a newer message stays.
- It adds a label only, in every phase. Step 6, step 8, the archive of step 7, and the filter actions do not run.

#### Backfill at connect (Phase 1)

The backfill labels the inbox mail from before the connection. `MailTriage` stores a copy of each message that it classifies for the backfill. Sync does not wait for the backfill, so new mail gets its label while the backfill runs.

The instance id of `MailBackfill` holds the account id and the consent time. One connection gets one backfill, and a second delivery of the queue event starts nothing.

Backfill steps, in order:

1. Load the mailbox. Stop when the row is missing or the status is `disconnected`.
2. List one page of 100 inbox messages of the last 7 days with `users.messages.list`. The query leaves sent mail and drafts out. Gmail leaves Spam and Trash out.
3. Keep the first message of each thread. Gmail lists the newest message first, so that message is the newest one of the thread. Checkpoint 10 of [phase-1-plan.md](phase-1-plan.md) proves that order on staging.
4. Start one `MailTriage` with the source `backfill` for each kept message. The instance id is the same as for sync, so a message that sync already started gets no second run.
5. Wait 60 seconds, then read the next page. The wait keeps the model calls under the rate limit of the provider.
6. After the last page, repeat steps 2 to 5 for days 8 to 30.

Step 2 of `MailTriage` skips a message that has an activity row. So the backfill of a second connection classifies only the mail that the first connection did not handle.

The two windows and the wait are product values in `packages/domain`. The cost is one model call for each inbox thread of the last 30 days.

#### Sync for the mail store (Phase 2 and Phase 6)

Sync keeps the mail store equal to Gmail. The store holds a message only while Gmail holds it outside Trash and Spam, and only when it is not a draft.

- **Phase 2** is the first build step after Phase 1. Sync removes a stored message that the user deletes, moves to Trash, or marks as spam. It adds the message again on a restore. The store still holds only the mail that Mailer classified.
- **Phase 6** adds each new email and each sent email, and the 90-day import.

History sync changes in two places, from Phase 2:

- `history.list` has no `labelId`. It reads `messageAdded`, `messageDeleted`, `labelAdded`, and `labelRemoved`.
- Step 3 and step 4 still start `MailTriage` only for an added message that has `INBOX`, and has neither `SENT` nor `DRAFT`.

The object also starts one `MailStore` Workflow for each message in one of these events:

- `messageAdded` — new mail, and mail that the user sent. This event starts `MailStore` from Phase 6 only. In Phase 2, `MailTriage` stores the new mail that it classifies.
- `messageDeleted` — a permanent delete. Gmail does not use this event for a move to Trash.
- `labelAdded` with `TRASH` or `SPAM` — a move to Trash or to Spam
- `labelRemoved` with `TRASH` or `SPAM` — a restore

Each other label change starts nothing. The instance id of `MailStore` holds the account id, the message id, and the history id, so each event gets its own run.

`MailStore` does not trust the event. It reads the message from Gmail and makes the store match:

1. Call `users.messages.get`.
2. When Gmail returns the message, and the message has no `DRAFT`, `TRASH`, or `SPAM` label, add it to the store.
   - Until Phase 6, this step adds the message only when it has an activity row. So a restore returns only the mail that Mailer classified.
3. When Gmail returns `404`, or the message has `TRASH` or `SPAM`, remove it from the store.
4. Read the labels again. When the result of step 2 or step 3 is now wrong, start again from step 1.

Step 4 covers a move to Trash and a restore that occur close together. The last state in Gmail wins.

A delete in Mailer and a delete in Gmail use this same path. Mailer calls `users.threads.trash`, Gmail records the label change, and sync removes the message.

`MailImport` is the import and the correction. It has two steps:

1. **The import, from Phase 6.** List the mail of the last 90 days with `users.messages.list`. Add each message that the store lacks. Gmail leaves Spam and Trash out of that list. The query leaves drafts out.
2. **The correction, from Phase 2.** List each message id of the mailbox with the same method. The call returns ids only. Remove each stored message whose id is not in that list.

Three events start `MailImport`:

- From Phase 6: the connection of an account, or the Phase 6 release for an account that connected earlier
- A `404` from `history.list`, after the cursor reset. Events in that gap are lost, so the store needs a correction.
- A daily cron, for each connected mailbox. Google recommends a periodic sync, because a push can fail.

`MailDelete` deletes the store of one account. Refer to Scenario C.

Each store Workflow stops when the mailbox row or the data key is missing. So a disconnect ends an import that still runs.

The full mailbox history has more events than the inbox history, because each read and each label change is an event. Gmail sends one push per second at most for one user. The push count of a real mailbox has no measurement yet. Measure it on staging before the Phase 2 release.

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

From Phase 2, the watch body has no `labelIds` and no `labelFilterBehavior`. The watch then covers the full mailbox, and `history.list` has no `labelId`. Trash and Spam are outside the inbox, and the mail store needs their events. From Phase 6, the store also needs the events of sent mail and archived mail.

### Tier 5: Data stores

- **D1** holds accounts, sessions, the encrypted refresh token, mailbox cursors, activity, and policy metadata. Drizzle defines the schema in `packages/db`. SQL files live in `infra/migrations`.
- **KV** holds the OAuth `state` value and the Gmail access token. The access token key is `access:<accountId>`. The TTL is shorter than `expires_in`.
- **Vectorize** holds policy chunks in Phase 2. Each vector metadata includes `accountId` and `documentId`. The same embedding model writes the index and builds the query.
  - From Phase 6, a second index holds the mail chunks. The namespace of each vector is the account id.
- **R2** holds the encrypted body text of each stored message, from Phase 1. The bucket is `mailer-staging-mail`. The object key starts with the account id. Attachments stay in Gmail.
  - From Phase 2, a second bucket holds the original policy file.
- **Worker secret** `TOKEN_ENCRYPTION_KEY` is 32 bytes, base64. The cipher is AES-256-GCM from Web Crypto. The associated data is the account id. A copied blob fails decryption under another account id. The row stores `encryption_nonce` and `encrypted_refresh_token`.
- **Worker secret** `MAIL_ENCRYPTION_KEY` is 32 bytes, base64, from Phase 1. It wraps the data key of each account. Refer to "Mail encryption" in section 5.

D1 tables:

- `accounts` — id, google sub claim, Gmail address, created time
- `sessions` — token hash, account id, expiry
- `oauth_tokens` — account id, encrypted refresh token, encryption nonce, consent time
- `mailboxes` — account id, Gmail history id, Gmail watch expiry, label id by name, status
- `activities` — account id, Gmail message id, Gmail thread id, email subject, category, model confidence, Mailer action, model id, prompt tokens, completion tokens, triage duration, created time
- `policies` — id, account id, title, R2 key, created time
- `splits` (Phase 4) — id, account id, name, Gmail query, position
- `filters` (Phase 5) — id, account id, name, rule text, actions, enabled flag, Gmail label id
- `todos` (Phase 5) — id, account id, name, notes, position, done time
- `todo_threads` (Phase 5) — todo id, Gmail thread id
- `messages` (Phase 1) — account id, Gmail message id, Gmail thread id, sender, recipients, subject, sent time, created time. Phase 6 adds the chunk count. The account id has no foreign key, because `MailDelete` removes these rows after the account row is gone.
- `mail_keys` (Phase 1) — account id, wrapped data key, wrap nonce, created time

`activities` has a unique key on `(account_id, gmail_message_id)`. `category` is null when the model output did not parse. `mailer_action` is one of `ACTIVITY_ACTION` in `packages/domain`.

`mailboxes.gmail_history_id` is the only copy of the cursor. The gateway writes it once on connect. After that, only the mailbox Durable Object writes it. The Durable Object keeps no cursor in its own storage, so disconnect has one row to delete.

#### Mail store (Phase 1 and Phase 6)

The mail store is an encrypted copy of the mail text. [prd.md](prd.md), Epic 8, owns the behavior.

- **Phase 1.** The store holds each email that Mailer classifies. Step 4 of `MailTriage` is the one writer, for sync and for the backfill. No feature reads the store. The store does not follow a delete in Gmail. Disconnect deletes it.
- **Phase 2.** The store follows Gmail. Tier 3 describes the sync that removes a deleted message and returns a restored message. The store gains the remove action.
- **Phase 6.** The store covers all mail of the last 90 days. AI search and autocomplete read it. The store gains the vectors.

A message does not change after Gmail receives it. So the store has two actions: add a message, and remove a message. Labels and the read state stay in Gmail.

- **Add.**
  1. Encrypt the body text with the data key of the account, and write it to R2 at `mail/<accountId>/<gmailMessageId>`.
  2. Write the `messages` row in D1. A row then means that the body exists.
  3. From Phase 6: split the body into chunks, embed each chunk on Workers AI, and upsert the vectors in the namespace of the account id.
  - The vector id comes from the account id, the Gmail message id, and the chunk number. A second run writes the same ids, so it adds no duplicate. Vectorize limits a vector id to 64 bytes.
  - The vector metadata holds the message id, the thread id, and the date. It holds no text.
  - `messages.chunk_count` lets a later job build those vector ids without a Vectorize query.
- **Remove (Phase 2).** Delete the R2 object, then the D1 row. From Phase 6, delete the vectors first. A second run finds nothing and changes nothing.

Size limits that shape this design:

- A D1 database stops at 10 GB, and Cloudflare does not raise that limit. So the body text lives in R2.
- One Vectorize index holds 20,000,000 vectors and 50,000 namespaces on the Workers Paid plan.

### Tier 6: Models

AI Gateway fronts every model call so the activity row can store the model id and the token counts. Turn off request and response logging on that gateway. A prompt holds the mail body.

Phase 1 uses one chat model for classification at temperature 0. The response must be JSON that matches the Zod schema. A parse failure retries the step once with the validation error attached. A second failure writes `needs_review` and still applies that label.

Phase 2 uses the same gateway for the draft. Embeddings use a Workers AI embedding model through the gateway. The model ids are settings. Read the current model list before the first deploy, and store the chosen ids in the Worker config.

Phase 5 adds three kinds of call. The classifier prompt gains the filters of the account. Organize is one call for 50 threads at most. Each writing request is one call.

Phase 6 embeds each mail chunk and each question with the same Workers AI embedding model. The answer call receives the question and the decrypted text of the matched messages. The system instruction says to answer from that text only, and to say when the text holds no answer.

Phase 7 uses a small model for the suggestion. Measure the time of each candidate model on staging, then store the chosen id in the Worker config. The prompt holds the draft, the last message of the thread, and the related text. The model completes the current sentence only.

### Tier 7: Shared packages

- `packages/domain` exports the queue payload, the email triage schema, the label names, the activity actions, and the thresholds `CLASSIFY_MIN_CONFIDENCE` (`0.7`) and the Phase 2 retrieval threshold.
- `packages/gmail` wraps the REST methods this product calls. Until Phase 4, the public exports omit send. From Phase 4, `users.drafts.send` is the one send method.
- `packages/tokens` encrypts and decrypts the refresh token.
- `packages/db` is the Drizzle schema and the queries. Gateway and pipeline both use it.
- `packages/log` forwards a log call to `console`. Gateway and pipeline call `log`.

---

## 4. Request Lifecycle Scenarios

### Scenario A: The user connects Gmail

1. The browser loads `/` from the gateway assets.
2. Connect navigates to `/v1/oauth/start`.
3. The gateway stores `state` in KV and redirects to Google.
4. Google redirects to `/v1/oauth/callback`.
5. The gateway checks `state`, exchanges the code, and encrypts the refresh token.
6. The gateway upserts the account, creates labels, and calls `users.watch`.
7. The gateway stores the history cursor from that response. That cursor is the start line for sync.
8. The gateway enqueues the backfill event. `MailBackfill` labels the inbox mail of the last 7 days, then of days 8 to 30. Mail older than 30 days stays out.
9. The gateway sets the session cookie and redirects to `/connected`.

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
5. Step 3 also deletes the `mail_keys` row. The stored bodies are unreadable from that moment.
6. Step 3 leaves the `messages` rows, and the gateway starts `MailDelete` through the queue. A large mailbox has more objects than one request can delete.
   - In Phase 1, the Workflow deletes the R2 bodies by the prefix of the account, then the `messages` rows.
   - From Phase 6, the Workflow deletes the mail vectors first. The rows supply the vector ids, so they go last.
   - The Workflow ends only when none remain.
   - When the queue send fails, the hourly cron finds the rows that have no account, and starts `MailDelete` again.
7. The gateway clears the session cookie.

A failed revoke still deletes the local rows. The user can also remove the grant in the Google Account page. The next refresh failure marks the mailbox `disconnected`.

### Scenario D: A push is missed

1. The hourly cron enqueues `{ accountId }` for each mailbox in status `connected`.
2. The Durable Object reads history from the stored cursor.
3. When the cursor is still current, the object finishes with no Workflow.
4. When Gmail returns new message ids, the object starts the same Workflow as a push.

### Scenario E: The user sends a reply (Phase 4)

1. The user presses Reply. The compose box opens.
2. While the user types, the browser saves the draft. The gateway calls `users.drafts.create` one time, then `users.drafts.update`.
3. The user presses Send. The gateway calls `users.drafts.send` for that draft id.
4. Gmail sends the message and adds it to the thread with the `SENT` label.
5. From Phase 6, sync sees the added message and stores it. It starts no triage.

No other path calls a send method.

### Scenario F: The user moves a thread to Trash, then restores it (Phase 2)

1. The user presses Delete in Mailer, or in Gmail. In Mailer, the gateway calls `users.threads.trash`.
2. Gmail adds the `TRASH` label to each message of the thread.
3. Sync reads `labelAdded` with `TRASH`, and starts `MailStore` for each message.
4. `MailStore` reads the message, sees `TRASH`, and removes the message from the store. From Phase 6, AI search no longer finds it.
5. The user presses Restore. Gmail removes the `TRASH` label.
6. Sync reads `labelRemoved` with `TRASH`. `MailStore` reads the message and adds it again. Until Phase 6, it adds only a message that Mailer classified.

Until Phase 4, the user does each of these actions in Gmail.

After 30 days in Trash, Gmail deletes the message. Sync reads `messageDeleted`, and `MailStore` finds nothing to remove.

### Scenario G: The user searches with AI (Phase 6)

1. The user types a description or a question.
2. The gateway embeds that text on Workers AI.
3. The gateway queries the mail index in the namespace of the account id from the session.
4. **Find.** The gateway loads the `messages` rows of the matches in one D1 query, and returns the threads.
5. **Ask.** The gateway reads the bodies of the matches from R2, unwraps the data key, and decrypts them. The model writes the answer from that text. The response holds the answer and the thread ids.
6. When no match passes the score threshold, the response states that Mailer found nothing. No model call runs.

### Scenario H: The user gets a suggestion (Phase 7)

1. The user opens a draft. The browser requests the related text for that draft.
2. The gateway queries the mail index with the thread subject and the recipient, decrypts the matched bodies, and returns the related text.
3. The browser holds that text for the draft. No key press queries Vectorize or R2.
4. The user stops for 300 ms. The browser sends the draft, the last message of the thread, and the related text.
5. The gateway calls the small model and returns the end of the sentence.
6. When the user types before the answer arrives, the browser cancels the request and drops the answer.

---

## 5. Security and Idempotency

### Token use

The pipeline decrypts the refresh token only after a KV miss. It sends the refresh token to Google and stores the access token in KV. The step then drops both values. Logs and activity rows omit tokens.

### Push authentication

A missing or invalid OIDC token gets `401`. Pub/Sub will retry. An unknown mailbox gets `204`. Pub/Sub then stops that retry. A duplicate push enqueues a second `{ accountId }`. The second sync finds no new history and starts no Workflow. The Gmail message id is the idempotency key.

### Prompt boundary

The classifier and the draft model treat the mail body as data. The system instruction says to follow the schema and the policy chunks. Mail text can still contain instructions. The action rules in the PRD run after the model returns. High Priority and Spam stay on `label_only`. A score under `0.7` becomes `needs_review`.

The same boundary holds from Phase 5. A filter rule, a search answer, and a suggestion each treat mail text as data. No model output starts a send, a delete, or a move to Trash. A filter can only add the actions that the user chose for it.

### What the worker can call

Allowed Gmail methods:

- `users.watch`
- `users.stop`
- `users.getProfile` to reset an expired cursor
- `users.history.list`
- `users.messages.get`
- `users.messages.list` for the backfill
- `users.labels.create`
- `users.labels.list`
- `users.threads.modify`
- `users.drafts.create` in Phase 2

Phase 4 adds these methods. Only the gateway calls them:

- `users.threads.list` and `users.threads.get`
- `users.threads.trash` and `users.threads.untrash`
- `users.messages.attachments.get`
- `users.drafts.list`, `users.drafts.get`, and `users.drafts.update`
- `users.drafts.delete`, to discard a draft. It removes no sent mail and no received mail.
- `users.drafts.send`, for the Send button only

From Phase 6, `MailImport` also calls `users.messages.list`.

Forbidden methods stay out of `packages/gmail` in every phase:

- `users.messages.send`
- `users.messages.delete`
- `users.messages.batchDelete`
- `users.threads.delete`

Until Phase 4, `users.drafts.send` is also forbidden. A test imports the package exports and fails when a forbidden name is present. From Phase 4, a second test fails when a file in `apps/pipeline` imports the send function.

### Mail encryption (Phase 1)

The mail store uses envelope encryption from its first write in Phase 1. Each account has its own data key, and one Worker secret wraps the data keys.

- **Data key.** 32 random bytes from Web Crypto, one per account. The first store write for the account creates it. A unique key on the account id keeps one row in `mail_keys`.
- **Wrap.** AES-256-GCM under `MAIL_ENCRYPTION_KEY`. The associated data is the account id. D1 holds the wrapped key and its nonce. No store holds the plain data key.
- **Body.** AES-256-GCM under the data key, with a new random 12-byte nonce for each body. The associated data is the account id and the Gmail message id. The R2 object holds the nonce and the ciphertext.
- **Use.** A Worker unwraps the data key for one request or one Workflow step, then drops it. The plain key stays out of KV, D1, and the logs.

Reasons for this design:

- **A copy of the bucket exposes no mail.** A reader needs the D1 row and the Worker secret too.
- **A body cannot move.** A blob that someone copies to another account, or to another message id, fails decryption.
- **Delete is immediate.** Disconnect deletes the `mail_keys` row first. Each body is then unreadable, before `MailDelete` removes the objects.
- **Rotation is cheap.** A change of `MAIL_ENCRYPTION_KEY` wraps each data key again. The bodies stay as they are.
- **One key has one purpose.** `MAIL_ENCRYPTION_KEY` and `TOKEN_ENCRYPTION_KEY` are different secrets. A leak of one does not expose the other.

Limits of this design:

- The `messages` rows and the vectors of Phase 6 have no encryption from Mailer. Search needs the plain vectors, and the result list needs the subject and the sender.
- In Phase 1, the store does not follow a delete in Gmail. The copy of a deleted email stays until disconnect. The sync of Phase 2 removes that limit.
- Cloudflare encrypts D1 and R2 at rest with AES-256-GCM, with keys that Cloudflare manages.
- A vector comes from the text, and it can show the topic of a message. Treat it as mail data. The namespace per account, and the delete on disconnect, are its guards.
- The model provider receives plain mail text inside a prompt. Encryption at rest does not change that.

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
   - Phase 1 needs these token permissions: Workers Scripts edit, D1 edit, Workers KV Storage edit, Queues edit, and Workers R2 Storage edit.
   - Phase 2 adds Vectorize edit.
2. Push to `develop`. The first deploy creates the two Workers.
3. Set the Worker secrets on each Worker in the Cloudflare dashboard, or with `npx wrangler secret put <NAME> --name <WORKER_NAME>`. `cf` has no single-secret command yet.
4. In Google Cloud, do the setup below.

### Worker secrets and vars

- `mailer-staging-gateway` serves the assets and the public API.
  - Bind D1, KV, and the queue producer.
  - Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `PUBSUB_AUDIENCE`, `PUBSUB_SERVICE_ACCOUNT`, `GCP_PROJECT_ID`, and `PUBSUB_TOPIC`.
- `mailer-staging-pipeline` has no public route. It runs the queue consumer, the Durable Object, the Workflows, and the cron.
  - Bind D1, KV, the queue consumer, Vectorize, R2, AI Gateway, and Workflows.
  - Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `TOKEN_ENCRYPTION_KEY`. A token refresh needs the client secret.
  - Bind the mail bucket, and set `MAIL_ENCRYPTION_KEY`. The value is 32 bytes, base64, and it differs from `TOKEN_ENCRYPTION_KEY`.
  - Set the AI Gateway identifier and the model ids.

Use the same `TOKEN_ENCRYPTION_KEY` on both Workers. A token written by the gateway must decrypt on the pipeline.

Later phases add these settings:

- **Phase 5.** The gateway also calls models. Set the AI Gateway identifier, the model ids, and the model secret on the gateway.
- **Phase 6.** Bind the mail index on both Workers, and the mail bucket on the gateway. Set `MAIL_ENCRYPTION_KEY` on the gateway, with the same value as on the pipeline. The pipeline encrypts a body, and the gateway decrypts it.
- **Phase 7.** Set the id of the suggestion model on the gateway.

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
- **Vectorize** and **Workers AI embeddings** store and query policy chunks, and mail chunks from Phase 6.
- **R2** stores the policy file, and the encrypted mail text from Phase 6.
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
│   ├── features.md                   # feature list and its sources
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
│   ├── log/
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

Phase 1 deploys the gateway, the pipeline, D1, KV, the queue, the triage Workflow, the backfill Workflow, the delete Workflow, and the cron. Phase 1 also starts the mail store: the R2 mail bucket, `messages`, `mail_keys`, and `MAIL_ENCRYPTION_KEY`. Vectorize and `users.drafts.create` stay out. The classifier still runs, and the only Gmail write is a label.

Phase 2 starts with the sync for the mail store: the full mailbox watch, `MailStore`, and the correction step of `MailImport`. It then adds the policy path, the draft step, and the three extra screens.

Phase 3 adds `apps/evals` to CI. The runtime Workers stay the gateway and the pipeline.

Phase 4 adds the mail client to `apps/web` and the mail API to the gateway. `users.drafts.send` enters `packages/gmail`. D1 gains `splits`. The pipeline does not change.

Phase 5 adds the filter step to `MailTriage`, and the filter, todo, Organize, and writing APIs to the gateway. D1 gains `filters`, `todos`, and `todo_threads`.

Phase 6 completes the mail store: the full mailbox watch, `MailStore`, `MailImport`, the vector step of `MailDelete`, and a second Vectorize index. The gateway gains the search API, the mail bucket, and `MAIL_ENCRYPTION_KEY`. Phase 6 needs Phase 4 only.

Phase 7 adds the suggestion API to the gateway and the grey suggestion to the compose box. It needs Phase 4 and Phase 6.
