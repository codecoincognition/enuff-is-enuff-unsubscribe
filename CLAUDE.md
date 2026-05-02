# enuff-is-enuff-unsubscribe — directory mode

You are Claude Code running inside the `enuff-is-enuff-unsubscribe` source directory. The user has chosen the **directory-mode** path: they did not install this as a plugin. There are no slash commands available. Walk them through the workflow manually using the files in this repo.

If the user installed this as a Claude Code plugin instead, they would invoke `/enuff-is-enuff-unsubscribe:scan` / `:review` / `:act`. In directory mode, you do the same work — you read the same skill files, you run the same `node bin/enuff_scan.mjs` commands — but you orchestrate it yourself instead of being routed by slash commands.

## Greet on the first turn

If this is the first user message and they have not specified an action, say something like:

> Hi — this is the `enuff-is-enuff-unsubscribe` workflow in directory mode. I'll help you scan an exported mailbox, review noisy senders brand-by-brand, and (with your per-action approval) open unsubscribe links in your browser. Send me the path to your `.mbox` file or `.eml` folder to start. (Apple Mail `.mbox` packages are directories — point me at the inner `mbox` file inside, e.g. `~/Downloads/INBOX.mbox/mbox`.)

## The three phases

Mirror the slash-command flows. Read the corresponding skill or command files for the canonical instructions before running each phase:

### Phase 1 — Scan
Source of truth: `commands/scan.md` and `skills/inbox-scan/SKILL.md`.

Run:
```bash
node bin/enuff_scan.mjs scan "<path-to-mbox-or-eml-folder>"
```

Outputs land in `enuff-is-enuff-report/`. Summarize the printed totals; do not act.

### Phase 2 — Review (conversational, per brand)
Source of truth: `commands/review.md` and `skills/unsubscribe-planning/SKILL.md`. Follow them exactly.

Key rules from the planning skill (read the file for the full version):
- Walk the user company-by-company in chat. Skip protected streams (`account_security`, `orders_receipts`, `protected_high_risk`) — they are locked.
- Surface multi-stream brands with per-stream choices (e.g. `Substack: newsletter (5) · marketing_promos (1)`).
- Accept selection grammar like `Substack:newsletter`, `Brand:s1+s2`, `all newsletters`, `all newsletters except X`, or `none`.
- Edit `enuff-is-enuff-report/approved-actions.json` directly to set `"approved": true` on chosen items by `id` (`{domain}::{stream}`). This file is the canonical approval source.
- Do **not** auto-approve. Do **not** render `report.html` before the user has chosen.
- After approvals are saved, render the report:
  ```bash
  node bin/enuff_scan.mjs review enuff-is-enuff-report
  ```
- Tell the user to open `enuff-is-enuff-report/report.html` to confirm visually. Their approved items are highlighted in green (badge + row background + top summary panel).

### Phase 3 — Act (per-action approval; browser-driven)
Source of truth: `commands/act.md` and `skills/safe-action/SKILL.md`. Follow them exactly.

Hard gate before doing anything:
> "Have you reviewed the report? Are you okay with everything?"

Then for **every** approved item, one at a time:
1. Show the URL or draft email and explain what will happen.
2. Classify the URL as **one-click / token** (provider unsubscribes on GET — Substack, Mailchimp, Beehiiv, ConvertKit, Buttondown, SendGrid, etc.) vs **multi-step / account-scoped** (login or confirm-button required).
3. Ask for explicit per-item approval. A blanket "yes proceed" earlier is **not** authorization for individual items.
4. **Take the action — don't just open the page:**
   - **One-click / token URLs:** call Node `fetch(url, { method: 'GET', redirect: 'follow' })`. Check status 2xx and body for markers like `unsubscribed`, `disabled`, `removed`, `cancelled`, `you have been`, `no longer`, `success`. Report verified completion to the user. If markers are missing or status is non-2xx, fall back to `open <url>` and ask the user to verify.
   - **Multi-step URLs:** `open <url>` so the user can complete in their browser, then ask them to confirm completion.
   - **Mailto URLs:** draft the email, show it, ask before opening their mail client.
5. Append the action to `enuff-is-enuff-report/action-log.md` with timestamp, item id, URL, user response, method used (`fetch`/`open`/`mailto`), response details, and conclusion (`completed` / `started in browser — user to confirm` / `failed` / `refused`).
6. **End-of-act summary (mandatory).** After every approved item is processed, post a recap to the user: counts (total / completed / started-in-browser / failed / refused), a per-item table with ✓ / ⚠ / ✗ icons, any items needing user follow-up, a pointer to `enuff-is-enuff-report/action-log.md`, and a "what happens next" line. Always close the act phase with this summary — do not let the user guess what got done.

Never enter credentials, delete/archive messages, create filters, or submit confirmation forms without explicit per-action approval. Never leave an item at "I opened the page, you go check" for a one-click URL — that is incomplete work.

## Path conventions in directory mode

- Commands use `node bin/enuff_scan.mjs ...` (relative to this directory). Plugin mode uses `node "${CLAUDE_PLUGIN_ROOT}/bin/enuff_scan.mjs" ...` because the user can be anywhere when invoking a slash command.
- Output and state files live under `enuff-is-enuff-report/` in the current working directory. Tell the user where to find them when summarizing each phase.

## What's allowed in directory mode that's NOT in plugin mode

Nothing. Same safety rules. Same skills. Same per-action approval. Directory mode is just a different entry point.
