# Delivery phases

Mailer ships in the seven phases of [prd.md](prd.md). Each phase is one release. A phase ships only when every release check in that phase passes.

Phases 1 to 3 deliver the headless worker. Phases 4 to 7 deliver the email client and its AI features.

- [prd.md](prd.md) owns the behavior and the user stories. This file names the stories that each phase covers.
- [architecture.md](architecture.md) owns the components, the tables, and the bindings.
- CI deploys and applies the D1 migrations when the user merges. An agent does not merge, deploy, or run a migration.

Every test runs on Cloudflare. Nothing runs against local infrastructure.

- A push to `develop` deploys to staging. Staging is the only environment. Refer to [architecture.md](architecture.md), section 6.
- Inside a phase, the build order is a list of checkpoints. Merge each checkpoint to `develop`, then test it on staging with a test Gmail account.
- A checkpoint is not a release. A phase releases when its release check passes on staging.

---

## Phase 1: Connect and label

**User outcome.** The user connects Gmail once. Mailer then labels the inbox mail of the last 30 days, and it starts with the last 7 days. After that, each new inbox message gets one Mailer category label in Gmail. Mailer keeps an encrypted copy of each email that it classifies. The user can disconnect at any time, and disconnect deletes that copy.

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
  - After the connection, each inbox thread of the last 7 days gets a label. Then each inbox thread of days 8 to 30 gets a label. (US-2.8)
  - A new message gets its label while that backfill runs. (US-2.8)
  - Mail older than 30 days stays unchanged. (US-2.2)
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
- **Keep a copy**
  - Each email that Mailer classifies has a row in D1 and an encrypted body in R2. (US-8.9)
  - The copy holds text only. Attachments stay in Gmail. (US-8.6)
  - Each body is encrypted with the data key of its account. (US-8.7)
  - In Phase 1, the copy does not follow a delete in Gmail. Phase 2 starts with that sync. (US-8.9)
- **Leave**
  - A connected user disconnects. Mailer stops the watch and deletes the token, the mailbox, and the activity rows. (US-1.6, US-6.4)
  - Disconnect deletes the data key first, then each stored body and each message row. (US-1.6, US-8.7)
  - After Google ends access, the next visit asks the user to connect again. (US-1.7)

### What ships

- `apps/web` — the before-connect, connected, and error screens
- `apps/gateway` — OAuth, the session, the status API, disconnect, and `POST /v1/gmail/push`
- `apps/pipeline` — the queue consumer, the mailbox Durable Object, the `MailTriage`, `MailBackfill`, and `MailDelete` Workflows, and the cron
- D1 migrations — `accounts`, `sessions`, `oauth_tokens`, `mailboxes`, and `activities`. A second file adds `mail_keys` and `messages`.
- Cloudflare — D1, KV, the queue, Workflows, Cron Triggers, an R2 bucket for the body text, and AI Gateway with logging off
- The privacy text of the connect page. It states that Mailer stores an encrypted copy of the mail text.
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
8. Add the data key and the cipher. Store an encrypted copy of each email that the Workflow classifies.
9. Add the delete Workflow, and call it from disconnect.
10. Add the backfill. After connect, label the inbox threads of the last 7 days, then the inbox threads of days 8 to 30.

The backfill comes last for three reasons. It uses the classifier of step 5. The sync path must be correct before the backfill adds load. The store and its delete must work before the backfill copies 30 days of mail.

### Release check

Run these steps on staging.

1. Connect a test account that holds inbox mail from the last 30 days and older inbox mail. The connected screen shows the Gmail address.
2. Each inbox thread of the last 30 days gets one Mailer label. A thread that has only older mail gets none.
3. Send one message of each category to that inbox. Each thread gets the expected label within 30 seconds.
4. Each labeled email has a row in D1 and an object in R2. Read one object in the Cloudflare dashboard. The object is not readable text.
5. Reply from Gmail. The reply gets no label, no row, and no object.
6. Disconnect. The watch stops. The account has no data key at once. After the delete job ends, the account has no row in D1 and no object in R2.

---

## Phase 2: Policy and drafts

**User outcome.** The user writes reply rules in Mailer. For an Inquiry or an Action Required message that a rule covers, a draft reply waits in Gmail Drafts. The user reviews it and sends it from Gmail. The user can see what Mailer did, and can turn drafts off or allow Spam archive.

Phase 2 starts with the sync for the mail store. After that step, an email that the user deletes in Gmail leaves the copy that Mailer keeps.

### User scenarios

- **Keep the copy equal to Gmail**
  - A stored message that the user deletes, moves to Trash, or marks as spam leaves the store. (US-8.3)
  - A stored message that the user restores from Trash or from Spam enters the store again. (US-8.4)
  - The store is correct again after Gmail drops an old history cursor, and after a lost push. (US-8.8)
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
- `apps/pipeline` — the full mailbox watch, the four history types, the `MailStore` Workflow, and the correction step of `MailImport` with its daily cron
- `apps/pipeline` — the retrieval step, the draft step, and the archive action
- D1 migration — `policies`
- Cloudflare — R2, Vectorize, and a Workers AI embedding model
- Gmail — `users.drafts.create` and the label `Mailer/Drafted`

### Build order

1. Watch the full mailbox. Read the four history types. Triage still starts only for a new inbox message.
2. Add the store Workflow. Remove a stored message on delete, Trash, and Spam. Add it again on restore.
3. Add the correction. Run it after a `404` cursor, and one time each day.
4. Show the activity list. The rows exist from Phase 1.
5. Add and delete a policy. Store the file in R2 and the chunks in Vectorize.
6. Create a draft when the action is `drafted`.
7. Add the settings screen with the draft switch and the archive switch.

Steps 1 to 3 come first, because they close the stale-copy limit of Phase 1. They need no later step.

### Release check

Run these steps on staging.

1. Move a labeled email to Trash in Gmail. The email has no row in D1 and no object in R2. Restore it. The two exist again.
2. Delete a labeled email forever in Gmail. The email has no row and no object.
3. A new inbox message still gets its label within 30 seconds. A sent message still gets no label, no row, and no object.
4. Add a refund policy. Send a refund question. A draft that follows the policy waits in Gmail Drafts.
5. Delete that policy. Send the same question. The thread gets `Mailer/Inquiry` and no draft.
6. Turn drafts off. A covered question gets a label and no draft.
7. Allow archive. A spam message leaves the inbox with `Mailer/Spam`.
8. The activity list shows each of those messages with the correct action.

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

---

## Phase 4: Email client

**User outcome.** The user reads, organizes, writes, and sends mail in Mailer. The inbox has one tab for each category. Each action shows in Gmail.

Phase 4 needs Phase 1. It stores no mail. Each screen reads from Gmail at the time of the view.

### User scenarios

- **Read**
  - A connected user sees the inbox as a list of threads. (US-9.1)
  - A connected user opens a thread, reads each message, and downloads an attachment. (US-9.2)
  - A connected user opens Starred, Sent, Drafts, Trash, and each label. (US-9.6)
  - A connected user searches with Gmail syntax. (US-9.7)
- **Triage**
  - A connected user archives a thread, stars it, marks it read or unread, and changes its labels. (US-9.5)
  - A connected user moves a thread to Trash, and restores it from Trash. Mailer has no permanent delete. (US-9.5)
- **Write**
  - A connected user writes a new email, replies, replies to all, forwards, and attaches a file. (US-9.3)
  - The draft saves while the user types, and it shows in Gmail Drafts. (US-9.4)
  - No email leaves before the user presses Send. (US-9.3)
- **Split the inbox**
  - A new account has one tab for each Mailer category, and Other. (US-10.1)
  - A connected user creates a tab from importance, a sender, a label, or a Gmail query. (US-10.2)
  - Each inbox thread shows in a tab. (US-10.3)
- **Decide before consent**
  - The connect page states that Mailer sends only when the user presses Send. (US-1.1)

### What ships

- `apps/web` — the inbox, the thread view, the compose box, the side list, the search bar, and the splits screen
- `apps/gateway` — the thread, draft, label, attachment, and split APIs
- `packages/gmail` — thread list and get, Trash and restore, attachment get, the draft methods, and `users.drafts.send`
- D1 migration — `splits`
- The test that keeps send out of `apps/pipeline`. It replaces the send guard test.

### Build order

1. Show the inbox list and the thread view. Show HTML mail in a sandboxed frame.
2. Add the side list and the Gmail-syntax search.
3. Add archive, star, read state, label changes, Trash, and restore.
4. Add the compose box with a saved Gmail draft. This step sends nothing.
5. Add Send. Change the send rule in `packages/gmail` and the connect page text in the same change.
6. Add the splits table, the default tabs, and the splits screen.

### Release check

Run these steps on staging.

1. The Mailer inbox shows the same threads as the Gmail inbox. The first 25 threads show within 2 seconds.
2. Archive a thread in Mailer. Gmail shows the thread out of the inbox.
3. Move a thread to Trash in Mailer, then restore it. Gmail shows the thread in the inbox again.
4. Reply to a thread from Mailer. The reply shows in Gmail Sent on the same thread, and the recipient gets it.
5. Write a draft and close the box. The draft shows in Gmail Drafts, and no email leaves.
6. Open an HTML email with a script and a remote image. The script does not run, and the image stays off.
7. A High Priority thread shows under the High Priority tab.

---

## Phase 5: AI in the inbox

**User outcome.** The user writes filters in plain English, turns emails into todos, sorts a full inbox with one click, and writes with AI. The AI proposes, and the user confirms.

Phase 5 needs Phase 4. The automatic policy draft is Phase 2.

### User scenarios

- **Filter mail with AI**
  - A connected user writes a filter with a name, a rule, and actions. (US-11.1)
  - New mail that matches gets each action. The category label stays. (US-11.2)
  - A connected user tests a filter on selected threads. The test writes nothing to Gmail. (US-11.3)
  - A connected user turns a filter off or removes it. (US-11.4)
  - No filter sends, deletes, or moves mail to Trash. A Needs Review email gets no filter action. (US-11.5)
- **Turn emails into todos**
  - A connected user turns one thread, or a group, into a todo. (US-12.1)
  - The AI suggests the name. The user can change it. (US-12.2)
  - A connected user adds notes, changes the order, and marks a todo done. (US-12.3)
  - The todos show at the top of the inbox. (US-12.4)
- **Organize the inbox**
  - A connected user presses Organize and sees three groups. (US-13.1)
  - No thread changes before the user confirms its group. (US-13.2)
  - An unsure thread stays in the inbox. (US-13.3)
  - Organize archives. It never deletes. (US-13.4)
- **Write with AI**
  - A connected user describes an email and gets a draft. (US-14.1)
  - A connected user presses Reply with AI on a thread. (US-14.2)
  - A connected user improves a draft. (US-14.3)
  - AI text stays in the compose box until the user presses Send. (US-14.4)
- **Leave**
  - Disconnect also deletes the filters, the splits, and the todos. (US-1.6)

### What ships

- `apps/web` — the filters screen, the todo list, the Organize proposal, and the AI controls in the compose box
- `apps/gateway` — the filter, todo, organize, and writing APIs
- `apps/pipeline` — the filter step in the `MailTriage` Workflow
- `packages/domain` — the filter match in the triage schema, the limit of 10 filters, and the limit of 50 threads for Organize
- D1 migration — `filters`, `todos`, and `todo_threads`
- `apps/evals` — fixture filters, when Phase 3 is live

### Build order

1. Add filters: the table, the screen, and the filter step in the Workflow.
2. Add the filter test on selected threads.
3. Add todos: the tables, the list in the inbox, and the suggested name.
4. Add Organize: the proposal, then the confirm step.
5. Add the AI controls in the compose box.

### Release check

Run these steps on staging.

1. Write a filter for billing questions with the actions label and star. Send a billing question. The thread gets `Mailer/<name>`, a star, and its category label within 30 seconds.
2. Test that filter on a thread that does not match. The test shows no action, and Gmail shows no change.
3. Turn the filter off. Send the same question. The thread gets the category label only.
4. Turn two threads into one todo. Add a note and reload. The name, the note, and the order stay.
5. Press Organize. Before a confirm, Gmail shows no change. After the confirm, the important threads have a star, the todos exist, and the rest are out of the inbox.
6. Press Reply with AI. The compose box holds a draft. No email leaves before Send.

---

## Phase 6: Mail store and AI search

**User outcome.** The user describes an email and Mailer finds it. The user asks a question and gets an answer with links to the threads. For that purpose, the mail store of Phase 1 grows to all mail of the last 90 days. The store follows each delete in Gmail from Phase 2.

Phase 6 needs Phase 4. It does not need Phase 5, so it can ship before Phase 5.

### User scenarios

- **Grow the copy to all mail**
  - Mailer imports the last 90 days of mail. The import writes nothing to Gmail. (US-8.1)
  - Each new email and each sent email enters the store. A draft does not. (US-8.2)
  - The rules of Phase 2 stay: a deleted message leaves the store, and a restored message enters it again. Each rule now covers the vectors too. (US-8.3, US-8.4, US-8.8)
- **Protect the copy**
  - One account never reads the mail of another account. (US-8.5)
  - The rules of Phase 1 stay: text only, and one data key for each account. (US-8.6, US-8.7)
- **Search with AI**
  - A connected user finds an email from a description. (US-15.1)
  - A connected user asks a question. The answer links to its threads. (US-15.2)
  - Mailer says when it finds nothing. (US-15.3)
  - The search screen states that the import still runs. (US-15.4)
  - Deleted mail stays out of each result. (US-15.5)
- **Write in my voice**
  - AI drafts use sent emails of the user as style examples. (US-14.5)
- **Leave**
  - Disconnect deletes the data key first, then each vector, each body, and each row. (US-1.6, US-8.7)

### What ships

- `apps/pipeline` — the add of each new email and each sent email in `MailStore`, the import step of `MailImport`, and the vector step of `MailStore` and `MailDelete`
- `apps/gateway` — the search and answer APIs
- `packages/domain` — the import window of 90 days
- D1 migration — the chunk count on `messages`
- Cloudflare — a Vectorize index for the mail chunks. The R2 bucket exists from Phase 1.
- Secrets — `MAIL_ENCRYPTION_KEY` on the gateway too. The pipeline has it from Phase 1.
- The privacy text of the connect page. It states that the copy covers all mail of the last 90 days.

### Build order

1. Move the cipher of Phase 1 to a shared package. Add the vectors to the add action and to the remove action.
2. Add each new email and each sent email to the store. The full mailbox watch exists from Phase 2.
3. Add the vectors to the delete Workflow of Phase 1. Ship no search before this step passes.
4. Add the import step for the last 90 days. Run it after connect, and with each correction run of Phase 2.
5. Add find by description.
6. Add ask a question.
7. Add sent emails as style examples to the AI draft prompt.

### Release check

Run these steps on staging.

1. Connect a test account. When the import ends, an email from last month has a row in D1, a body in R2, and vectors in Vectorize.
2. Read that R2 object in the Cloudflare dashboard. The object is not readable text.
3. Send an email from Gmail. The sent message enters the store. It gets no label.
4. Move an email to Trash in Gmail. The email has no row, no body, and no vector. Restore it. The three exist again.
5. Describe an email with no word from its text. Mailer finds it.
6. Ask a question that one email answers. The answer links to that thread.
7. Ask a question that no email answers. Mailer states that it found nothing.
8. Disconnect. The account has no data key, no row, no object, and no vector.

---

## Phase 7: Autocomplete

**User outcome.** A grey suggestion completes the sentence while the user types. The suggestion uses the thread and related mail of the user.

Phase 7 needs Phase 4 and Phase 6.

### User scenarios

- **Complete my sentences**
  - A grey suggestion shows after a pause. Tab accepts it. (US-16.1)
  - The suggestion uses the thread and related mail from the mail store. (US-16.2)
  - Mailer waits for a pause of 300 ms. A suggestion shows within 1 second after the pause. (US-16.3)
  - A suggestion stays out of the email until the user accepts it. (US-16.4)

### What ships

- `apps/web` — the grey suggestion in the compose box
- `apps/gateway` — the suggestion API with a small model
- `packages/domain` — the pause of 300 ms and the target of 1 second

### Build order

1. Query the mail index one time when a draft opens. The browser holds the related text for that draft.
2. Add the suggestion API. Measure the time of each candidate model on staging, then choose the model.
3. Show the suggestion after the pause. Cancel the open request when the user types again.

### Release check

Run these steps on staging.

1. Reply to a thread and pause. A grey suggestion shows within 1 second.
2. Press Tab. The suggestion becomes text of the draft.
3. Type through a suggestion. The suggestion goes away, and the draft holds only the typed text.
4. Write to a contact with past mail. A suggestion holds a fact from that mail.
