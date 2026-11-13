# Product Requirement Document (PRD)

## Project Name: Mailer

---

## 1. Executive Summary & Objective

### 1.1 Executive Summary

Mailer is an AI email client for one Gmail account. It has two parts.

- **The worker.** It waits for new mail, chooses one category, and writes that category onto the thread as a Gmail label. It applies the filters that the user wrote. When a stored policy supports a routine reply, it adds a draft in the Gmail Drafts folder. It keeps an encrypted copy of the text of each email that it classifies. From Phase 6, that copy covers all mail of the last 90 days, and search reads it.
- **The web app.** It connects the Google account. From Phase 4, it is the mail client. The user reads, organizes, writes, and sends mail there. It also holds the policies, the filters, the todos, and the activity list.

Gmail stays the source of the mail. Each action in Mailer shows in Gmail, and each action in Gmail shows in Mailer. The user can use both.

The worker runs on Cloudflare. Gmail push delivery still uses one Google Cloud Pub/Sub topic, because the Gmail API delivers mailbox watches only through Pub/Sub. The Cloudflare Worker acknowledges that push and does the work on a queue.

### 1.2 Core Objective

Ship seven phases:

1. **Phase 1 (connect and triage).** The user connects Gmail. Mailer labels the inbox mail of the last 30 days, and then each new inbox email. Each one gets one label and an audit row. Mailer keeps an encrypted copy of each email that it classifies. Draft creation starts in Phase 2.
2. **Phase 2 (policy and drafts).** The mail store follows each delete in Gmail. This is the first step of the phase. The user adds policy text. Mailer can leave a grounded draft for an inquiry or an action request. The user sends the draft.
3. **Phase 3 (evaluation).** A golden set of threads guards category accuracy, Spam precision, policy compliance, latency, and token cost on each pull request.
4. **Phase 4 (email client).** The user reads, organizes, writes, and sends mail in Mailer. The inbox has tabs.
5. **Phase 5 (AI in the inbox).** The user writes filters in plain English, turns emails into todos, organizes the inbox with one click, and writes with AI.
6. **Phase 6 (mail store and AI search).** The mail store grows to all mail of the last 90 days. The user finds mail from a description, and asks questions about the mail.
7. **Phase 7 (autocomplete).** Mailer suggests the end of a sentence while the user types.

[features.md](features.md) lists each feature and its source.

### 1.3 Assumptions

- Version 1 supports Gmail only. One Google account maps to one mailbox.
- The product name is Mailer.
- After the connection, Mailer labels the inbox mail of the last 30 days. Older mail gets no label. Mail from before the connection gets no automatic draft.
- From Phase 1, the mail store holds an encrypted copy of each email that Mailer classifies. From Phase 6, Mailer copies all mail of the last 90 days into the mail store.
- Until Phase 4, the owner uses the Gmail app to read, edit, and send. From Phase 4, the owner can also use Mailer.
- Phase 1 has no policy text. Draft creation stays off until Phase 2, and until the account has at least one policy.
- Google shows a consent screen for `gmail.modify`. That scope can send mail. The connect page says so.
  - Until Phase 4, the Gmail client in this repo exposes no send method.
  - From Phase 4, Mailer sends only when the user presses Send.

### 1.4 Out of scope

- IMAP, Outlook, and any provider other than Gmail.
- A shared team mailbox, and each team feature.
- Permanent delete of a message or a thread. Delete moves a thread to Trash.
- Mark-as-spam at Google.
- A send that the user did not start. No job sends mail.
- Automatic triage of mail older than 30 days at the connection, and of archived mail. The user can start Organize on the current inbox. (Epic 13)
- Marketing mail or bulk send.
- An automatic draft that has no matching policy.
- Calendar scheduling, snooze, bundles, delivery schedules, read tracking, and native apps. [features.md](features.md), section 8, lists them for later.

---

## 2. User-visible behavior

The user connects Gmail once. The category comes from the email. The policy guides the automatic draft.

**Phases 1 to 3: Mailer works inside Gmail.**

- The user opens Mailer and chooses Connect Gmail.
- Google shows a consent screen. The user accepts.
- Mailer shows the connected Gmail address and an active watch.
- Mailer labels the inbox mail of the last 7 days. Then it labels the inbox mail of days 8 to 30.
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
- The user opens the draft, reviews it, and sends it.
- The user can open the activity list in Mailer and see the time, the subject, the category, and the action.

**From Phase 4: Mailer is also the mail client.**

- The user opens Mailer and sees the inbox, with one tab for each category.
- The user opens a thread, reads it, and replies. The reply shows in Gmail Sent.
- The user archives a thread, moves it to Trash, stars it, or changes its labels. Gmail shows the same state.
- From Phase 5, the user writes a filter in plain English. New mail that matches gets the action of the filter.
- From Phase 5, the user turns emails into todos, and presses Organize to sort the inbox.
- From Phase 5, the user asks the AI to write a reply, and edits it before Send.
- From Phase 6, the user describes an email and Mailer finds it. The user asks a question and gets an answer with links to the threads.
- From Phase 7, a grey suggestion completes the sentence while the user types.

A few outcomes stay the same on every email:

- Inbox mail of the 30 days before the connection gets a label only. Older mail gets no label. Neither gets an automatic draft.
- Mail that the user sends, and drafts in Gmail, get no label.
- A High Priority email gets a label only. Mailer writes no automatic draft for it.
- An unsure email gets the label Needs Review, no automatic draft, and no filter action.
- A thread has one Mailer category label. A newer message on the thread replaces the older label.
- Spam stays in the inbox until the user allows archive.
- No email leaves the account unless the user presses Send.
- Mailer never deletes a message forever. Delete moves a thread to Trash.
- Disconnect stops the watch, and deletes the stored connection and the stored mail.

---

## 3. Screens and policies

Until Phase 4, the screens connect the account, hold the reply rules, and show what Mailer did. From Phase 4, the screens are also the mail client.

The screens, besides Connect:

- **Before connect.** A short page says what Mailer does with the mail. It also warns that the Google permission screen includes send.
- **After connect.** The page shows the Gmail address, that the watch is active, and the time Mailer last labeled a message. Disconnect is on this page.
  - While the Google app is in testing mode, the page also shows the date when Google will end access. That date is 7 days after connect.
- **When connect fails.** The page says Google denied access or the connection failed, and it offers a retry.
- **When Google removes access.** The next visit asks the user to connect again.
- **Policies (Phase 2).** The user adds a title and a text rule. The user can delete a rule later.
- **Activity (Phase 2).** A list shows the time, the subject, the category, and the action. The action is labeled, needs review, drafted, or archived. This list has no reply box.
- **Settings (Phase 2).** The user can turn automatic drafts off and keep the labels. The user can allow Mailer to archive Spam. Archive stays off until the user allows it.
- **Inbox (Phase 4).** A list of threads with tabs at the top. A side list opens Starred, Sent, Drafts, Trash, and each label. A search bar takes Gmail search syntax.
- **Thread (Phase 4).** The messages of one thread, with the attachments and the actions reply, archive, Trash, star, and label.
- **Compose (Phase 4).** A box for a new email, a reply, or a forward. Phase 5 adds the AI controls. Phase 7 adds the grey suggestion.
- **Splits (Phase 4).** The user creates, orders, and removes the tabs of the inbox.
- **Filters (Phase 5).** The user writes a name, a rule, and the actions. The user can test a filter and turn it off.
- **Todos (Phase 5).** A list at the top of the inbox. Each todo has a name, notes, and its threads.
- **Search (Phase 6).** The search bar gains two modes: find by description, and ask a question.

A policy is a rule the user writes in their own words. Mailer reads it when it writes a draft. For example: "Refund an order within 14 days. Do not refund the shipping fee."

The label comes from the email. The policy shapes the reply. With no policy saved, Mailer labels the email and leaves no automatic draft.

---

## 4. Product Architecture & System Overview

```text
[ User ] --connect, read, write--> [ apps/web on apps/gateway · one origin ]
                                          │
                 ┌────────────────────────┼─────────────────────────┐
                 ▼                        ▼                         ▼
        [ Google OAuth ]        [ Gmail API · live reads,   [ Mail store · Phase 1 ]
                 │                drafts, and the user's      search reads it · Phase 6
                 ▼                Send · Phase 4 ]
        [ D1 · encrypted refresh token ]
                 │
                 ▼
        [ Gmail users.watch ]
                 │
[ Gmail mailbox ] --> [ Google Cloud Pub/Sub ] --> [ apps/gateway webhook ]
                                                        │
                                                        ▼
                                               [ Cloudflare Queue ]
                                                        │
                                                        ▼
[ apps/pipeline ]
  ├── Mailbox Durable Object   one history sync at a time
  ├── Workflow                 fetch, classify, filter, label, draft, audit
  ├── Workflows                backfill, delete (Phase 1). Store, import (Phase 6)
  └── Cron                     renew the watch, catch a missed push, correct the store
           │
           ├── [ D1 ]          users, mailbox, audit, filters, splits, todos, message rows
           ├── [ KV ]          access token cache
           ├── [ Vectorize ]   policy chunks (Phase 2), mail chunks (Phase 6)
           ├── [ R2 ]          encrypted mail text (Phase 1), policy files (Phase 2)
           └── [ Gmail API ]   labels and drafts
```

The user-facing origin is one Worker. It serves the web app and the API. `apps/pipeline` has no public page. A Queue message is the only path from the webhook to the pipeline.

Only the gateway sends mail, and only for the Send button of the user. `apps/pipeline` never sends.

---

## 5. Core Features & User Stories

Each story names the phase where it becomes true for a user.

### Epic 1: Connect the mailbox (Phase 1)

- **US-1.1:** As a visitor, I want a short page that states what Mailer will do with new mail, so that I can decide before Google consent.
  - Done when the page states the four actions: label, optional draft, activity list, and disconnect.
  - Done when the page states that Mailer also labels the inbox mail of the last 30 days.
  - Until Phase 4, done when the page states that Mailer does not send mail.
  - From Phase 4, done when the page states that Mailer sends only when the user presses Send.
  - Done when the page states that Mailer stores an encrypted copy of the mail text, and deletes it on disconnect.
- **US-1.2:** As a visitor, I want the page to warn me that Google consent for this app includes permission to send, so that I know what the scope allows.
  - Done when that warning is visible before the Connect button.
- **US-1.3:** As a visitor, I want to connect a Gmail account with Google sign-in, so that Mailer can watch that inbox.
  - Done when a successful consent stores an encrypted refresh token and starts a mailbox watch.
  - Done when the next screen shows the Gmail address and an active watch.
- **US-1.4:** As a visitor, I want a clear failure when I deny consent or when the token exchange fails, so that I can retry.
  - Done when the error screen has a retry link and stores no token.
- **US-1.5:** As a connected user, I want a later visit to show the same mailbox, so that I do not connect twice.
  - Done when a valid session opens the connected screen.
- **US-1.6:** As a connected user, I want to disconnect, so that Mailer stops reading new mail and deletes its copy of my credentials and my mail.
  - Done when disconnect revokes the Google token, calls `users.stop`, deletes the token, and deletes stored message snapshots for that account.
  - From Phase 5, done when disconnect also deletes the filters, the splits, and the todos of that account.
  - Done when disconnect also deletes the mail store of that account: the data key, each D1 row, and each R2 body. From Phase 6, each vector too. (Epic 8)
- **US-1.7:** As a connected user, I want the next visit to ask me to connect again after Google revokes the grant, so that a dead token is visible.
  - Done when a failed refresh marks the mailbox disconnected and the page offers Connect.

### Epic 2: Hear about new mail (Phase 1)

- **US-2.1:** As a connected user, I want new inbox mail handled while I stay in Gmail, so that I do not open Mailer for each message.
  - Done when a message that arrives after connect gets a Mailer label without a visit to the site.
- **US-2.2:** As a connected user, I want mail older than 30 days left as it is, so that an old inbox does not change under me.
  - Done when the stored history cursor is the cursor from the first `users.watch` response.
  - Done when no job adds a label to a message that is older than 30 days at the connection.
  - Done when no job adds a draft to a message from before the connection.
  - The backfill of US-2.8 labels the inbox mail of the last 30 days.
  - The import of Epic 8 reads the last 90 days of mail. It writes nothing to Gmail.
  - Organize of Epic 13 changes older inbox mail only after the user confirms.
- **US-2.3:** As a connected user, I want each Gmail message handled once, so that I do not get duplicate labels or duplicate drafts.
  - Done when a second delivery of the same Gmail message id starts no second Workflow and does not call Gmail modify again.
- **US-2.4:** As a connected user, I want a missed push recovered, so that a dropped notification does not skip a new message.
  - Done when the hourly catch-up reads Gmail history from the stored cursor and starts a Workflow only for an unseen message id.
- **US-2.5:** As a connected user, I want two near-simultaneous pushes for my mailbox applied in order, so that the history cursor never moves backward.
  - Done when one Durable Object per mailbox runs history sync one at a time.
  - Done when a cursor write keeps the larger history id.
- **US-2.6:** As a connected user, I want my own sent mail and my drafts left alone, so that Mailer does not label my replies.
  - Done when history sync starts no triage for a message that has the `SENT` or the `DRAFT` label.
  - From Phase 6, sync copies a sent message to the mail store. The message still gets no label.
- **US-2.7:** As a connected user, I want Mailer to continue after Gmail drops an old history cursor, so that one outage does not stop the labels forever.
  - Done when a `404` from `history.list` moves the cursor to the current mailbox history id and logs the gap.
  - Mail in that gap stays unlabeled.
  - From Phase 2, the mail store catches up after the gap. (US-8.8)
- **US-2.8:** As a connected user, I want my recent inbox mail labeled right after I connect, so that I see the categories without a wait for new mail.
  - Done when each inbox thread that has a message from the last 7 days gets one category label. The label comes from the newest inbox message of the thread.
  - Done when the backfill then labels each inbox thread of days 8 to 30 with that same rule.
  - Done when the backfill skips sent mail, drafts, archived mail, Spam, and Trash.
  - Done when the backfill leaves a thread that already has a Mailer category label.
  - Done when the backfill adds a label only, in every phase. It creates no draft, it archives nothing, and it runs no filter.
  - Done when a new email gets its label while the backfill runs.
  - Done when a second connection of that account labels only the mail that has no activity row.
  - The 7 days and the 30 days are starting values in `packages/domain`.

### Epic 3: Label the thread (Phase 1)

- **US-3.1:** As a connected user, I want each new inbox message placed in one category, so that I can scan my mail by intent.
  - The categories are Spam, High Priority, Action Required, and Inquiry.
  - Done when the audit row stores one of those four categories.
  - Done when the audit row stores the action `needs_review` when confidence is below the starting threshold.
- **US-3.2:** As a connected user, I want that category as a Gmail label on the thread, so that I see it in Gmail on the web and on my phone.
  - Label names are `Mailer/Spam`, `Mailer/High-Priority`, `Mailer/Action-Required`, `Mailer/Inquiry`, and `Mailer/Needs-Review`.
  - Done when a new label on a thread removes the other four of those five labels from that thread.
  - From Phase 5, a filter label adds to the category label. It does not replace it. (Epic 11)
- **US-3.3:** As a connected user, I want an unsure message labeled Needs Review only, so that a weak classification does not file the thread as a firm category.
  - The starting confidence threshold is `0.7`. Phase 3 may change it from the eval results.
- **US-3.4:** As a connected user, I want a High Priority message labeled and left for me, so that the system does not draft a reply to urgent mail.
  - Done when High Priority never creates an automatic draft, in every phase.
- **US-3.5:** As a connected user, I want Spam labeled and left in the inbox, so that Mailer does not hide mail unless I later allow archive.
  - Phase 1 keeps the archive flag off for every account.

### Epic 4: Leave a draft I can send (Phase 2)

- **US-4.1:** As a connected user, I want a draft reply in Gmail Drafts when an Inquiry or an Action Required message matches my policy, so that I can review a routine reply.
  - Done when `users.drafts.create` writes a reply on that thread.
  - Done when the thread also gets the label `Mailer/Drafted`.
- **US-4.2:** As a connected user, I want to send that draft myself, so that no client receives mail I have not read.
  - Done when no job calls `users.drafts.send` or `users.messages.send`.
  - Until Phase 4, the user sends the draft from Gmail.
  - From Phase 4, the user can also press Send in Mailer. (US-9.3)
- **US-4.3:** As a connected user, I want no automatic draft when I have no policy, or when retrieval is weak, so that a generic reply is not waiting in Drafts.
  - Done when that message keeps its category label, gets no draft, and has the activity action `labeled`.
  - The category comes from the email, so a missing policy does not change it.
- **US-4.4:** As a connected user, I want the draft body to be the reply alone, so that policy notes are not mailed to the sender if I send too quickly.
  - Done when citations stay on the activity row and stay out of the draft body.
- **US-4.5:** As a connected user, I want to turn automatic drafts off and keep labels, so that I can pause replies without a disconnect.
  - Done when the setting stops `users.drafts.create` in the Workflow and leaves labeling on.
- **US-4.6:** As a connected user, I want one automatic draft per message, so that a retry does not stack replies in Drafts.
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

- **US-6.1:** As a connected user, I want an activity list with the time, the subject, the category, and the action, so that I can check the worker without a search through my mail.
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

### Epic 8: Store the mail (Phases 1, 2, and 6)

The mail store is an encrypted copy of the mail text on Cloudflare. [architecture.md](architecture.md), Tier 5, describes the parts.

- **Phase 1 starts the store.** Mailer stores each email that it classifies (US-8.9). The copy holds text only (US-8.6), and it is encrypted (US-8.7). Disconnect deletes it (US-1.6). No Phase 1 feature reads the copy.
- **Phase 2 makes the store follow Gmail.** This is the first step of Phase 2. A stored message that the user deletes leaves the store (US-8.3). A restored message returns (US-8.4). A daily run corrects each difference (US-8.8).
- **Phase 6 completes the store.** The store covers all mail of the last 90 days (US-8.1, US-8.2). AI search and autocomplete read it (US-8.5).

From Phase 2, the store holds a message only while Gmail holds it outside Trash and Spam. In Phase 1, the copy of an email that the user deletes in Gmail stays until disconnect.

- **US-8.1:** As a connected user, I want Mailer to import the last 90 days of my mail, so that AI search and autocomplete can use mail from before the connection.
  - Done when the import copies the inbox, the archived mail, and the sent mail of the last 90 days.
  - Done when the import skips Spam, Trash, and drafts.
  - Done when the import adds no label and writes nothing to Gmail.
  - Done when a second run of the import adds no duplicate.
  - An account that connected before Phase 6 gets the import one time after the release.
- **US-8.2:** As a connected user, I want each new email and each email I send added to the mail store, so that search covers mail from today.
  - Done when a new message and a new sent message each have a row in D1, a body in R2, and vectors in Vectorize.
  - Done when a draft has none of the three.
- **US-8.3:** As a connected user, I want mail that I delete removed from the mail store, so that Mailer does not keep or show mail I removed. (Phase 2)
  - Done when a message that the user deletes forever, moves to Trash, or marks as spam has no row and no body. From Phase 6, it also has no vector.
  - Done when the result is the same for a delete in Gmail and a delete in Mailer.
- **US-8.4:** As a connected user, I want mail that I restore from Trash or from Spam added to the mail store again, so that the copy matches my mailbox. (Phase 2)
  - Done when a restored message that Mailer classified has a row and a body again.
  - From Phase 6, done when each restored message has a row, a body, and vectors again.
- **US-8.5:** As a connected user, I want my stored mail used only for my mailbox, so that another account cannot read it.
  - Done when each vector sits in the namespace of its account id.
  - Done when each query takes the account id from the session or the job, not from the message text.
- **US-8.6:** As a connected user, I want Mailer to store the text of my mail only, so that my attachments stay in Gmail.
  - Done when the mail store holds no attachment.
- **US-8.7:** As a connected user, I want my stored mail encrypted with a key for my account only, so that a copy of the storage does not expose my mail.
  - Done when each body in R2 is AES-256-GCM ciphertext under the data key of that account.
  - Done when D1 holds that data key only in wrapped form, under the Worker secret `MAIL_ENCRYPTION_KEY`.
  - Done when disconnect deletes the data key first. The stored bodies are then unreadable, before the delete job ends.
- **US-8.8:** As a connected user, I want the mail store correct again after Gmail drops an old history cursor, so that one outage does not leave deleted mail in the store. (Phase 2)
  - Done when the correction runs after the cursor reset.
  - Done when that run removes each stored message that Gmail no longer lists.
  - Done when the same run occurs one time each day, because a push can fail.
  - From Phase 6, done when that run also adds each message of the last 90 days that the store lacks.
- **US-8.9:** As a connected user, I want Mailer to keep a copy of each email that it classifies, so that later features can use my mail without a second read from Gmail. (Phase 1)
  - Done when each classified message has a row in D1 and an encrypted body in R2.
  - Done when a new email and an email of the backfill use the same store step.
  - Done when an email that Mailer does not classify has no row and no body. This covers sent mail, drafts, archived mail, and mail older than 30 days at the connection.
  - Done when a second run for one message adds no duplicate.
  - In Phase 1, the copy does not follow a delete in Gmail. Disconnect is the one delete path. Phase 2 starts with the sync that removes this limit. (US-8.3)

### Epic 9: Use the email client (Phase 4)

- **US-9.1:** As a connected user, I want my inbox as a list of threads, so that I can scan my mail in Mailer.
  - Done when each line shows the sender, the subject, the time, the labels, and the unread state.
  - Done when the list shows the same threads as the Gmail inbox.
  - Done when the list reads from Gmail at the time of the view.
- **US-9.2:** As a connected user, I want to open a thread and read each message, so that I do not open Gmail to read.
  - Done when the thread shows each message in order, with its attachments.
  - Done when the user can download an attachment.
  - Done when an HTML message shows in a sandboxed frame with scripts off.
  - Done when remote images stay off until the user allows them for that message.
- **US-9.3:** As a connected user, I want to write a new email, reply, reply to all, forward, and attach a file, so that I can answer my mail in Mailer.
  - Done when Send calls `users.drafts.send` one time for that draft.
  - Done when the sent message shows in Gmail Sent, on the same thread for a reply.
  - Done when no email leaves before the user presses Send.
- **US-9.4:** As a connected user, I want my draft saved while I type, so that I can continue it later in Mailer or in Gmail.
  - Done when the draft shows in Gmail Drafts.
  - Done when the user can open the draft again, edit it, and discard it.
- **US-9.5:** As a connected user, I want to archive, move to Trash, restore, star, mark read or unread, and change the labels of a thread, so that I can triage my inbox.
  - Done when each action shows in Gmail.
  - Done when Delete calls `users.threads.trash`. Mailer has no permanent delete.
  - Done when the Trash view offers Restore, and Restore calls `users.threads.untrash`.
- **US-9.6:** As a connected user, I want a side list with Inbox, Starred, Sent, Drafts, Trash, and my labels, so that I can open each part of my mailbox.
- **US-9.7:** As a connected user, I want to search with Gmail syntax, so that the searches I know still work.
  - Done when Gmail runs the search, and Mailer shows the result as a list of threads.

### Epic 10: Split the inbox (Phase 4)

- **US-10.1:** As a connected user, I want tabs at the top of my inbox, so that I can handle one kind of mail at a time.
  - Done when a new account has one tab for each Mailer category, and a tab named Other.
- **US-10.2:** As a connected user, I want to create a tab from importance, a sender, a label, or a Gmail query, so that the tabs match my work.
  - Done when the user can create, rename, order, and remove a tab.
- **US-10.3:** As a connected user, I want each inbox thread in a tab, so that no mail hides.
  - Done when Other shows each inbox thread that matches no tab.
- **US-10.4:** As a connected user, I want a tab to store its rule only, so that Mailer keeps no mail for this feature.

### Epic 11: Filter mail with AI (Phase 5)

- **US-11.1:** As a connected user, I want to write a filter in plain English, so that Mailer handles a kind of mail the way I say.
  - A filter has a name, a rule, and one or more actions.
  - The actions are label, star, mark important, mark read, and archive.
- **US-11.2:** As a connected user, I want each filter applied to new mail, so that I do not sort that mail by hand.
  - Done when a new email that matches the rule gets each action of the filter.
  - Done when the label of the filter is `Mailer/<name>`, and the category label stays on the thread.
  - Done when the activity row names each filter that matched.
- **US-11.3:** As a connected user, I want to test a filter on threads that I select, so that I can correct the rule before it runs.
  - Done when the test shows the action and one sentence of reason for each thread.
  - Done when the test writes nothing to Gmail.
- **US-11.4:** As a connected user, I want to turn a filter off or remove it, so that later mail gets no action from it.
- **US-11.5:** As a connected user, I want a filter to stay inside safe actions, so that a bad rule cannot lose or send mail.
  - Done when no filter sends, deletes, or moves mail to Trash.
  - Done when a Needs Review email gets no filter action.
  - Done when an account holds 10 filters at most. Each filter adds prompt tokens to each email.

### Epic 12: Turn emails into todos (Phase 5)

- **US-12.1:** As a connected user, I want to turn one thread, or a group of threads, into a todo with one click, so that I track the work and not the mail.
- **US-12.2:** As a connected user, I want a suggested name for the todo, so that I do not write one each time.
  - Done when the AI suggests a name from the threads, and the user can change it.
- **US-12.3:** As a connected user, I want to add notes, change the order, and mark a todo done, so that I know the next task.
  - Done when the name, the notes, and the order stay after a reload.
- **US-12.4:** As a connected user, I want my todos at the top of the inbox, so that they stay in view.
  - Done when a todo opens the threads that it holds.

### Epic 13: Organize the inbox (Phase 5)

- **US-13.1:** As a connected user, I want to press Organize and see a proposal, so that I can clear a full inbox fast.
  - Done when the proposal covers the 50 newest inbox threads at most.
  - Done when the proposal has three groups: important emails, todos, and the rest.
- **US-13.2:** As a connected user, I want to confirm each group, so that nothing changes without my decision.
  - Done when a confirmed group gets its action: a star for the important emails, a todo for each todo, and archive for the rest.
  - Done when no thread changes before the user confirms its group.
- **US-13.3:** As a connected user, I want an unsure thread left in the inbox, so that a weak guess does not hide mail.
  - Done when a thread below the confidence threshold is in no group.
- **US-13.4:** As a connected user, I want Organize to archive and never delete, so that I can find the mail again.

### Epic 14: Write with AI (Phase 5)

- **US-14.1:** As a connected user, I want to describe an email in one sentence and get a draft, so that I start from text and not from an empty box.
- **US-14.2:** As a connected user, I want a Reply with AI button on a thread, so that I get a reply draft in one click.
  - Done when the draft uses the thread, and the policy text when a policy matches.
  - Done when the button works with no policy saved.
- **US-14.3:** As a connected user, I want to improve my draft, so that I send clear text.
  - The choices are fix the grammar, make it shorter, change the tone, and complete a partial draft.
- **US-14.4:** As a connected user, I want AI text to stay in the compose box until I send it, so that I can read and change it first.
  - Done when no AI path calls a send method.
- **US-14.5:** As a connected user, I want AI drafts to sound like me, so that I change less text. (Phase 6)
  - Done when the draft prompt receives sent emails of the user from the mail store as style examples.

### Epic 15: Search with AI (Phase 6)

- **US-15.1:** As a connected user, I want to find an email from a description, so that I do not need the exact words.
  - Done when a description with no keyword from the email finds that email.
  - Done when the result is a list of threads.
- **US-15.2:** As a connected user, I want to ask a question about my mail, so that I get the answer and not a list to read.
  - Done when the answer links to each thread that it came from.
- **US-15.3:** As a connected user, I want Mailer to say when it finds nothing, so that I do not get an invented answer.
  - Done when an answer with no source thread states that Mailer found nothing.
- **US-15.4:** As a connected user, I want to know what the search covers, so that I trust an empty result.
  - Done when the search screen states that the import still runs, until the import ends.
- **US-15.5:** As a connected user, I want mail that I deleted to stay out of each result, so that search matches my mailbox. (US-8.3)

### Epic 16: Complete my sentences (Phase 7)

- **US-16.1:** As a connected user, I want a grey suggestion that completes my sentence, so that I write faster.
  - Done when Tab accepts the suggestion.
  - Done when the suggestion goes away when the user continues to type.
- **US-16.2:** As a connected user, I want the suggestion to use the thread and my related mail, so that it holds real facts and my own phrases.
  - Done when Mailer queries the mail index one time when the draft opens.
- **US-16.3:** As a connected user, I want the suggestion fast, so that it does not interrupt me.
  - Done when Mailer asks the model only after a pause of 300 ms.
  - Done when a suggestion shows within 1 second after the pause.
  - Done when Mailer drops an answer that arrives after the user typed again.
- **US-16.4:** As a connected user, I want a suggestion to stay out of my email until I accept it, so that I send only text that I chose.

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

PHASE 4: Email client
├── apps/web — inbox, thread, compose, side list, search bar, splits
├── apps/gateway — thread, draft, label, attachment, and split APIs
├── packages/gmail — thread list and get, Trash and restore, draft methods, drafts.send
└── D1 — splits

PHASE 5: AI in the inbox
├── apps/web — filters, todos, Organize, AI controls in the compose box
├── apps/gateway — filter, todo, organize, and writing APIs
├── apps/pipeline — filter step in the Workflow
└── D1 — filters, todos

PHASE 6: Mail store and AI search
├── apps/pipeline — full mailbox sync, store Workflow, import Workflow, delete Workflow
├── apps/gateway — search and answer APIs
├── D1 — message rows and wrapped data keys
├── R2 — encrypted body text
├── Vectorize — mail index, one namespace per account
└── Worker secret MAIL_ENCRYPTION_KEY

PHASE 7: Autocomplete
├── apps/web — grey suggestion in the compose box
└── apps/gateway — suggestion API with a small model
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

A backfill run skips rule 3 and rule 5. Its action is `needs_review` or `labeled`, in every phase. (US-2.8)

Each action sets the Gmail result:

- `needs_review` — the label `Mailer/Needs-Review` only.
- `labeled` — the category label.
- `drafted` — the category label, `Mailer/Drafted`, and one draft.
- `archived` — the label `Mailer/Spam`, and the thread leaves the inbox.

The draft prompt receives the subject, the sender, the plain-text body, and the policy chunks for that account.

**Filters (Phase 5).** The classifier call also receives the filters of the account, and returns the filters that match.

- A filter runs only when the action is not `needs_review`.
- Each matched filter adds its actions to the Gmail result of the same `users.threads.modify` call.
- A filter with the archive action removes `INBOX`. The activity action is then `archived`.
- A filter never sends, never deletes, and never moves mail to Trash.

**The AI proposes. The user confirms.** This rule covers each AI feature of Phases 5 to 7.

- Mailer sends an email only when the user presses Send.
- Mailer does a bulk action only after the user confirms it.
- Two paths run with no confirmation: a filter that the user wrote, and a policy draft. Neither path sends, and neither path deletes.

### 6.3 Data the system stores

- **Account.** Google subject, Gmail address, session id, and the encrypted refresh token.
- **Mailbox.** Watch expiration, Gmail history cursor, label ids, draft flag, and archive flag.
- **Activity.** Gmail message id, thread id, subject, category, confidence, action, model id, token counts, and latency. The category is empty when the model output did not parse.
- **Policy (Phase 2).** Title, file key, and vectors tagged with the account id.
- **Access token.** KV only, with a TTL shorter than the Google expiry. D1 stores the refresh token in `encrypted_refresh_token`.
- **Split (Phase 4).** Name, rule, and order.
- **Filter (Phase 5).** Name, rule, actions, and the on or off state.
- **Todo (Phase 5).** Name, notes, order, done time, and the Gmail thread ids.
- **Mail store (Phase 1).** For each message that Mailer classifies. From Phase 6, for each message of the last 90 days and each later message:
  - D1 holds the Gmail ids, the sender, the recipients, the subject, and the date.
  - R2 holds the body text, encrypted with the data key of the account.
  - From Phase 6, Vectorize holds the vectors of the body chunks. The vector metadata holds ids and the date, and no text.
  - No store holds an attachment.
- **Data key (Phase 1).** One key per account, wrapped under `MAIL_ENCRYPTION_KEY`, in D1.

The Workflow may hold the cut body in its step state while the job runs. The stored body text lives in the mail store only, as ciphertext in R2. The activity row omits it.

The email client of Phase 4 adds no stored mail. Each screen reads from Gmail at the time of the view.

From Phase 2, a message that the user deletes, moves to Trash, or marks as spam leaves the mail store. A message that the user restores returns to it.

Disconnect deletes the account, the token, the mailbox row, the activity rows, the policies, the policy vectors, the splits, the filters, the todos, and the mail store. Mailer keeps no copy of the mail after disconnect.

### 6.4 Evaluation targets

Phase 3 records five numbers for the golden set.

- **Category accuracy.** Share of threads whose category matches the golden label. Needs Review counts as a miss when the golden label is one of the four categories.
- **Spam precision.** Share of threads labeled Spam whose golden label is Spam. A false Spam label costs the most, because archive hides that mail.
- **Policy compliance.** Share of fixture drafts that a judge accepts as consistent with the fixture policy.
- **Latency.** The Workflow duration for one message, from start to the audit write.
- **Token cost.** Input tokens plus output tokens for that message.

The check compares accuracy, Spam precision, and policy compliance with the baseline file. It prints latency and tokens. Cost stays a printed number in the first version.

Phase 5 adds fixture filters to the golden set. The check then also compares the share of threads with the correct filter match.

---

## 7. Non-Functional Requirements

These are targets. Measure them on staging. Do not treat them as a current benchmark.

- **Webhook time.** The gateway verifies the push and enqueues it. Target Worker time is under 500 ms, before Gmail and model time.
- **Triage time.** One label workflow finishes within 30 seconds when Gmail and the model respond.
- **Draft time.** One draft workflow finishes within 60 seconds when Gmail, retrieval, and the model respond.
- **Inbox time (Phase 4).** The first 25 threads of the inbox show within 2 seconds when Gmail responds.
- **Autocomplete time (Phase 7).** Mailer waits for a pause of 300 ms. A suggestion shows within 1 second after the pause.
- **Order.** One mailbox never runs two history syncs at the same time.
- **Isolation.** A job carries the account id from D1. Mail text stays data for the prompt.
- **Secrets.** The refresh token in D1 is AES-256-GCM in `encrypted_refresh_token`. The key lives in a Worker secret. Logs omit tokens, authorization headers, and raw mail bodies.
- **Stored mail (Phase 1).** The mail store holds each email that Mailer classifies.
  - Disconnect deletes the data key, then each body and each row of the account. From Phase 6, it also deletes each vector. A delete job does the work, and it ends only when none remain.
  - Logs omit the body text.
  - From Phase 2, the mail store holds a message only while Gmail holds it outside Trash and Spam. A change in Gmail reaches the store through sync. A daily run corrects each difference that sync missed.
- **Mail encryption (Phase 1).** Mailer encrypts each body before the write to R2.
  - The cipher is AES-256-GCM from Web Crypto, with a new random nonce for each body. The associated data is the account id and the Gmail message id.
  - Each account has its own data key. D1 holds the data key wrapped under the Worker secret `MAIL_ENCRYPTION_KEY`.
  - `MAIL_ENCRYPTION_KEY` is a different secret from `TOKEN_ENCRYPTION_KEY`. One key has one purpose.
  - A change of `MAIL_ENCRYPTION_KEY` wraps each data key again. The bodies stay as they are.
  - The vectors and the D1 message rows have no encryption from Mailer. Cloudflare encrypts D1 and R2 at rest. A vector comes from the text, so treat it as mail data.
- **Model calls.** Mail text leaves Cloudflare only inside a model prompt. Embeddings run on Workers AI.
- **Model logs.** AI Gateway keeps request and response logging off, because a prompt holds the mail body. The gateway still records the model id and the token counts.
- **Send rule.** Until Phase 4, `packages/gmail` has no send function, and a unit test fails if a send path is added.
  - From Phase 4, `users.drafts.send` is the one send method. Only the gateway use case for the Send button calls it.
  - A unit test fails when `apps/pipeline` imports a send function.
  - `users.messages.delete` and `users.threads.delete` stay out of `packages/gmail` in every phase.
- **Mail view (Phase 4).** An HTML message shows in a sandboxed frame with scripts off. Remote images stay off until the user allows them.
- **Launch limit.** `gmail.modify` is a restricted Google scope. Until Google verifies the app, sign-in works for test users on the consent screen only.
  - In testing mode, Google expires the refresh token 7 days after consent. Each test user connects again every week.
  - Verification of a restricted scope requires a third-party security assessment, because Mailer stores data from Gmail on its servers. From Phase 1, that data includes the mail text.
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
│       └── deploy-staging.yml        # develop → staging, then evals in Phase 3
├── docs/
│   ├── prd.md
│   ├── architecture.md
│   ├── delivery.md                   # release scope of each phase
│   ├── features.md                   # feature list and its sources
│   └── phase-1-plan.md               # Phase 1 setup, schema, routes, checkpoints
├── apps/
│   ├── web/                          # React client
│   │   └── package.json
│   ├── gateway/                      # OAuth, webhook, mail API, static assets
│   │   ├── package.json
│   │   └── cloudflare.config.ts
│   ├── pipeline/                     # Queue, Durable Object, Workflows, cron
│   │   ├── package.json
│   │   └── cloudflare.config.ts
│   └── evals/                        # Golden set. Not a Worker.
│       └── package.json
├── packages/
│   ├── db/                           # Drizzle schema for D1
│   ├── domain/                       # Zod schemas and label names
│   ├── gmail/                        # REST client
│   └── tokens/                       # AES-256-GCM
└── infra/
    └── migrations/                   # D1 SQL
```

---

## 9. Stepwise Implementation Milestones

Each phase is one release. [delivery.md](delivery.md) lists the user scenarios, the build order, and the release check for each phase.

### Phase 1: Connect and label

- [x] Add the pnpm workspace, Turborepo, and the four packages.
- [ ] Add the D1 schema and the first migration.
- [ ] Implement encrypt and decrypt for the refresh token. Bind `encrypted_refresh_token` to the account id.
- [ ] Implement the Gmail client for watch, stop, profile get, history, message get, message list, label create, and thread modify.
- [ ] Serve the connect flow from `apps/gateway` with the built `apps/web` assets.
- [ ] On callback, store the token, create the five Phase 1 labels, call `users.watch`, and save the history cursor.
- [ ] Verify the Pub/Sub push JWT, enqueue `{ accountId }`, and return.
- [ ] Serialize history sync in the mailbox Durable Object. Skip sent mail and drafts. Recover from a `404` cursor.
- [ ] Run the triage Workflow under a fixed id per message. Classify, replace the category label, and write the audit row.
- [ ] Renew watches that expire within 36 hours. Run an hourly history catch-up.
- [ ] Implement disconnect and the revoked-grant screen.
- [ ] Add the message rows, the data key table, and the R2 bucket. Add envelope encryption with `MAIL_ENCRYPTION_KEY` and one data key per account.
- [ ] Store an encrypted copy of each email that the triage Workflow classifies.
- [ ] Add the delete Workflow, and call it from disconnect.
- [ ] Add the backfill Workflow. After connect, label the inbox threads of the last 7 days, then the inbox threads of days 8 to 30.

### Phase 2: Policy and drafts

- [ ] Watch the full mailbox. Read the four history types. Add the store Workflow, which removes a deleted message and returns a restored message.
- [ ] Add the correction. Run it after a `404` cursor, and one time each day.
- [ ] Add policy create and delete. Store the file in R2 and the chunks in Vectorize.
- [ ] Add the draft step for Inquiry and Action Required when retrieval passes the score threshold.
- [ ] Add the activity list, the draft switch, and the Spam archive switch.
- [ ] Add the `Mailer/Drafted` label.

### Phase 3: Evaluation gate

- [ ] Add the golden threads and the fixture policies under `apps/evals`.
- [ ] Record accuracy, Spam precision, policy compliance, latency, and token counts.
- [ ] Fail the pull request when a score drops more than 2 percentage points below the baseline file.

### Phase 4: Email client

- [ ] Add the Gmail client methods for thread list, thread get, Trash, restore, attachment get, and the draft methods.
- [ ] Show the inbox, the side list, and the thread view. Show HTML mail in a sandboxed frame.
- [ ] Add archive, Trash, restore, star, read state, and label changes.
- [ ] Add the compose box with a saved Gmail draft. Add `users.drafts.send` behind the Send button.
- [ ] Replace the send guard test with the test that keeps send out of `apps/pipeline`.
- [ ] Add the Gmail-syntax search bar.
- [ ] Add the splits table, the default tabs, and the splits screen.
- [ ] Change the connect page text about send.

### Phase 5: AI in the inbox

- [ ] Add the filters table, the filters screen, and the filter test.
- [ ] Add the filter match to the triage schema and the filter step to the Workflow.
- [ ] Add fixture filters to the golden set.
- [ ] Add the todos tables and the todo list in the inbox.
- [ ] Add Organize: the proposal, the three groups, and the confirm step.
- [ ] Add the AI controls in the compose box: write from a sentence, Reply with AI, and Improve.

### Phase 6: Mail store and AI search

- [ ] Add the mail index, and the chunk count on the message rows. Set `MAIL_ENCRYPTION_KEY` on the gateway.
- [ ] Add each new email and each sent email to the store Workflow. Add the vectors to its add action and its remove action.
- [ ] Add the import step for the last 90 days. Run it after connect, and with each correction run.
- [ ] Add the vectors to the delete Workflow.
- [ ] Add find by description and ask a question in the search bar.
- [ ] Add sent emails as style examples to the AI draft prompt.

### Phase 7: Autocomplete

- [ ] Add the suggestion API with a small model. Choose the model from a time measurement on staging.
- [ ] Query the mail index one time when a draft opens.
- [ ] Show the grey suggestion after a pause of 300 ms. Accept it with Tab. Drop a late answer.
