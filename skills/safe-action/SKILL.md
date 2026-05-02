---
name: safe-action
description: Enforce approval gates and prevent unsafe unsubscribe or credential actions.
---

# Safe Action

Use this skill before any action command executes.

## Hard Gate

Ask exactly:

```text
Have you reviewed the report? Are you okay with everything?
```

Do not proceed without explicit confirmation.

## Never Auto-Action

Never automatically unsubscribe:

- banks
- healthcare
- insurance
- government
- tax/payroll
- password/security alerts
- active work accounts
- receipts needed for warranty/taxes

## Browser Actions

When opening unsubscribe pages:

1. Tell the user what site is opening, including the full URL.
2. Note whether opening the URL is itself the final confirmation. Many newsletter platforms (Substack, Beehiiv, Mailchimp, Buttondown, ConvertKit) issue token-bearing one-click unsubscribe URLs that complete the unsubscribe on visit, with no confirmation page. Treat these as irreversible-on-click and ask before opening.
3. Let the user log in themselves if needed.
4. Stop before final confirmation on any provider that does have a confirmation page.
5. Ask before every irreversible click — including the initial URL open when the URL itself is the confirmation.
6. Log the result.

## Approval model: review-time, not act-time

Approval lives in the **review** phase, where the user curated the queue brand-by-brand and explicitly chose which items to flag. The **act** phase has a single global gate ("Have you reviewed the report? Are you okay with everything?") and then processes the entire queue without further per-item asks.

Why no per-item gate:

- The user already opted in per item during review — they don't need to opt in twice.
- Asking again for every URL adds friction that punishes thorough reviewers and trains users to mash "yes" through the whole queue, defeating the protection.
- Showing the queue once before processing (count + per-item summary line) gives the user a final visual pass; if anything looks wrong, they can say no and go re-edit `approved-actions.json`.

What you must still do:

1. **Show the queue** before starting. Format: count of approved items + a one-line per-item summary (company · stream · method).
2. **Wait for the global yes.** No "yes" → no act phase.
3. **Announce each completion in plain English** as you process — the user should be able to follow along (e.g. *"✓ Substack/marketing_promos — unsubscribed via token URL"*).
4. **Log every action** to `action-log.md`.
5. **Post the end-of-act summary** at the end (counts, per-item table with ✓ / ⚠ / ✗, items needing user follow-up).

Items that intrinsically require the user to do something in their browser (multi-step pages, mailto drafts) are processed by `open`-ing them — they don't ask the user mid-queue, they get noted as "needs user follow-up" in the final summary.

## Take The Action — Don't Just Point At It

The user approved an unsubscribe expecting it to happen. Opening a page and saying "verify in the browser" is incomplete work for one-click URLs.

For **token / one-click URLs** (most `List-Unsubscribe` headers from Substack, Mailchimp, Beehiiv, ConvertKit, Buttondown, SendGrid, Iterable, etc.) the provider processes the unsubscribe on GET. Use Node `fetch(url, { method: 'GET', redirect: 'follow' })` to actually perform it programmatically. Check status (2xx) and look for body markers (`unsubscribed`, `disabled`, `removed`, `cancelled`, `you have been`, `no longer`, `success`). Report the verified outcome to the user.

For **multi-step or account-scoped URLs** that require user interaction (login, click "confirm"), use `open <url>` to launch the browser and then ask the user to confirm completion. Log their answer.

The contract is: every approved item ends in either a verified completion, an explicit user-confirmed completion, an explicit user refusal, or a logged failure with a clear reason. Never leave an item in "I opened the page, you go check."

## End-of-Act Summary (mandatory)

After all approved items have been processed, post a final summary to the user. The summary must include:

- Counts: total processed / completed / started-in-browser / failed / refused.
- A per-item table with company, stream, method (`fetch`/`open`/`mailto`), and conclusion. Use ✓ / ⚠ / ✗ icons so it scans quickly.
- An explicit list of any items that still need the user's attention (e.g., multi-step browser flows where the user must confirm completion).
- A pointer to `enuff-is-enuff-report/action-log.md` for the full structured log.
- A "what happens next" line — typically that the approval queue is drained and the user can re-scan for fresh data.

Without this summary the user has no concise view of what got done, even though every detail was logged. Always close the act phase with this recap.
