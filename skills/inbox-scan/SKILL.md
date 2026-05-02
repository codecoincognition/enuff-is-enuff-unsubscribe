---
name: inbox-scan
description: Parse exported mailboxes, group recurring senders, classify email streams, and generate a local cleanup report.
---

# Inbox Scan

Use this skill when the user wants to scan Gmail Takeout, Apple Mail, Thunderbird, `.mbox`, or `.eml` exports for recurring email junk.

## Workflow

1. Get an exported mailbox path from the user.
2. Run the local scanner:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/enuff_scan.mjs" scan <path>
```

3. Keep analysis local and metadata-first.
4. Produce `enuff-is-enuff-report/report.html`.
5. Do not take actions during scan.

## Classification

Classify senders and streams into:

- newsletter
- ecommerce promo
- SaaS lifecycle
- social notification
- events/community
- orders/receipts
- account/security
- finance/health/government
- unknown

## Large Export Rule

Never ask Claude to read a whole mailbox. Use the scanner's summary output and representative samples.
