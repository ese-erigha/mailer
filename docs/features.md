# Features: Mailer

Mailer is an AI email client for one Gmail account. This file is the list of features to deliver. The list has two sources: the first version of Mailer, and Shortwave.

- [prd.md](prd.md) owns the behavior. Each feature below names its epic.
- [architecture.md](architecture.md) owns the design.
- [delivery.md](delivery.md) owns the release scope and the release check of each phase.
- The Shortwave facts come from its public site, read on 2026-11-12. Section 9 lists the pages.

---

## 1. Owner tags

- **[Ours]** — The feature comes from the first version of Mailer. The Shortwave site does not list it.
- **[Theirs]** — The feature comes from Shortwave. It is new for Mailer.
- **[Both]** — The first version of Mailer has the feature, and Shortwave has it. The line states what Mailer adds.

---

## 2. One rule for each AI feature

The AI proposes. The user confirms.

- Mailer sends an email only when the user presses Send.
- Mailer does a bulk action only after the user confirms it.
- Two paths run with no confirmation: a filter that the user wrote, and a policy draft. Neither path sends, and neither path deletes.
- Permanent delete stays forbidden. Delete moves a thread to Trash.

---

## 3. Features from the first version of Mailer

- **O-1: Connect Gmail.** **[Both]** Phase 1, Epic 1. The user connects one Gmail account with Google sign-in. The connect page states what Mailer does with the permission.
- **O-2: Category label on new mail.** **[Both]** Phase 1, Epic 3. Each new email gets one category: Spam, High Priority, Action Required, or Inquiry.
- **O-3: Needs Review.** **[Ours]** Phase 1, Epic 3. A classification below the confidence `0.7` gets `Mailer/Needs-Review` only.
- **O-4: Each message is handled once.** **[Ours]** Phase 1, Epic 2. A duplicate push, a missed push, and two close pushes all give one result.
- **O-5: Policy draft.** **[Both]** Phase 2, Epic 4. An Inquiry or an Action Required email that a policy covers gets one draft reply.
- **O-6: Policies.** **[Ours]** Phase 2, Epic 5. The user writes reply rules. The automatic draft follows them. With no matching policy, Mailer writes no automatic draft.
- **O-7: Activity list.** **[Ours]** Phase 2, Epic 6. The list shows the time, the subject, the category, and the action for each handled email.
- **O-8: Settings.** **[Ours]** Phase 2, Epic 6. The user turns automatic drafts off. The user allows or denies archive for Spam.
- **O-9: Disconnect.** **[Both]** Phase 1, Epic 1. Disconnect stops the watch and deletes each stored item of the account.
- **O-10: Evaluation gate.** **[Ours]** Phase 3, Epic 7. A golden set checks category accuracy, Spam precision, and policy compliance on each pull request.
- **O-11: Cost record.** **[Ours]** Phase 3, Epic 7. Each handled email stores the model id, the token counts, and the latency.
- **O-12: Labels on recent mail at connect.** **[Ours]** Phase 1, Epic 2. After the connection, Mailer labels the inbox mail of the last 7 days, then the inbox mail of days 8 to 30. It adds a label only.
- **O-13: Encrypted copy of classified mail.** **[Both]** Phase 1, Epic 8. Mailer stores the text of each email that it classifies, encrypted with a key for that account. Disconnect deletes the copy. Shortwave also stores a copy of the mail. Mailer adds one data key for each account.

---

## 4. Features from Shortwave

### F-1: Email client

**[Theirs]** Phase 4, Epic 9. An email client like the Gmail inbox.

- **The user can:**
  - See the inbox as a list of threads, with the sender, the subject, the time, the labels, and the unread state
  - Open a thread, read each message, and download an attachment
  - Write a new email, reply, reply to all, forward, attach a file, and send
  - Save a draft, open it later, and discard it. The draft also shows in Gmail.
  - Archive a thread, move it to Trash, restore it, star it, mark it read or unread, and change its labels
  - Open Starred, Sent, Drafts, Trash, and each label from a side list
  - Search with Gmail syntax, such as `from:` and `has:attachment`
- **Storage:** None. Each screen reads from Gmail at the time of the view. Gmail runs the search.
- **Send:** The compose box saves a Gmail draft. Send calls `users.drafts.send` for that draft. No other path sends.
- **Risk:** `users.threads.list` returns thread ids only. The list reads the thread metadata in one Gmail batch request. Measure the load time of the inbox on staging.

### F-2: Organize your inbox

**[Theirs]** Phase 5, Epic 13. "Identify important emails & todos with a single click. Sweep away the rest."

- **The user can:**
  - Press Organize, and see three proposed groups: important emails, todos, and the rest
  - Confirm each group. Mailer stars the important emails, creates the todos, and archives the rest.
- **How it runs:** One model call reads the subject, the sender, and the snippet of 50 inbox threads at most.
- **Guards:** No thread changes before the confirm. An unsure thread stays in the inbox. Organize archives, and it never deletes.

### F-3: AI filters

**[Both]** Phase 5, Epic 11. "Automatically label, star, archive, and more with scripts you write in plain English." This feature extends O-2.

- **The user can:**
  - Write a filter: a name, a rule in plain English, and one or more actions
  - Choose from the actions label, star, mark important, mark read, and archive
  - Test a filter on selected threads, and see the action and the reason for each thread
  - Turn a filter off, or remove it
- **How it runs:** The triage Workflow sends the filters to the classifier with each new email. A filter label adds to the category label.
- **Guards:** No filter sends, deletes, or moves mail to Trash. A Needs Review email gets no filter action. An account holds 10 filters at most.

### F-4: Write and enhance emails with AI

**[Both]** Phase 5, Epic 14. This feature extends O-5.

- **The user can:**
  - Describe an email in one sentence. The AI writes the draft in the compose box.
  - Press Reply with AI on a thread. The AI writes a reply draft from the thread.
  - Improve a draft: fix the grammar, make it shorter, change the tone, or complete a partial draft
  - Receive the automatic policy draft of O-5
- **Policy:** The policy rule of O-6 applies only to the automatic draft. A draft that the user requests does not need a matching policy.
- **Voice (Phase 6):** The draft prompt receives sent emails of the user as style examples. Shortwave calls this Ghostwriter.

### F-5: AI search and answers

**[Theirs]** Phase 6, Epic 15. "Use AI-powered search to find emails fast."

- **The user can:**
  - Find an email from a description, with no exact keyword. Example: "the invoice from the printer in March".
  - Ask a question about the mail. The answer links to the threads that it came from.
- **Needs:** The mail store and the mail index of section 5.
- **How it runs:**
  1. Workers AI makes a vector from the question.
  2. Vectorize returns the nearest chunks in the namespace of the account.
  3. Mailer reads and decrypts the text of those messages from the mail store.
  4. The model writes the answer from that text. The answer links to the threads.
- **Guard:** When no stored mail matches, Mailer states that it found nothing.

### F-6: Autocomplete

**[Theirs]** Phase 7, Epic 16. "Get personalized suggestions while you type, including real links, facts, and phrases from your email history."

- **The user can:**
  - See a grey suggestion that completes the sentence, and press Tab to accept it
  - Get a suggestion that uses the thread and related emails from the index
- **Needs:** The compose box of F-1, and the mail store and the mail index of section 5.
- **Speed.** The index supplies the related text. It does not make the model faster. The model call sets the delay and the cost. These rules keep both low:
  - **Wait for a pause.** Mailer calls the model only after the user stops for 300 ms.
  - **Cancel a late call.** When the user types again, Mailer cancels the open request and drops its answer.
  - **Query the index one time.** The query runs when the draft opens. No key press queries Vectorize or R2.
  - **Keep the prompt small.** The prompt holds the draft, the last message of the thread, and the related text only.
  - **Keep the answer short.** The model completes the current sentence only.
  - **Use a small model.** Choose the model from a time measurement on staging.
- **Target:** A suggestion shows within 1 second after the pause.
- **Cost:** Each pause in typing is one model call. No other feature in this list calls the model that often.

### F-7: Split your inbox

**[Theirs]** Phase 4, Epic 10. "Dividing your inbox into tabs for important emails, specific senders, labels & even custom queries."

- **The user can:**
  - See tabs at the top of the inbox. Each tab shows the inbox threads that match one rule.
  - Create a tab from importance, a sender, a label, or a Gmail query
  - Order the tabs. The tab named Other holds each thread that matches no tab.
- **Defaults:** One tab for each Mailer category, and Other.
- **Storage:** The rule of the tab only. Mailer stores no mail for this feature.

### F-8: Todos

**[Theirs]** Phase 5, Epic 12. "Group, rename, prioritize, and add notes, right in your inbox."

- **The user can:**
  - Turn one thread, or a group of threads, into a todo with one click
  - Accept or change the name that the AI suggests
  - Add notes, change the order, and mark the todo done
  - See the todos at the top of the inbox
- **Already in the code:** The classifier returns `action_items` and `due_on`. No code stores them today. They can supply the suggested name.

---

## 5. The mail store

- **Phase 1** starts the mail store. Mailer stores each email that it classifies, encrypts it, and deletes it on disconnect.
- **Phase 2** starts with the sync that makes the store follow Gmail. A deleted message leaves the store, and a restored message returns.
- **Phase 6** completes the store. It covers all mail of the last 90 days, and it gains the mail index.

AI search, autocomplete, and the voice part of F-4 read a copy of the mail. `prd.md`, Epic 8, owns its behavior. `architecture.md`, Tier 3, Tier 5, and section 5, own its design. This section is the summary.

### 5.1 The mail store and the mail index

- **D1** holds one row for each message: the Gmail ids, the sender, the recipients, the subject, and the date.
- **R2** holds the body text, encrypted. Attachments stay in Gmail.
- **Vectorize** holds the vectors of the body chunks, from Phase 6. Each account has its own namespace, so one account never reads the mail of another account.
- In Phase 1, the store holds each email that Mailer classifies: new inbox mail, and the inbox mail of the last 30 days.
- From Phase 6, the store holds all mail of the last 90 days. It then grows with each later message.

### 5.2 Sync: keep the copy equal to Gmail (Phase 2 and Phase 6)

Gmail is the source. The user reads, sends, and deletes mail in Gmail and in Mailer. A message does not change after Gmail receives it, so sync has two actions: add a message, and remove a message.

The rule: the store holds a message only while Gmail holds it outside Trash and Spam, and only when it is not a draft.

- **Deleted mail** leaves the store, from Phase 2. This covers a permanent delete, a move to Trash, and a move to Spam.
- **Restored mail** enters the store again, from Phase 2. This covers a restore from Trash and from Spam. Until Phase 6, it covers only the mail that Mailer classified.
- **The daily correction** removes each stored message that Gmail no longer lists, from Phase 2. The same run occurs after Gmail drops an old history cursor.
- **New mail and sent mail** enter the store, from Phase 6. Sent mail still gets no label. In Phase 1 and Phase 2, the store gets only the mail that Mailer classifies.
- **The import** adds the last 90 days after the connection, from Phase 6. It writes nothing to Gmail. The daily correction then also adds each message that the store lacks.

Sync does not trust the event. For each changed message, it reads the current state from Gmail and makes the store match. So a move to Trash and a restore that occur close together end in the correct state.

A delete in Mailer and a delete in Gmail use the same path.

In Phase 1, the store does not follow a delete in Gmail. The copy of a deleted email stays until disconnect. The first step of Phase 2 removes that limit.

### 5.3 Encryption: one key per account (Phase 1)

Mailer encrypts each body before the write to R2. This design is envelope encryption.

- Each account has its own data key. The cipher is AES-256-GCM, with a new nonce for each body.
- D1 holds the data key only in wrapped form, under the Worker secret `MAIL_ENCRYPTION_KEY`.
- `MAIL_ENCRYPTION_KEY` and `TOKEN_ENCRYPTION_KEY` are different secrets.

The reasons:

- A copy of the bucket exposes no mail. A reader needs the D1 row and the Worker secret too.
- Disconnect deletes the data key first. Each body is unreadable from that moment.
- A change of the Worker secret wraps each data key again. The bodies stay as they are.

The limits:

- The vectors and the D1 rows have no encryption from Mailer. Search needs them in plain form. Cloudflare encrypts D1 and R2 at rest.
- A vector comes from the text. Treat it as mail data.
- The model provider receives plain mail text inside a prompt.

### 5.4 Disconnect: delete each copy (Phase 1)

1. Delete the data key. The bodies are unreadable.
2. A delete job removes the R2 bodies, then the D1 rows. From Phase 6, it removes the vectors first.
3. The job ends only when the account has no vector, no object, and no row.

---

## 6. Decisions

Each decision below is in `prd.md`.

- **Send.** Mailer sends only when the user presses Send. `users.drafts.send` is the one send method. `apps/pipeline` never sends.
- **Delete.** Delete moves a thread to Trash. The user can restore it. Mailer has no permanent delete.
- **Stored mail.** The mail store starts in Phase 1. It holds encrypted text only. Phase 1 stores each email that Mailer classifies. The email client of Phase 4 adds no stored mail.
- **Import.** The import of Phase 6 covers all mail of the last 90 days.
- **Backfill.** Phase 1 labels the inbox mail of the last 30 days at the connection, and stores a copy of each email that it classifies.
- **Scheduling.** Calendar features are future work.

These numbers are starting values. Measure each one on staging, then change it in `packages/domain`.

- **Autocomplete:** a pause of 300 ms, and a suggestion within 1 second after the pause
- **Filters:** 10 for each account. Shortwave allows 3, 10, or 50 by plan.
- **Organize:** 50 threads for one request. Shortwave allows 50, 100, or 150 by plan.
- **Inbox:** the first 25 threads within 2 seconds
- **Backfill:** the last 7 days first, then days 8 to 30, with 100 threads each 60 seconds

---

## 7. Build order

Each phase is one release. `delivery.md` holds the build order and the release check of each phase.

1. **Phase 1: Connect and label.** O-1 to O-4, O-9, O-12, and O-13.
2. **Phase 2: Policy and drafts.** The sync of section 5.2 comes first. Then O-5 to O-8.
3. **Phase 3: Evaluation gate.** O-10 and O-11. This phase can start after Phase 1.
4. **Phase 4: Email client.** F-1 and F-7. This phase needs Phase 1.
5. **Phase 5: AI in the inbox.** F-3, F-8, F-2, and F-4. This phase needs Phase 4.
6. **Phase 6: Mail store and AI search.** Section 5, and F-5. This phase needs Phase 4 only, so it can ship before Phase 5.
7. **Phase 7: Autocomplete.** F-6. This phase needs Phase 4 and Phase 6.

---

## 8. Shortwave features for later

These Shortwave features are not in this list.

- **Calendar:** availability checks, calendar events, and scheduling emails. This feature needs a Google Calendar scope, so each user consents again.
- **Inbox:** bundles, delivery schedules, snooze, block and unsubscribe, and instant summaries
- **AI:** AI memory, saved prompts, snippets, attachment analysis, web browsing, and integrations with other apps
- **Sent mail:** read statuses, link tracking, follow-up reminders, scheduled send, and undo send
- **Team:** shared threads, comments, assignees, shared labels, and channels
- **Client:** native apps, the command palette, keyboard shortcuts, themes, and multiple accounts

---

## 9. Sources

Shortwave:

- [Shortwave home page](https://www.shortwave.com/)
- [Pricing and plan features](https://www.shortwave.com/pricing/)
- [The Shortwave Method](https://www.shortwave.com/docs/guides/method/)
- [The AI Assistant guide](https://www.shortwave.com/docs/guides/ai-assistant/)
- [Customize your Shortwave: splits, bundles, AI filters](https://www.shortwave.com/docs/guides/customize-your-shortwave-settings/)
- [Security and privacy](https://www.shortwave.com/docs/guides/security/)
- [Import full history](https://www.shortwave.com/docs/how-tos/import-full-history/)

Cloudflare and Google:

- [Cloudflare Vectorize limits](https://developers.cloudflare.com/vectorize/platform/limits/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare R2 data security](https://developers.cloudflare.com/r2/reference/data-security/)
- [Cloudflare D1 data security](https://developers.cloudflare.com/d1/reference/data-security/)
- [Gmail push notifications](https://developers.google.com/workspace/gmail/api/guides/push)
- [Gmail `users.history.list`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list)
