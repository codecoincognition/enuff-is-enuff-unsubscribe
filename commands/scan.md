---
description: Scan an exported mailbox and summarize recurring company-wise unsubscribe candidates.
argument-hint: "[path-to-.mbox-or-.eml-folder] [--recent-days 365] [--top 200]"
---

# Scan Inbox Export

You are running the `enuff-is-enuff-unsubscribe` scan workflow.

1. Ask the user for an exported mailbox path if `$ARGUMENTS` does not include one.
2. Prefer local exports: Gmail Takeout `.mbox`, Apple Mail `.mbox`, Thunderbird `.mbox`, or a folder of `.eml` files.
3. Run the local scanner from this plugin:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/enuff_scan.mjs" scan "$ARGUMENTS"
```

If the argument string includes flags, preserve them.

4. Do not unsubscribe, delete, filter, or open external links during scan.
5. Summarize the scan results: total emails, read/likely read, unread, last 60 days, companies found, unsubscribe candidates, and protected streams.
6. Ask the user to continue into company-wise review.

The scan step ends with a summary and scan state, not a report and not actions.
