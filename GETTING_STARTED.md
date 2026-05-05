# Getting Started

## Pick Your Mode

There are two ways to use `enuff-is-enuff-unsubscribe`. They run the same workflow with the same safety rules — pick whichever fits.

### Mode A — install as a Claude Code plugin

Three ways to install, in order of how often you'd use each:

**From the public repo** (one-step, shareable). In any Claude Code session:

```text
/plugin marketplace add codecoincognition/enuff-is-enuff-unsubscribe
/plugin install enuff-is-enuff-unsubscribe@enuff-is-enuff-local
/reload-plugins
```

**From a local clone** (when you're modifying the plugin):

```bash
git clone https://github.com/codecoincognition/enuff-is-enuff-unsubscribe.git
# then, in Claude Code:
/plugin marketplace add ./enuff-is-enuff-unsubscribe
/plugin install enuff-is-enuff-unsubscribe@enuff-is-enuff-local
/reload-plugins
```

**Loaded directly without installing** (fastest dev loop — skips the marketplace and the cache copy):

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

Best for: keeping the workflow available across all your projects, no need to clone anything.

### Mode B — download the repo and use directory mode

No plugin install, no git required.

1. Go to [github.com/codecoincognition/enuff-is-enuff-unsubscribe](https://github.com/codecoincognition/enuff-is-enuff-unsubscribe).
2. Click the green **Code** button → **Download ZIP**.
3. Unzip (double-click on Mac; right-click → Extract on Windows). You'll get a folder named `enuff-is-enuff-unsubscribe-main`.
4. Move it somewhere easy to find — your Desktop works.
5. In a terminal:

```bash
cd ~/Desktop/enuff-is-enuff-unsubscribe-main
claude
```

The repo's `CLAUDE.md` auto-loads and tells Claude to walk you through the same scan → review → act flow using the local `bin/enuff_scan.mjs`. Just say "I want to clean up my inbox" or paste an mbox path. No slash commands needed.

Already have git? One-liner:

```bash
git clone https://github.com/codecoincognition/enuff-is-enuff-unsubscribe.git && cd enuff-is-enuff-unsubscribe && claude
```

Best for: trying it before installing, one-off use, dev containers, ephemeral sandboxes, or any environment where you don't want to install plugins.

The rest of this guide uses generic command snippets that work in either mode. In plugin mode, prefix the command with the slash command equivalent if you prefer (e.g. `/enuff-is-enuff-unsubscribe:scan ~/Downloads/INBOX.mbox/mbox`); in directory mode, just describe what you want and Claude follows the steps below.

## What You Are About To Do

1. Export email from Gmail, Apple Mail, Thunderbird, or another mail client.
2. Run the local scanner.
3. Review recurring email noise by company **with Claude in chat** (the brand-by-brand approval surface).
4. Open the local HTML report to confirm what you approved.
5. Tell Claude to act — one "yes" authorizes the queue, then Claude works through every approved item and reports each completion.
6. Read the end-of-act summary.

No email cleanup action happens during the scan or the review.

## Step 1: Export Email

Recommended first source:

- Gmail Takeout `.mbox`

Other supported sources:

- Apple Mail `.mbox`
- Thunderbird `.mbox`
- folder of `.eml` files

### Gmail

1. Go to Google Takeout.
2. Choose Deselect all, then select Mail.
3. Use All Mail or choose specific Gmail labels.
4. Create the export and wait for the archive.
5. Download and unzip it, then scan the `.mbox` file.

Source: https://support.google.com/mail/answer/10016932

### Apple Mail on Mac

1. Open Mail.
2. Select one or more mailboxes in the sidebar.
3. Choose Mailbox > Export Mailbox.
4. Choose a folder and click Choose.
5. Scan the exported `.mbox` package.

Source: https://support.apple.com/guide/mail/import-or-export-mailboxes-mlhlp1030/mac

### Thunderbird

1. Use Thunderbird's export/profile tooling for a backup, or locate the local profile mail folders.
2. For large profiles, avoid relying on one huge zip export.
3. Scan the mailbox file or a copied folder of local mail files.

Source: https://support.mozilla.org/en-US/kb/thunderbird-export

### Outlook and Outlook.com

1. Use desktop Outlook to export mail to a `.pst` file.
2. This prototype does not parse `.pst` directly yet.
3. For now, import the mail into Apple Mail or Thunderbird, then export/scan `.mbox` or `.eml`.

Source: https://support.microsoft.com/en-us/office/export-or-backup-email-contacts-and-calendar-to-an-outlook-pst-file-14252b52-3075-4e9b-be4e-ff9ef1068f91

### Proton Mail

1. Use the Proton Mail Export Tool.
2. Run a backup export to your device.
3. Scan the exported `.eml` folder.

Source: https://proton.me/support/proton-mail-export-tool

### Fastmail

1. Go to Settings > Migration.
2. Open the Export tab.
3. Create a new mail export for the folder/date range you want.
4. Download the finished zip and scan the exported mail files.

Source: https://www.fastmail.help/hc/en-us/articles/360060590573-Download-all-your-data

### Yahoo, AOL, iCloud, and other IMAP mail

1. Add the account to Apple Mail or Thunderbird using IMAP.
2. Wait for the folders you care about to sync locally.
3. Export from that mail client as `.mbox` or scan local `.eml` files.

### Drag the export into your project folder

If you set up Mode B (directory mode), drag your `.mbox` file (or `.eml` folder) from Downloads into the `enuff-is-enuff-unsubscribe-main` folder you set up in step 1. That way you can refer to it by just its filename — no long paths to remember.

## Step 2: Run Scan

**Plugin mode** — run the slash command with the full path:

```text
/enuff-is-enuff-unsubscribe:scan /path/to/mail.mbox
/enuff-is-enuff-unsubscribe:scan /path/to/eml-folder
```

**Directory mode** — if you dragged your export into the project folder (recommended), refer to it by just its filename:

> Scan INBOX.mbox/mbox

Or if it's still elsewhere, give the full path:

> Scan ~/Downloads/INBOX.mbox/mbox

You never type the node command yourself; `CLAUDE.md` tells Claude what to run.

For Apple Mail `.mbox` packages, point at the inner `mbox` file: `INBOX.mbox/mbox`.

The scanner is Node.js-only and uses only the standard library — nothing extra to install once Claude Code is set up.

The scanner writes:

```text
enuff-is-enuff-report/report.html
enuff-is-enuff-report/report-state.json
enuff-is-enuff-report/approved-actions.json
enuff-is-enuff-report/sender-ranking.csv
enuff-is-enuff-report/recommended-actions.md
```

## Step 3: Review In Claude, Confirm In The Browser

Approval happens in Claude — not in the HTML. The flow is:

1. Claude reads `enuff-is-enuff-report/report-state.json` and walks you through brands and streams in chat.
2. You tell Claude which streams to flag (e.g. `Substack:newsletter, Ollama:newsletter`).
3. Claude writes your selections into `enuff-is-enuff-report/approved-actions.json`.
4. Claude re-renders `report.html` so you can see your approved actions highlighted in green.
5. Open the report to confirm visually. Just tell Claude *"open the report"* (Claude knows where it is) or double-click `enuff-is-enuff-report/report.html` in Finder.

The HTML is read-only — there are no checkboxes inside. Use the report to verify what you approved, then come back to Claude to act.

In **plugin mode**, the equivalent is `/enuff-is-enuff-unsubscribe:review` — Claude does the same brand-by-brand walk-through and re-renders the report when you're done. In **directory mode**, just ask Claude to "review" or "show me what to flag" and `CLAUDE.md` routes it through the same `unsubscribe-planning` skill.

## Step 4: Review Choices

The report has:

- Companies
- Safety Blocked

Company view separates streams:

```text
Marketing/promos      unsubscribe
Orders/receipts       keep
Account/security      protected
```

This lets you stop a company's marketing while keeping receipts and security alerts.

## Step 5: Act

In **plugin mode**, run `/enuff-is-enuff-unsubscribe:act`. In **directory mode**, just tell Claude "I'm ready to act" — `CLAUDE.md` routes it through the same `safe-action` skill. Either way, before doing anything Claude asks:

```text
Have you reviewed the report? Are you okay with everything?
```

Before anything happens, Claude shows you the queue — a one-line summary of every approved item — and asks the global gate. **One "yes" then authorizes the entire queue.** Per-item decisions already happened during review (step 4); asking again per URL would just be friction.

**Tooling note:** the act phase works best with **Claude for Chrome** (Anthropic's Chrome extension + MCP) installed — it lets Claude drive your browser to actually click the right toggle and verify it really flipped. Without a browser-control MCP, the act phase falls back to opening pages and telling you what to click manually.

For each approved item, Claude:

1. Looks up the provider in the **Provider Playbook** (Substack, Mailchimp, Beehiiv, ConvertKit, Buttondown, SendGrid, mailto, or unknown — multi-step) and applies the matching recipe — page type, what to click, what DOM state proves completion.
2. Drives Chrome via the browser-control MCP: navigate → find the right control → click via real Chrome events → verify `aria-checked` / page text / URL change.
3. Captures a screenshot for the action log.
4. Announces the result inline (e.g., *"✓ Substack/marketing_promos — Marketing emails toggle off, verified aria-checked=false"*).
5. Logs everything to `enuff-is-enuff-report/action-log.md` with DOM state before/after and screenshot reference.

After the queue is drained, Claude posts an **end-of-act summary**: counts (total / completed / needs-verify / mailto-pending / failed), a per-item table with ✓ / ⚠ / ✗ icons, any items still needing your attention, and a pointer to the full action log. The act phase always closes with this recap — you never have to guess what got done.

The global "yes" authorizes opening unsubscribe URLs and drafting mailto messages — nothing else. Claude never enters credentials, deletes/archives messages, creates filters, or sends mail on your behalf.

## Privacy

The MVP is local-first:

- mailbox exports stay on your computer
- reports are local files
- approvals are local JSON files
- no hosted inbox service is required
