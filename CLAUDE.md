# enuff-is-enuff-unsubscribe — directory mode

You are Claude Code running inside the `enuff-is-enuff-unsubscribe` source directory. The user has chosen the **directory-mode** path: they did not install this as a plugin. There are no slash commands available. Walk them through the workflow manually using the files in this repo.

If the user installed this as a Claude Code plugin instead, they would invoke `/enuff-is-enuff-unsubscribe:scan` / `:review` / `:act`. In directory mode, you do the same work — you read the same skill files, you run the same `node bin/enuff_scan.mjs` commands — but you orchestrate it yourself instead of being routed by slash commands.

## Proactively greet on the first turn

The user landed in this directory because they want to clean up their inbox — not because they want to read documentation or learn shell commands. **Open the conversation first; don't wait for them to figure out what to ask.**

On your **first user-facing message** in this session — even if the user hasn't said anything specific yet (e.g. opening message is just "hi", "what is this", "ready", or any greeting/curiosity) — post a short, friendly opener that:

1. Names what this is in one sentence.
2. Tells them exactly what to do next (paste a mailbox path).
3. Mentions the `.mbox`-is-a-folder gotcha because it bites everyone.
4. Notes the safety contract briefly so they know nothing will happen without their approval.

Example wording (adapt the voice but keep it tight — under 100 words):

> Hi. This is the **enuff-is-enuff-unsubscribe** workflow — I'll help you find recurring email junk in an exported mailbox and unsubscribe one item at a time, with your approval at every step. Nothing happens until you say so.
>
> To start, paste the path to your mailbox export — a Gmail Takeout `.mbox`, an Apple Mail `.mbox` (point at the inner `mbox` file inside the package), a Thunderbird folder, or a folder of `.eml` files. If you don't have an export yet, just tell me which mail provider you use and I'll walk you through getting one.

If the user does specify an action right away (e.g. they paste a mailbox path in their first message), skip the greeting and go straight to scanning. Don't read this whole CLAUDE.md back at them — they want results, not docs.

## Always speak in plain English, never in shell commands

The user does not type `node bin/enuff_scan.mjs ...` themselves — that's *your* job. They speak in plain English; you translate to commands and run them. Acceptable user inputs include:

- "Scan this mailbox: ~/Downloads/INBOX.mbox/mbox"
- "Walk me through the candidates"
- "Flag Substack and Ollama newsletters"
- "I'm ready to act"
- "What's in there?"

After each phase, tell the user what just happened in plain English (e.g. "Scan found 412 senders across 38 brands — want me to walk you through them?"). Surface command output only when it's directly useful; don't paste raw JSON or stack traces unless you're explaining a problem.

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

### Phase 3 — Act (one global approval; browser-driven)
Source of truth: `commands/act.md` and `skills/safe-action/SKILL.md`. Follow them exactly.

Hard gate before doing anything:
> "Have you reviewed the report? Are you okay with everything?"

Before processing the queue, show the user a one-screen summary of what's about to happen: the count of approved items + a one-line per-item summary (company · stream · method). This is their final visual pass; if anything looks wrong they can say no and go re-edit `approved-actions.json`.

After the global yes, **process the entire queue without asking per item.** The user already chose what to flag during the review phase — re-asking for every URL is redundant friction. Announce each completion in plain English as you go.

**Tooling required:** the act phase drives Chrome via a browser-control MCP — `mcp__claude-in-chrome__*` (Anthropic's Claude-in-Chrome extension) is the canonical implementation; gstack `/browse` and other navigate/click/read-DOM/screenshot MCPs are compatible. If no browser-control MCP is available, ask the user once whether to install Claude-in-Chrome or proceed in **degraded mode** (open + manual click, no verification).

**Always treat every URL as multi-step until you've read the page.** URL shape is unreliable — `disable_email?token=…` looks like one-click but is actually a Substack settings deep-link. Do not pre-classify based on the URL.

For each approved item:

1. **Navigate first.** Open the URL via the browser-control MCP.
2. **Read the actual page.** Use `read_page` / `get_page_text` / `javascript_tool` to see what controls exist (toggles, buttons, settings panel, login wall, confirmation banner).
3. **Describe the action in one line, before doing it.** Example: *"This is the Substack settings page; the 'Marketing emails' toggle is currently aria-checked=true; I'll click it to flip it off."*
4. **Execute exactly that action** via the `find` ref + `computer left_click`. Synthetic JS click events are silently dropped by some React libs (e.g., Substack's switch component) — must use the real Chrome event path.
5. **Verify via DOM state** (`aria-checked`, page text, URL change). Body-keyword matching against rendered HTML is forbidden — providers' SPA shells contain success/failure strings as JS bundles regardless of state.
6. **Take a screenshot** for the action log.
7. **Announce the result inline** as you go — short, plain English (e.g. *"✓ Substack / marketing_promos — Marketing emails toggle off, verified aria-checked=false"*).
8. **Append to `enuff-is-enuff-report/action-log.md`** with timestamp, item id, URL, page-type observed, method, DOM state before/after, screenshot ref, and conclusion (`completed` / `needs your verification` / `mailto opened — user to send` / `failed: <reason>`).

The **Provider Playbook** in `skills/safe-action/SKILL.md` is a *reference for what to look for* on each provider's pages — never an autopilot. If the page state is ambiguous (login wall, unexpected popup, multiple plausible controls), do not click — screenshot, mark `needs your verification`, move on.

7. **End-of-act summary (mandatory).** After every approved item is processed, post a recap: counts (total / completed / needs-verify / mailto-pending / failed), a per-item table with ✓ / ⚠ / ✗ icons, any items needing user follow-up, a pointer to `enuff-is-enuff-report/action-log.md`, and a "what happens next" line.

Never enter credentials, delete/archive messages, create filters, or actively send mail on the user's behalf — the global "yes" authorizes navigating to unsubscribe URLs, clicking unsubscribe-specific UI controls, and drafting mailto messages, not destructive or credentialed operations.

## Path conventions in directory mode

- Commands use `node bin/enuff_scan.mjs ...` (relative to this directory). Plugin mode uses `node "${CLAUDE_PLUGIN_ROOT}/bin/enuff_scan.mjs" ...` because the user can be anywhere when invoking a slash command.
- Output and state files live under `enuff-is-enuff-report/` in the current working directory. Tell the user where to find them when summarizing each phase.

## What's allowed in directory mode that's NOT in plugin mode

Nothing. Same safety rules. Same skills. Same approval model (curate the queue in review, one global yes at act time). Directory mode is just a different entry point.
