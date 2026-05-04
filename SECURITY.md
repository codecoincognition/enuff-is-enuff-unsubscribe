# Security & data-handling

A precise, auditable summary of what `enuff-is-enuff-unsubscribe` does — and doesn't — with your data and your network.

## Network

**Scanner: zero outbound network calls.** The scanner (`bin/enuff_scan.mjs`) uses Node.js standard library only. Auditable in one grep:

```bash
$ grep -n "^import" bin/enuff_scan.mjs
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';      # see below — inbound only, opt-in
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
```

`node:http` is imported for one purpose only: the optional `serve` subcommand creates a local web server bound to `127.0.0.1` so you can view the report at `http://127.0.0.1:8765/report.html` instead of `file://`. It is an **inbound listener**, never an outbound client. It is opt-in — only runs when you explicitly invoke `node bin/enuff_scan.mjs serve …`.

There is no `fetch`, no `https`, no `http.request`, no `axios`, no DNS resolution, no telemetry. The repo has zero npm dependencies (`package.json` does not exist).

**Act phase: outbound GETs to unsubscribe URLs only — and only after your approval.** When you confirm the act phase, Claude calls `fetch(url, { method: 'GET' })` against the specific unsubscribe URLs you flagged in your `approved-actions.json`. These requests:

- go only to the providers you authorized (Substack, Mailchimp, etc., per your selection)
- are GET-only (no PUT/POST/DELETE — the plugin contract explicitly forbids destructive verbs)
- are individually logged to `enuff-is-enuff-report/action-log.md` with timestamps, response status, and outcome

If you want to verify before authorizing, the URLs are visible in `approved-actions.json` and in the rendered `report.html` summary panel.

## Credentials

**None requested. None accepted.**

The plugin does not implement OAuth, app passwords, IMAP/SMTP credentials, Gmail API tokens, or any other authentication mechanism. There is no place to enter a password. There is no provider login flow.

You hand over a file (an `.mbox` or `.eml` folder you exported yourself). You do not hand over an account.

## Data flow

```
.mbox or .eml folder        → local Node.js parsing  → enuff-is-enuff-report/
(your file, your machine)     (zero network)            (local files only)
                                                        ├── report-state.json
                                                        ├── approved-actions.json
                                                        ├── report.html
                                                        ├── sender-ranking.csv
                                                        └── action-log.md
```

Nothing leaves your machine. Nothing is sent anywhere. Nothing is uploaded to a cloud service. There is no server.

The scanner reads only message **headers** (`From`, `Subject`, `Date`, `List-Unsubscribe`, `List-ID`, `X-Gmail-Labels`, `Status`, `X-Status`). Message bodies and attachments are never parsed.

The only data that reaches Anthropic is **your conversation with Claude itself** — the same text you'd send in any Claude Code session. Your raw mailbox export, the parsed sender list, and the action log all stay on disk.

## Irreversible actions

Every irreversible action is gated:

1. **Per-stream approval** during the review phase — you explicitly flag each stream (`Substack:newsletter`, etc.) you want acted on. Selections are written to `approved-actions.json` (visible, editable JSON).
2. **Global approval** at the start of the act phase — Claude asks *"Have you reviewed the report? Are you okay with everything?"* and shows you the queue (count + per-item summary) before doing anything.
3. **Hard-locked categories** — account/security, orders/receipts, financial (`bank`, `chase`, `wellsfargo`, `citi`, `capitalone`, `americanexpress`, `amex`, `irs`, `ssa`, `medicare`, `health`, `insurance`, `payroll`) are blocked from the action queue automatically, even if you accidentally select them.

The plugin will never:

- enter credentials anywhere
- delete or archive messages in your live mailbox (it can't — it has no inbox access)
- modify your exported mailbox file
- create Gmail filters automatically
- submit a final confirmation form (e.g., "Yes, cancel my subscription")
- send mail on your behalf (mailto unsubscribes are drafted; you press send)

## Local file footprint

All files written by the workflow live in **one folder**: `enuff-is-enuff-report/` in your current working directory. Delete the folder = delete all state. There is no other persistence: no `~/.enuff-is-enuff/`, no system-level config, no caches.

Recommended `.gitignore` entry (already included in this repo's own `.gitignore`):

```
enuff-is-enuff-report/
```

## Source

All code is open source under the MIT [LICENSE](./LICENSE) and auditable in full at [github.com/codecoincognition/enuff-is-enuff-unsubscribe](https://github.com/codecoincognition/enuff-is-enuff-unsubscribe).

The scanner is **a single ~1000-line Node file** (`bin/enuff_scan.mjs`). You can read it end to end in 15 minutes.

## Reporting a security issue

Open a private security advisory at [github.com/codecoincognition/enuff-is-enuff-unsubscribe/security/advisories/new](https://github.com/codecoincognition/enuff-is-enuff-unsubscribe/security/advisories/new) or email the maintainer at the address listed in the repo profile. Please don't open a public issue for security disclosures.
