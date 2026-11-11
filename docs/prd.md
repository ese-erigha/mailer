# Product Requirement Document (PRD)

## Project Name: Mailer

---

## 1. Executive Summary & Objective

### 1.1 Executive Summary

Mailer is a headless worker for one Gmail account. It waits for new mail, chooses one category, and writes that category onto the thread as a Gmail label. When a stored policy supports a routine reply, Mailer adds a draft in the Gmail Drafts folder. The user reads the draft in Gmail and sends it there.

The web app connects the Google account, shows the connection, and later holds policies and a short activity list. The user reads mail in Gmail.

The worker runs on Cloudflare. Gmail push delivery still uses one Google Cloud Pub/Sub topic, because the Gmail API delivers mailbox watches only through Pub/Sub. The Cloudflare Worker acknowledges that push and does the work on a queue.

### 1.2 Core Objective

Ship three phases:

1. **Phase 1 (connect and triage).** The user connects Gmail. New inbox mail after that moment gets one label and an audit row. Draft creation starts in Phase 2.
2. **Phase 2 (policy and drafts).** The user adds policy text. Mailer can leave a grounded draft for an inquiry or an action request. The user sends the draft from Gmail.
3. **Phase 3 (evaluation).** A golden set of threads guards category accuracy, Spam precision, policy compliance, latency, and token cost on each pull request.

### 1.3 Assumptions

- Version 1 supports Gmail only. One Google account maps to one mailbox.
- The product name is Mailer.
- Mail that arrives before the user connects stays unchanged.
- The owner uses the Gmail app to read, edit, and send.
- Phase 1 has no policy text. Draft creation stays off until Phase 2, and until the account has at least one policy.
- Google shows a consent screen for `gmail.modify`. That scope can send mail. The connect page says so. The Gmail client in this repo exposes no send method.

### 1.4 Out of scope

- An inbox, a compose box, or a second mail client.
- IMAP, Outlook, and any provider other than Gmail.
- A shared team mailbox.
- Permanent delete, mark-as-spam at Google, or send.
- Triage of the mailbox history from before connect.
- Marketing mail or bulk send.
- A draft that has no matching policy.

---

## 2. User-visible behavior

The user connects Gmail once. After that, Mailer works inside Gmail. The category comes from the email. The policy guides the draft.

- The user opens Mailer and chooses Connect Gmail.
- Google shows a consent screen. The user accepts.
- Mailer shows the connected Gmail address and an active watch.
- The user leaves Mailer and stays in Gmail.
- A new email arrives in the inbox after that connection.
- Gmail notifies Mailer.
- Mailer reads that new email.
- Mailer classifies it from the subject and the body.
- The category is Spam, High Priority, Action Required, or Inquiry.
- Mailer adds that category as a label on the Gmail thread.
- The user sees the label in Gmail on the web or on the phone.

After the user adds a policy, two more steps can happen:

- The user saves a policy in Mailer. The text states the rules for replies.
- For an Inquiry or an Action Required email, Mailer searches that policy.
- When the policy supports a reply, Mailer creates a draft in Gmail Drafts.
- The user opens the draft in Gmail, reviews it, and sends it.
- The user can open the activity list in Mailer and see the time, the subject, the category, and the action.

A few outcomes stay the same on every email:

- Mail from before the connection stays unchanged.
- Mail that the user sends, and drafts in Gmail, get no label.
- A High Priority email gets a label only.
- An unsure email gets the label Needs Review, and no draft.
- A thread has one Mailer category label. A newer message on the thread replaces the older label.
- Spam stays in the inbox until the user allows archive.
- Disconnect stops the watch and deletes the stored connection.

---

## 3. Screens and policies

The screens connect the account, hold the reply rules, and show what Mailer did. The user reads and sends the mail in Gmail.

The screens, besides Connect:

- **Before connect.** A short page says Mailer will label new mail and can leave a draft. It also warns that the Google permission screen includes send.
- **After connect.** The page shows the Gmail address, that the watch is active, and the time Mailer last labeled a message. Disconnect is on this page.
  - While the Google app is in testing mode, the page also shows the date when Google will end access. That date is 7 days after connect.
- **When connect fails.** The page says Google denied access or the connection failed, and it offers a retry.
- **When Google removes access.** The next visit asks the user to connect again.
- **Policies.** The user adds a title and a text rule. The user can delete a rule later.
- **Activity.** A list shows the time, the subject, the category, and the action. The action is labeled, needs review, drafted, or archived. This list has no reply box.
- **Settings.** The user can turn drafts off and keep the labels. The user can allow Mailer to archive Spam. Archive stays off until the user allows it.

A policy is a rule the user writes in their own words. Mailer reads it only when it writes a draft. For example: "Refund an order within 14 days. Do not refund the shipping fee."

The label comes from the email. The policy shapes the reply. With no policy saved, Mailer labels the email and leaves no draft.

---

## 4. Product Architecture & System Overview

```text
[ User ] --connect--> [ apps/web on apps/gateway · one origin ]
                              │
                              ▼
                    [ Google OAuth ]
                              │
                              ▼
                    [ D1 · encrypted refresh token ]
                              │
                              ▼
                    [ Gmail users.watch ]
                              │
[ Gmail inbox ] --> [ Google Cloud Pub/Sub ] --> [ apps/gateway webhook ]
                                                        │
                                                        ▼
                                               [ Cloudflare Queue ]
                                                        │
                                                        ▼
[ apps/pipeline ]
  ├── Mailbox Durable Object   one history sync at a time
  ├── Workflow                 fetch, classify, label, draft, audit
  └── Cron                     renew the watch, catch a missed push
           │
           ├── [ D1 ]          users, mailbox, audit
           ├── [ KV ]          access token cache
           ├── [ Vectorize ]   policy chunks (Phase 2)
           ├── [ R2 ]          policy files (Phase 2)
           └── [ Gmail API ]   labels and drafts
```

The user-facing origin is one Worker. It serves the web app and the API. `apps/pipeline` has no public page. A Queue message is the only path from the webhook to the pipeline.

---

## 5. Core Features & User Stories

Each story names the phase where it becomes true for a user.

### Epic 1: Connect the mailbox (Phase 1)

- **US-1.1:** As a visitor, I want a short page that states what Mailer will do with new mail, so that I can decide before Google consent.
  - Done when the page states the four actions: label, optional draft, activity list, and disconnect.
  - Done when the page states that Mailer does not send mail.
- **US-1.2:** As a visitor, I want the page to warn me that Google consent for this app includes permission to send, so that I know the scope is broader than the product behavior.
  - Done when that warning is visible before the Connect button.
- **US-1.3:** As a visitor, I want to connect a Gmail account with Google sign-in, so that Mailer can watch that inbox.
  - Done when a successful consent stores an encrypted refresh token and starts a mailbox watch.
  - Done when the next screen shows the Gmail address and an active watch.
- **US-1.4:** As a visitor, I want a clear failure when I deny consent or when the token exchange fails, so that I can retry.
  - Done when the error screen has a retry link and stores no token.
- **US-1.5:** As a connected user, I want a later visit to show the same mailbox, so that I do not connect twice.
  - Done when a valid session opens the connected screen.
- **US-1.6:** As a connected user, I want to disconnect, so that Mailer stops reading new mail and deletes its copy of my credentials and message snapshots.
  - Done when disconnect revokes the Google token, calls `users.stop`, deletes the token, and deletes stored message snapshots for that account.
- **US-1.7:** As a connected user, I want the next visit to ask me to connect again after Google revokes the grant, so that a dead token is visible.
  - Done when a failed refresh marks the mailbox disconnected and the page offers Connect.

### Epic 2: Hear about new mail (Phase 1)

- **US-2.1:** As a connected user, I want new inbox mail handled while I stay in Gmail, so that I do not open Mailer for each message.
  - Done when a message that arrives after connect gets a Mailer label without a visit to the site.
- **US-2.2:** As a connected user, I want mail from before I connected left as it is, so that an old inbox does not change under me.
  - Done when the stored history cursor is the cursor from the first `users.watch` response.
  - Done when no job reads messages older than that cursor.
- **US-2.3:** As a connected user, I want each Gmail message handled once, so that I do not get duplicate labels or duplicate drafts.
  - Done when a second delivery of the same Gmail message id starts no second Workflow and does not call Gmail modify again.
- **US-2.4:** As a connected user, I want a missed push recovered, so that a dropped notification does not skip a new message.
  - Done when the hourly catch-up reads Gmail history from the stored cursor and starts a Workflow only for an unseen message id.
- **US-2.5:** As a connected user, I want two near-simultaneous pushes for my mailbox applied in order, so that the history cursor never moves backward.
  - Done when one Durable Object per mailbox runs history sync one at a time.
  - Done when a cursor write keeps the larger history id.
- **US-2.6:** As a connected user, I want my own sent mail and my drafts left alone, so that Mailer does not label my replies.
  - Done when history sync skips a message that has the `SENT` or the `DRAFT` label.
- **US-2.7:** As a connected user, I want Mailer to continue after Gmail drops an old history cursor, so that one outage does not stop the labels forever.
  - Done when a `404` from `history.list` moves the cursor to the current mailbox history id and logs the gap.
  - Mail in that gap stays unlabeled.

### Epic 3: Label the thread (Phase 1)

- **US-3.1:** As a connected user, I want each new inbox message placed in one category, so that I can scan Gmail by intent.
  - The categories are Spam, High Priority, Action Required, and Inquiry.
  - Done when the audit row stores one of those four categories.
  - Done when the audit row stores the action `needs_review` when confidence is below the starting threshold.
- **US-3.2:** As a connected user, I want that category as a Gmail label on the thread, so that I see it in Gmail on the web and on my phone.
  - Label names are `Mailer/Spam`, `Mailer/High-Priority`, `Mailer/Action-Required`, `Mailer/Inquiry`, and `Mailer/Needs-Review`.
  - Done when a new label on a thread removes the other four of those five labels from that thread.
- **US-3.3:** As a connected user, I want an unsure message labeled Needs Review only, so that a weak classification does not file the thread as a firm category.
  - The starting confidence threshold is `0.7`. Phase 3 may change it from the eval results.
- **US-3.4:** As a connected user, I want a High Priority message labeled and left for me, so that the system does not draft a reply to urgent mail.
  - Done when High Priority never creates a draft, in every phase.
- **US-3.5:** As a connected user, I want Spam labeled and left in the inbox, so that Mailer does not hide mail unless I later allow archive.
  - Phase 1 keeps the archive flag off for every account.

### Epic 4: Leave a draft I can send (Phase 2)

- **US-4.1:** As a connected user, I want a draft reply in Gmail Drafts when an Inquiry or an Action Required message matches my policy, so that I can review a routine reply in Gmail.
  - Done when `users.drafts.create` writes a reply on that thread.
  - Done when the thread also gets the label `Mailer/Drafted`.
- **US-4.2:** As a connected user, I want to send that draft myself from Gmail, so that no client receives mail I have not read.
  - Done when the worker never calls `users.drafts.send` or `users.messages.send`.
- **US-4.3:** As a connected user, I want no draft when I have no policy, or when retrieval is weak, so that a generic reply is not waiting in Drafts.
  - Done when that message keeps its category label, gets no draft, and has the activity action `labeled`.
  - The category comes from the email, so a missing policy does not change it.
- **US-4.4:** As a connected user, I want the draft body to be the reply alone, so that policy notes are not mailed to the sender if I send too quickly.
  - Done when citations stay on the activity row and stay out of the draft body.
- **US-4.5:** As a connected user, I want to turn drafts off and keep labels, so that I can pause replies without a disconnect.
  - Done when the setting stops `users.drafts.create` and leaves labeling on.
- **US-4.6:** As a connected user, I want one draft per message, so that a retry does not stack replies in Drafts.
  - Done when the Workflow id is built from the account id and the Gmail message id, so a second run for that message does not start.
  - Done when a message that already has an activity row skips every Gmail write.

### Epic 5: Supply the policy (Phase 2)

- **US-5.1:** As a connected user, I want to add a title and a text policy, so that drafts follow my rules.
  - Done when the text is stored, chunked, and available to the next draft job.
- **US-5.2:** As a connected user, I want to delete a policy, so that later drafts stop using it.
  - Done when the row, the file, and the vectors for that policy are gone.
- **US-5.3:** As a connected user, I want my policies used only for my mailbox, so that another account cannot retrieve them.
  - Done when every vector query filters on the account id taken from the job, not from the message text.

### Epic 6: See what happened (Phase 2)

- **US-6.1:** As a connected user, I want an activity list with the time, the subject, the category, and the action, so that I can check the worker without reading raw mail in Mailer.
  - Actions are `labeled`, `needs_review`, `drafted`, and `archived`. Each action names what Mailer did in Gmail.
  - Done when the list shows no message body and no reply box.
- **US-6.2:** As a connected user, I want an empty state before the first message, so that a new account does not look broken.
- **US-6.3:** As a connected user, I want to allow or deny archive for Spam, so that hiding newsletters is my choice.
  - The default is deny.
  - Done when allow archives only threads whose category is Spam.
- **US-6.4:** As a connected user, I want disconnect to remove the activity subjects, so that a revoked account does not leave message metadata behind.
  - Done when disconnect deletes activity rows for that account.

### Epic 7: Guard the quality bar (Phase 3)

- **US-7.1:** As the maintainer, I want a versioned set of threads with a known category, so that a model change has a fixed test.
- **US-7.2:** As the maintainer, I want each pull request to report category accuracy and Spam precision, so that a regression is visible before merge.
  - The first measured run writes the baseline into the repo.
  - A later run fails when a score is more than 2 percentage points below that baseline. The margin absorbs model variance.
- **US-7.3:** As the maintainer, I want each pull request to score fixture drafts against a fixture policy, so that a draft that breaks the policy fails the check.
- **US-7.4:** As the maintainer, I want each handled message to store model id, input tokens, output tokens, and latency, so that cost and delay have a source.
- **US-7.5:** As a connected user, I want the same behavior after a deploy as the golden set describes, so that a release does not relabel my mail under a weaker model.

---

## 6. Technical Requirements & Stepwise Architecture

### 6.1 Stepwise implementation phases

```text
PHASE 1: Connect and label
├── apps/web — connect, connected, error, disconnect
├── apps/gateway — OAuth, session, webhook, status API, static assets
├── apps/pipeline — queue consumer, mailbox Durable Object, triage Workflow, cron
├── packages/db — D1 schema
├── packages/gmail — Gmail REST calls, with no send method
├── packages/tokens — AES-256-GCM encrypt and decrypt
├── packages/domain — queue payload and email triage schema
├── D1, KV, Cloudflare Queue, Workflows, Cron Triggers
└── One Google Cloud Pub/Sub topic and one push subscription

PHASE 2: Policy and drafts
├── Policy pages and the activity list on apps/web
├── Vectorize for policy chunks
├── R2 for the policy file
├── Draft step in the Workflow
└── Settings for drafts and for Spam archive

PHASE 3: Evaluation gate
├── apps/evals — CI only
├── Golden threads and fixture policies
└── A pull request check for accuracy, Spam precision, policy score, and cost fields
```

### 6.2 Behavior rules

The classifier returns this object. `packages/domain` defines it with Zod. The model must return JSON that parses against it.

- `category`: `spam`, `high_priority`, `action_required`, or `inquiry`
- `confidence`: a number from 0 to 1
- `requires_followup`: boolean
- `suggested_action`: `label_only`, `draft_reply`, or `needs_review`
- `action_items`: a list of short strings
- `due_on`: a date string, or null

The Workflow applies these rules after the model returns. A rule replaces the model action on a conflict. The first rule that matches decides the activity action.

1. When the output fails to parse twice, the action is `needs_review`. The category stays empty.
2. When `confidence` is below `0.7`, or the model returns `needs_review`, the action is `needs_review`.
3. When the category is `spam` and the user allows archive, the action is `archived`.
4. When the category is `spam` or `high_priority`, the action is `labeled`.
5. When the model returns `draft_reply`, drafts are on, and retrieval meets the threshold, the action is `drafted`. This rule starts in Phase 2.
6. Otherwise, the action is `labeled`.

Each action sets the Gmail result:

- `needs_review` — the label `Mailer/Needs-Review` only.
- `labeled` — the category label.
- `drafted` — the category label, `Mailer/Drafted`, and one draft.
- `archived` — the label `Mailer/Spam`, and the thread leaves the inbox.

The draft prompt receives the subject, the sender, the plain-text body, and the policy chunks for that account.

### 6.3 Data the system stores

- **Account.** Google subject, Gmail address, session id, and the encrypted refresh token.
- **Mailbox.** Watch expiration, Gmail history cursor, label ids, draft flag, and archive flag.
- **Activity.** Gmail message id, thread id, subject, category, confidence, action, model id, token counts, and latency. The category is empty when the model output did not parse.
- **Policy (Phase 2).** Title, file key, and vectors tagged with the account id.
- **Access token.** KV only, with a TTL shorter than the Google expiry. D1 stores the refresh token ciphertext.

The Workflow may hold the body in the step input while the job runs. The finished job leaves the body out of D1 and R2.

Disconnect deletes the account, the token, the mailbox row, the activity rows, the policies, and the vectors.

### 6.4 Evaluation targets

Phase 3 records five numbers for the golden set.

- **Category accuracy.** Share of threads whose category matches the golden label. Needs Review counts as a miss when the golden label is one of the four categories.
- **Spam precision.** Share of threads labeled Spam whose golden label is Spam. A false Spam label costs the most, because archive hides that mail.
- **Policy compliance.** Share of fixture drafts that a judge accepts as consistent with the fixture policy.
- **Latency.** The Workflow duration for one message, from start to the audit write.
- **Token cost.** Input tokens plus output tokens for that message.

The check compares accuracy, Spam precision, and policy compliance with the baseline file. It prints latency and tokens. Cost stays a printed number in the first version.

---

## 7. Non-Functional Requirements

These are targets. Measure them in Phase 3. Do not treat them as a current benchmark.

- **Webhook time.** The gateway verifies the push and enqueues it. Target Worker time is under 500 ms, before Gmail and model time.
- **Triage time.** One label workflow finishes within 30 seconds when Gmail and the model respond.
- **Draft time.** One draft workflow finishes within 60 seconds when Gmail, retrieval, and the model respond.
- **Order.** One mailbox never runs two history syncs at the same time.
- **Isolation.** A job carries the account id from D1. Mail text stays data for the prompt.
- **Secrets.** The refresh token in D1 is AES-256-GCM ciphertext. The key lives in a Worker secret. Logs omit tokens, authorization headers, and raw mail bodies.
- **Model logs.** AI Gateway keeps request and response logging off, because a prompt holds the mail body. The gateway still records the model id and the token counts.
- **Send guard.** `packages/gmail` has no send function. A unit test fails if a send path is added.
- **Launch limit.** `gmail.modify` is a restricted Google scope. Until Google verifies the app, sign-in works for test users on the consent screen only.
  - In testing mode, Google expires the refresh token 7 days after consent. Each test user connects again every week.
  - Verification of a restricted scope requires a third-party security assessment, because Mailer stores data from Gmail on its servers.
  - A Google Workspace account can use an internal OAuth app. An internal app avoids the 7-day expiry and the verification.

---

## 8. Directory Structure & Repository Layout

The repo is one pnpm workspace. Turborepo runs every app. The language is TypeScript. Node.js 22 is the minimum.

`apps/web` is the React client. `apps/gateway` serves that client and the public API on one origin. `apps/pipeline` is the private worker. CI runs `apps/evals`. The deploy set omits it.

Each Worker config file is `cloudflare.config.ts`. This repo is new, so the CLI is `cf`. Do not add a Wrangler config.

```text
mailer/
├── package.json                      # pnpm workspace root
├── pnpm-workspace.yaml               # apps/* and packages/*
├── turbo.json                        # build, dev, test, lint, typecheck
├── .github/
│   └── workflows/
│       └── ci.yml                    # turbo test, then evals in Phase 3
├── docs/
│   ├── prd.md
│   └── architecture.md
├── apps/
│   ├── web/                          # React connect UI
│   │   └── package.json
│   ├── gateway/                      # OAuth, webhook, status, static assets
│   │   ├── package.json
│   │   └── cloudflare.config.ts
│   ├── pipeline/                     # Queue, Durable Object, Workflow, cron
│   │   ├── package.json
│   │   └── cloudflare.config.ts
│   └── evals/                        # Golden set. Not a Worker.
│       └── package.json
├── packages/
│   ├── db/                           # Drizzle schema for D1
│   ├── domain/                       # Zod schemas and label names
│   ├── gmail/                        # REST client. No send method.
│   └── tokens/                       # AES-256-GCM
└── infra/
    └── migrations/                   # D1 SQL
```

---

## 9. Stepwise Implementation Milestones

### Phase 1: Connect and label

- [x] Add the pnpm workspace, Turborepo, and the four packages.
- [ ] Add the D1 schema and the first migration.
- [ ] Implement encrypt and decrypt for the refresh token. Bind the ciphertext to the account id.
- [ ] Implement the Gmail client for watch, stop, profile get, history, message get, label create, and thread modify.
- [ ] Serve the connect flow from `apps/gateway` with the built `apps/web` assets.
- [ ] On callback, store the token, create the five Phase 1 labels, call `users.watch`, and save the history cursor.
- [ ] Verify the Pub/Sub push JWT, enqueue `{ accountId }`, and return.
- [ ] Serialize history sync in the mailbox Durable Object. Skip sent mail and drafts. Recover from a `404` cursor.
- [ ] Run the triage Workflow under a fixed id per message. Classify, replace the category label, and write the audit row.
- [ ] Renew watches that expire within 36 hours. Run an hourly history catch-up.
- [ ] Implement disconnect and the revoked-grant screen.

### Phase 2: Policy and drafts

- [ ] Add policy create and delete. Store the file in R2 and the chunks in Vectorize.
- [ ] Add the draft step for Inquiry and Action Required when retrieval passes the score threshold.
- [ ] Add the activity list, the draft switch, and the Spam archive switch.
- [ ] Add the `Mailer/Drafted` label.

### Phase 3: Evaluation gate

- [ ] Add the golden threads and the fixture policies under `apps/evals`.
- [ ] Record accuracy, Spam precision, policy compliance, latency, and token counts.
- [ ] Fail the pull request when a score drops more than 2 percentage points below the baseline file.
