# Delivery phases

Mailer ships in the three phases of [prd.md](prd.md). Each phase is one release. A phase ships only when every release check in that phase passes.

- [prd.md](prd.md) owns the behavior and the user stories. This file names the stories that each phase covers.
- [architecture.md](architecture.md) owns the components, the tables, and the bindings.
- CI deploys and applies the D1 migrations when the user merges. An agent does not merge, deploy, or run a migration.

Every test runs on Cloudflare. Nothing runs against local infrastructure.

- A push to `develop` deploys to staging. Staging is the only environment. Refer to [architecture.md](architecture.md), section 6.
- Inside a phase, the build order is a list of checkpoints. Merge each checkpoint to `develop`, then test it on staging with a test Gmail account.
- A checkpoint is not a release. A phase releases when its release check passes on staging.

---

## Phase 1: Connect and label

**User outcome.** The user connects Gmail once. After that, each new inbox message gets one Mailer category label in Gmail. The user can disconnect at any time.

**Implementation plan.** [phase-1-plan.md](phase-1-plan.md) holds the setup runbook, the schema, the routes, the checkpoints, and the business constraints.

### User scenarios

- **Decide before consent**
  - A visitor reads what Mailer does with new mail. (US-1.1)
  - A visitor sees the warning that the Google permission includes send, before the Connect button. (US-1.2)
- **Connect**
  - A visitor connects a Gmail account with Google sign-in. (US-1.3)
  - A visitor who denies consent, or whose token exchange fails, sees an error and a retry link. (US-1.4)
  - A connected user who comes back sees the same mailbox. (US-1.5)
  - A connected user sees the Gmail address, the active watch, and the time of the last label.
  - While the Google app is in testing mode, a connected user sees the date when Google will end access.
- **Get a label in Gmail**
  - A new inbox message gets a label while the user stays in Gmail. (US-2.1)
  - Mail from before the connection stays unchanged. (US-2.2)
  - Sent mail and drafts get no label. (US-2.6)
  - Each message gets one category: Spam, High Priority, Action Required, or Inquiry. (US-3.1, US-3.2)
  - An unsure message gets Needs Review only. (US-3.3)
  - A newer message on a thread replaces the older category label.
  - High Priority and Spam get a label only. Spam stays in the inbox. (US-3.4, US-3.5)
- **Trust the labels**
  - A duplicate push does not label a message twice. (US-2.3)
  - Two close pushes run in order. (US-2.5)
  - A missed push is recovered within one hour. (US-2.4)
  - An old history cursor does not stop the labels. (US-2.7)
  - The watch renews before its seven-day expiry.
- **Leave**
  - A connected user disconnects. Mailer stops the watch and deletes the token, the mailbox, and the activity rows. (US-1.6, US-6.4)
  - After Google ends access, the next visit asks the user to connect again. (US-1.7)

### What ships

- `apps/web` — the before-connect, connected, and error screens
- `apps/gateway` — OAuth, the session, the status API, disconnect, and `POST /v1/gmail/push`
- `apps/pipeline` — the queue consumer, the mailbox Durable Object, the `MailTriage` Workflow, and the cron
- D1 migration — `accounts`, `sessions`, `oauth_tokens`, `mailboxes`, and `activities`
- Cloudflare — D1, KV, the queue, Workflows, Cron Triggers, and AI Gateway with logging off
- Google Cloud — the OAuth client, the test users, and one topic with a push subscription for each environment
- Secrets — the full list in [architecture.md](architecture.md), section 6

### Build order

1. Serve the before-connect screen from the gateway.
2. Connect, then show the connected and error screens. Store the encrypted token.
3. Disconnect. Revoke the token and delete the rows.
4. Create the labels, start the watch, and accept the push. Label each new message `Mailer/Needs-Review`. This step proves the path from Gmail back to Gmail.
5. Classify through AI Gateway. Apply the action rules. Replace the category label on the thread.
6. Add the cron for the watch renewal and the hourly catch-up. Add the `404` cursor recovery.
7. Mark a mailbox `disconnected` on `invalid_grant`. Show the connect-again screen.

### Release check

Run these steps on staging.

1. Connect a test account. The connected screen shows the Gmail address.
2. Send one message of each category to that inbox. Each thread gets the expected label within 30 seconds.
3. Reply from Gmail. The reply gets no label.
4. Disconnect. D1 has no row for that account, and the watch stops.

---

## Phase 2: Policy and drafts

**User outcome.** The user writes reply rules in Mailer. For an Inquiry or an Action Required message that a rule covers, a draft reply waits in Gmail Drafts. The user reviews it and sends it from Gmail. The user can see what Mailer did, and can turn drafts off or allow Spam archive.

### User scenarios

- **See what Mailer did**
  - A connected user opens the activity list and sees the time, the subject, the category, and the action. (US-6.1)
  - A new account sees an empty state, not an error. (US-6.2)
- **Write reply rules**
  - A connected user adds a policy with a title and text. (US-5.1)
  - A connected user deletes a policy. Later drafts stop using it. (US-5.2)
  - One account never reads the policies of another account. (US-5.3)
- **Get a draft to send**
  - An Inquiry or an Action Required message that a policy covers gets one draft and the label `Mailer/Drafted`. (US-4.1)
  - The user sends the draft from Gmail. Mailer never sends. (US-4.2)
  - With no policy, or with weak retrieval, the message keeps its category label and gets no draft. (US-4.3)
  - The draft body holds the reply only. Citations stay on the activity row. (US-4.4)
  - A retry never creates a second draft. (US-4.6)
- **Control the worker**
  - A connected user turns drafts off and keeps the labels. (US-4.5)
  - A connected user allows Mailer to archive Spam. The default is deny. (US-6.3)
- **Leave**
  - Disconnect also deletes the policy files and the vectors. (US-1.6)

### What ships

- `apps/web` — the activity, policies, and settings screens
- `apps/gateway` — the activity, policy, and settings APIs
- `apps/pipeline` — the retrieval step, the draft step, and the archive action
- D1 migration — `policies`
- Cloudflare — R2, Vectorize, and a Workers AI embedding model
- Gmail — `users.drafts.create` and the label `Mailer/Drafted`

### Build order

1. Show the activity list. The rows exist from Phase 1.
2. Add and delete a policy. Store the file in R2 and the chunks in Vectorize.
3. Create a draft when the action is `drafted`.
4. Add the settings screen with the draft switch and the archive switch.

### Release check

Run these steps on staging.

1. Add a refund policy. Send a refund question. A draft that follows the policy waits in Gmail Drafts.
2. Delete that policy. Send the same question. The thread gets `Mailer/Inquiry` and no draft.
3. Turn drafts off. A covered question gets a label and no draft.
4. Allow archive. A spam message leaves the inbox with `Mailer/Spam`.
5. The activity list shows each of those messages with the correct action.

---

## Phase 3: Evaluation gate

**User outcome.** A model change or a prompt change cannot reach the user when it labels worse or drafts worse than the baseline.

Phase 3 changes CI only. No Worker deploys. It can start any time after Phase 1. The policy check needs Phase 2.

### User scenarios

- **Guard the labels**
  - The maintainer keeps a versioned set of threads with a known category. (US-7.1)
  - Each pull request reports category accuracy and Spam precision. A drop of more than 2 percentage points below the baseline fails the check. (US-7.2)
- **Guard the drafts**
  - Each pull request scores fixture drafts against a fixture policy. A draft that breaks the policy fails the check. (US-7.3)
- **Track cost and delay**
  - Each pull request prints the latency and the token counts. The activity row stores them from Phase 1. (US-7.4)
- **Keep behavior after a deploy**
  - A connected user gets the labels that the golden set describes after each release. (US-7.5)

### What ships

- `apps/evals` — the golden threads, the fixture policies, and the baseline file
- `.github/workflows/deploy-staging.yml` — the eval job, which runs `turbo run eval` with the model secret

### Release check

1. The first run writes the baseline file into the repo.
2. A pull request that swaps in a weaker prompt fails the check.
3. A pull request from a fork skips the eval job and passes the other checks.
