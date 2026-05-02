---
description: Execute only approved unsubscribe actions after explicit user confirmation.
---

# Act On Approved Unsubscribes

This command is gated. Before doing anything external, ask exactly:

```text
Have you reviewed the report? Are you okay with everything?
```

Continue only after an explicit yes.

Then:

1. Read `enuff-is-enuff-report/approved-actions.json`.
2. If the file is missing or empty, stop and send the user back to the report.
3. Summarize only approved unsubscribe actions (filter `approved === true`). Show the user the queue (count + per-item one-line summary: company · stream · method) so they have a final visual pass before things start happening.
4. **Single approval, then process the entire queue.** The user's "yes" to the global gate above authorizes processing every approved item in `approved-actions.json`. Do **not** ask for per-item approval — the user already curated the queue brand-by-brand in the review phase; asking again is redundant friction. Process items sequentially and announce each completion in plain English as you go (e.g. *"✓ Substack/marketing_promos — unsubscribed via token URL (200 OK, success markers found)"*).
5. **Take the action — don't just point at it.** For each approved item:
   - First classify the URL:
     - **Token / one-click** (`disable_email?token=…`, `unsubscribe?confirm=…`, `optout?id=…`, RFC 8058 List-Unsubscribe-Post URLs, etc.) — provider processes the unsubscribe on the GET request itself.
     - **Multi-step / account-scoped** — visiting opens a settings page or requires login/click-to-confirm. Cannot be completed without user UI interaction.
   - **Token / one-click URLs:** Use Node `fetch(url, { method: 'GET', redirect: 'follow' })` to perform the unsubscribe programmatically. Inspect the response: status code 2xx and body containing markers like `unsubscribed`, `disabled`, `removed`, `cancelled`, `no longer`, `you have been`, or `success` indicates completion. If markers are missing or status is non-2xx, fall back to `open <url>` in the user's browser and note the item as needing user verification in the final summary.
   - **Multi-step URLs:** Run `open <url>` so the user can complete in their browser. Note the item as needing user verification in the final summary; do not block the queue waiting for the user to confirm — they can review the summary at the end.
   - **Mailto unsubscribes:** Draft the email and run `open "mailto:…"` so it opens in their mail client pre-filled. Note the item as needing user send-confirmation in the final summary.
6. Never enter credentials, delete messages, archive messages, create filters, submit account deletion, or actively send mail on the user's behalf — the global "yes" authorizes opening unsubscribe URLs and drafting mailto messages, not destructive or credentialed operations.
7. Append every action to `enuff-is-enuff-report/action-log.md` with a timestamp, the item id, the URL/email, the method used (`fetch` vs `open` vs `mailto`), the response status/body markers (for `fetch`), and the conclusion (`completed`, `started in browser — user to verify`, `mailto opened — user to send`, `failed`).
8. **End-of-act summary (mandatory).** Once every approved item has been processed, post a final summary to the user. Include:
   - Total approved items and how many were `completed`, `started in browser — user to verify`, `mailto opened — user to send`, `failed`.
   - A per-item table: company, stream, method, conclusion. Use ✓ / ⚠ / ✗ icons so the user can scan it at a glance.
   - Any items that need user follow-up (multi-step browser flows, mailto sends).
   - Pointer to `enuff-is-enuff-report/action-log.md` for the full log.
   - A "what happens next" line — typically: "the approved-actions queue is now drained; re-run scan for fresh data."

High-risk senders are protected even if accidentally selected. If the approved list contains an item whose stream is `account_security`, `orders_receipts`, or `protected_high_risk` (which should be impossible because those are locked at the planning stage), refuse and warn the user.
