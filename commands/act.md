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
3. Summarize only approved unsubscribe actions (filter `approved === true`).
4. **Per-action gate (mandatory).** Process approved items one at a time. For each item, before doing anything:
   - Show the exact URL or draft email to the user.
   - Classify the URL:
     - **Token / one-click** (`disable_email?token=…`, `unsubscribe?confirm=…`, `optout?id=…`, RFC 8058 List-Unsubscribe-Post URLs, etc.) — provider processes the unsubscribe on the GET request itself. No further user action required after the request completes.
     - **Multi-step / account-scoped** — visiting opens a settings page or asks the user to log in or click a confirm button. Cannot be completed without user UI interaction.
   - Ask for explicit per-action approval for THAT specific item. A blanket "yes proceed" earlier does not authorize subsequent items.
5. **Take the action — don't just point at it.** On per-item yes:
   - **Token / one-click URLs:** Use Node `fetch(url, { method: 'GET', redirect: 'follow' })` to perform the unsubscribe programmatically. Inspect the response: status code 2xx and body containing markers like `unsubscribed`, `disabled`, `removed`, `cancelled`, `no longer`, `you have been`, or `success` indicates completion. If markers are missing or status is non-2xx, fall back to `open <url>` in the user's browser and ask them to verify completion. **Never** stop at "the page is open" for a one-click URL — the contract is to complete the unsubscribe, not just initiate it.
   - **Multi-step URLs:** Run `open <url>` so the user can complete in their browser. Then ask the user to confirm completion (e.g. "did the page show 'unsubscribed' or did you click the confirm button?"). Log their answer.
   - **Mailto unsubscribes:** Draft the email, show it to the user, ask before opening their mail client or sending.
6. Never enter credentials, delete messages, archive messages, create filters, submit account deletion, or submit final unsubscribe confirmations without visible per-action user approval.
7. Append every action (and every refusal) to `enuff-is-enuff-report/action-log.md` with a timestamp, the item id, the URL/email, the user's response, the method used (`fetch` vs `open` vs `mailto`), the response status/body markers (for `fetch`), and the conclusion (`completed`, `started in browser — user to confirm`, `failed`, `refused by user`).
8. **End-of-act summary (mandatory).** Once every approved item has been processed, post a final summary to the user. Include:
   - Total approved items and how many were `completed`, `started in browser`, `failed`, `refused`.
   - A per-item table: company, stream, method, conclusion. Use ✓ / ⚠ / ✗ icons so the user can scan it at a glance.
   - Any items that need user follow-up (multi-step browser flows where the user must confirm completion).
   - Pointer to `enuff-is-enuff-report/action-log.md` for the full log.
   - A "what happens next" line — typically: "the approved-actions queue is now drained; re-run scan for fresh data."

High-risk senders are protected even if accidentally selected. If the approved list contains an item whose stream is `account_security`, `orders_receipts`, or `protected_high_risk` (which should be impossible because those are locked at the planning stage), refuse and warn the user.
