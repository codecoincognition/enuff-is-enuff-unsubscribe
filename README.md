<p align="center">
  <img src="assets/enuff-is-enuff.png" alt="enuff is enuff" width="240">
</p>

# enuff-is-enuff-unsubscribe

A blunt, local-first inbox cleanup workflow for Claude Code.

## What it does

Claude scans an exported mailbox, ranks the senders that won't leave you alone — newsletters you never read, ecommerce promos, abandoned SaaS drips, "we miss you" campaigns, zombie senders — and helps you unsubscribe one item at a time, with your approval, locally, without ever touching your live inbox.

Inspired by `just-fucking-cancel`: Claude does the annoying digital chores, you stay in charge.

## Install

Pick whichever fits — both run the same workflow with the same safety rules.

### Option 1 — install as a Claude Code plugin

Plugin mode gives you slash commands that work from any directory.

**From the public repo** (recommended):

```text
/plugin marketplace add codecoincognition/enuff-is-enuff-unsubscribe
/plugin install enuff-is-enuff-unsubscribe@enuff-is-enuff-local
/reload-plugins
```

> **Note:** `enuff-is-enuff-local` is the marketplace name (defined in `.claude-plugin/marketplace.json`), not a typo. The format is always `plugin-name@marketplace-name`.

**From a local clone** (when you're modifying the plugin):

```bash
git clone https://github.com/codecoincognition/enuff-is-enuff-unsubscribe.git
# then, in Claude Code:
/plugin marketplace add ./enuff-is-enuff-unsubscribe
/plugin install enuff-is-enuff-unsubscribe@enuff-is-enuff-local
/reload-plugins
```

**Or load directly without installing** (fastest for development — no copy to cache):

```bash
claude --plugin-dir ./enuff-is-enuff-unsubscribe
```

Once loaded, slash commands work from any directory:

```text
/enuff-is-enuff-unsubscribe:scan <path-to-mbox-or-eml-folder>
/enuff-is-enuff-unsubscribe:review
/enuff-is-enuff-unsubscribe:act
```

If you edit any plugin file after installing, run `/reload-plugins` again to pick up the changes without restarting Claude Code.

### Option 2 — download the repo and let Claude walk you through it

No plugin install, no git required.

1. Go to [github.com/codecoincognition/enuff-is-enuff-unsubscribe](https://github.com/codecoincognition/enuff-is-enuff-unsubscribe).
2. Click the green **Code** button → **Download ZIP**.
3. Unzip it (double-click on Mac; right-click → Extract on Windows). You'll get a folder named `enuff-is-enuff-unsubscribe-main`.
4. Move it somewhere easy to find — your Desktop works.
5. In a terminal:

```bash
cd ~/Desktop/enuff-is-enuff-unsubscribe-main
claude
```

The repo's `CLAUDE.md` auto-loads and walks Claude through the scan → review → act flow using the local `bin/enuff_scan.mjs`. Just say "I want to clean up my inbox" or paste an mbox path. No slash commands needed.

If you have git, the one-liner equivalent is:

```bash
git clone https://github.com/codecoincognition/enuff-is-enuff-unsubscribe.git && cd enuff-is-enuff-unsubscribe && claude
```

### Quick smoke test (either mode)

```bash
node bin/enuff_scan.mjs scan examples/sample-inbox
open enuff-is-enuff-report/report.html
```

The sample inbox is 20 fake `.eml` files spanning every classifier category — perfect for trying the brand-by-brand review without using your real mail.

## How it works

The workflow is the same in plugin mode and directory mode. Only the entry points differ.

### 1. Scan

You give the path to an exported mailbox (Gmail Takeout `.mbox`, Apple Mail `.mbox` package's inner `mbox` file, Thunderbird `.mbox`, or a folder of `.eml` files).

| Plugin mode | Run the slash command: `/enuff-is-enuff-unsubscribe:scan ~/Downloads/INBOX.mbox/mbox` |
| Directory mode | Just tell Claude: *"Scan this mailbox: ~/Downloads/INBOX.mbox/mbox"* — `CLAUDE.md` tells Claude to run `node bin/enuff_scan.mjs scan …` for you |

The scanner reads only message headers (no body, no attachments) and writes:

```text
enuff-is-enuff-report/
  report-state.json        canonical scan state
  approved-actions.json    canonical approval state (all approved=false initially)
  sender-ranking.csv
  recommended-actions.md
```

`report.html` is *not* written until after review. Nothing is acted on yet.

### 2. Review (in Claude chat — the approval surface)

| Plugin mode | Run `/enuff-is-enuff-unsubscribe:review` |
| Directory mode | Just say *"walk me through the candidates"* — `CLAUDE.md` routes to the same skill |

Claude reads `report-state.json`, presents brands grouped by stream (marketing_promos, newsletter, saas_lifecycle, etc.), and **asks you which to flag** brand-by-brand. You can pick at the stream level — e.g. flag `Substack:newsletter` while keeping `Substack:marketing_promos`. Selection grammar: `Brand:stream`, `Brand:s1+s2`, `all newsletters`, `all newsletters except X`, or `none`.

Protected streams (`account_security`, `orders_receipts`, `protected_high_risk`) are locked by safety rules and never appear in the prompt.

Your selections write directly into `approved-actions.json`. Claude then renders `enuff-is-enuff-report/report.html` so you can see your approved items highlighted (green badge, green row, top summary panel listing every approval).

`report.html` is **read-only** — it is a confirmation surface, not an interactive control panel. Approval lives in the chat with Claude.

### 3. Act (one global approval, browser-driven execution)

| Plugin mode | Run `/enuff-is-enuff-unsubscribe:act` |
| Directory mode | Just say *"I'm ready to act"* — `CLAUDE.md` routes to the `safe-action` skill |

Claude first asks the global gate:

```text
Have you reviewed the report? Are you okay with everything?
```

Before processing, Claude shows you the queue (count + a one-line per-item summary) so you have a final visual pass. **One global "yes" then authorizes the entire queue** — Claude does not ask again per URL, because the per-item decisions already happened during review.

For each approved item, Claude:

1. Classifies the URL as **one-click / token** (Substack/Mailchimp/Beehiiv/etc. that unsubscribe on GET), **multi-step / account-scoped** (login or confirm required), or **mailto**.
2. Takes the action and announces the result inline as it goes:
   - **One-click / token URLs** → `fetch(url, { method: 'GET' })`, check the response for success markers, report verified completion.
   - **Multi-step URLs** → `open <url>` in your browser; noted as *needs your verification* in the final summary so the queue keeps moving.
   - **Mailto** → drafts the email and `open "mailto:…"` so it lands pre-filled in your mail client; you press send.
3. Logs the action to `enuff-is-enuff-report/action-log.md`.

When the queue is drained, Claude posts an **end-of-act summary**: counts (completed / needs-verify / mailto-pending / failed), a per-item table with ✓/⚠/✗ icons, and any items still needing your attention.

## Why it exists

Normal unsubscribe tools give you a sender list. This plugin does something more useful:

- **Distinguishes** newsletters from account/security/payment relationships, not just by domain but by header signals (`List-Unsubscribe`, `List-ID`) and subject keywords.
- **Ranks** the worst offenders by volume, recency, and unread rate — so the loudest noise comes first.
- **Explains** why each sender was flagged (recurring promo language, header-based unsub path, no-reply marketing domain, etc.).
- **Picks the right action** per stream: token-URL one-click, multi-step browser flow, mailto draft, or filter-only.
- **Refuses to touch** banking/security alerts, receipts, payroll, healthcare, or government senders — even if you accidentally select them.
- **Keeps every irreversible action behind your approval**, with full action logs.

The product is not "bulk unsubscribe." It's "make the inbox stop harassing me, with judgment, and don't break the things I actually need."

## Privacy & safety

Local-first by design — there is no server.

- Mailbox exports stay on your machine. Nothing is uploaded.
- The scanner reads only message headers (no bodies, no attachments).
- No OAuth, no app passwords, no Gmail API. You hand over a file, not an account.
- Account/security, financial, payroll, healthcare, and government senders are **locked** from the action queue automatically — even if you accidentally select them.
- Every action is logged to `enuff-is-enuff-report/action-log.md` with a timestamp, the URL, the method used, and the verified outcome.
- The plugin will never enter credentials, delete or archive messages, create filters, or send mail without your explicit approval.

The "act" phase opens unsubscribe URLs in your browser and drafts mailto messages — nothing else.

## What's in this repo

```text
.claude-plugin/plugin.json    plugin manifest (option 1)
CLAUDE.md                     directory-mode entry point (option 2)
commands/                     slash command bodies (option 1)
skills/                       canonical workflow skills (used by both options)
agents/                       agent personas (used by both options)
bin/enuff_scan.mjs            scanner / report renderer / serve (Node stdlib only)
examples/
  sample.eml + receipt.eml + security.eml   minimal 3-message smoke test
  sample-inbox/                             ~20 fake messages spanning all classifier categories
assets/                       logos + marketplace screenshots + capture recipe
LICENSE                       MIT
getting-started.html          GitHub-renderable overview page
```

## Requirements

Only Claude Code. The scanner uses the Node.js standard library only — nothing extra to install.

## License

MIT — see [LICENSE](./LICENSE). Copyright 2026 Code Coin Cognition LLC.
