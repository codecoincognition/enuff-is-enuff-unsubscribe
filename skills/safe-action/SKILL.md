---
name: safe-action
description: Drive a browser-control MCP to actually click unsubscribe controls, verify via DOM state, and enforce the approval gate. Per-provider Playbook included.
---

# Safe Action

Use this skill before any act command executes.

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
- tax / payroll
- password / security alerts
- active work accounts
- receipts needed for warranty/taxes

These are locked at planning time; if any sneak through to the approved queue, refuse them in the act phase and warn the user.

## Approval model: review-time, not act-time

Approval lives in the **review** phase, where the user curated the queue brand-by-brand and explicitly chose which items to flag. The act phase has a single global gate (above) and then processes the entire queue without further per-item asks.

Why no per-item gate:

- The user already opted in per item during review — they don't need to opt in twice.
- Asking again for every URL adds friction that punishes thorough reviewers and trains users to mash "yes" through the whole queue, defeating the protection.
- Showing the queue once before processing (count + per-item summary line) gives the user a final visual pass; if anything looks wrong, they can say no and go re-edit `approved-actions.json`.

## Required tooling: browser-control MCP

The act phase drives Chrome via a browser-control MCP and verifies completion by reading DOM state. Required tools (in priority order):

1. **`mcp__claude-in-chrome__*`** — Anthropic's Claude-in-Chrome extension. Use:
   - `tabs_context_mcp` to see existing tabs (call once at start)
   - `tabs_create_mcp` to open a fresh MCP-controlled tab per session
   - `navigate` to load each unsubscribe URL
   - `find` to locate UI controls by natural-language query
   - `computer` (`left_click` with `ref`, `screenshot` with `save_to_disk`)
   - `javascript_tool` to read DOM state (`aria-checked`, page text, URL) before/after the click
2. **Compatible alternatives** — any browser-control MCP that exposes navigate / click / read-DOM / screenshot. The recipes below are written to be MCP-agnostic.
3. **Fallback (degraded mode)** — if no browser-control MCP is available, fall back to `open <url>`, tell the user explicitly what to click in plain English, and mark every item as `needs your verification` in the final summary. **Never claim verified completion in degraded mode.**

If the user has no browser-control MCP, before starting the act phase ask once:

> *"This act phase works best with the Claude-in-Chrome extension. Without it I can only open pages — you'll click toggles yourself. Continue in degraded mode, or install the extension first?"*

## Verification: DOM state, not response body

After clicking, read the relevant DOM attribute (`aria-checked` on a `[role="switch"]`, page text, URL change, etc.) to confirm the action took. **Body-keyword matching against rendered HTML is forbidden** — providers' SPA shells contain success/failure strings as JS bundles regardless of state, which produces false positives. The earlier "fetch + grep for 'unsubscribed' in body" pattern is deprecated and must not be used.

## Always treat every URL as multi-step until you've read the page

URL shape is unreliable as a predictor of provider behavior. The Lenny's Newsletter incident proved this: a `disable_email?token=…` URL *looked* like a one-click token endpoint but was actually a deep-link to a settings page where you have to manually flip a toggle. The plugin claimed verified completion based on URL pattern + body keywords, and was wrong.

The contract for every approved item:

1. **Navigate first.** Open the URL via the browser-control MCP. Do not pre-classify based on the URL.
2. **Read the actual page.** Use `read_page`, `get_page_text`, and/or `javascript_tool` to see the rendered DOM. Identify what's actually there: toggles? buttons? settings panel? login wall? confirmation banner?
3. **Describe the action you're about to take, in one line, before doing it.** Example: *"This is the Substack settings page; the 'Marketing emails' toggle is currently `aria-checked=true`; I will click it to flip to `false`."*
4. **Execute exactly that action.** Click via `find` ref + `computer left_click`. Take a screenshot.
5. **Verify via DOM state.** Re-read the attribute. Body-keyword matching is forbidden.
6. **If the page state is ambiguous, do not act.** Login walls, unexpected confirmation popups, multiple plausible buttons, anti-bot challenges, partial page load — all mean stop, screenshot, mark `needs your verification`, move on.

The Provider Playbook below is **a reference for what to look for**, not an autopilot. It tells you "Substack settings pages typically have a list of toggles labeled with stream names" — not "click the third toggle without checking." Always read the page first, confirm what you're about to do, then click.

The end-state contract: every approved item ends in either a verified completion (via DOM state), an explicit user-confirmed completion (degraded mode), an explicit user refusal, or a logged failure with a clear reason. Never leave an item in "I opened the page, you go check."

---

## Provider Playbook

Recipes for the providers that show up most in `List-Unsubscribe` headers. Each recipe describes **what you'll typically see** on the rendered page for that provider, and **what to look for** before clicking — the recipes are not auto-execute scripts. Always navigate, read the actual page, confirm what you're about to do, then act. If a hostname has no recipe, treat as unknown — same flow, just no a-priori expectation of what the page will look like.

### Substack (`*.substack.com`, hosted Substack publications)

- **URL pattern**: `/action/disable_email?token=…`
- **Page type**: settings deep-link (NOT one-click). The token authenticates you; the page lists per-stream toggles and you must flip the right ones.
- **Action**: `find` the toggle whose row text starts with `Marketing emails` (for `marketing_promos` stream) or `<publication name>` (for `newsletter` stream), then `computer left_click` with the returned `ref`. Click only the streams the user approved — never bulk-flip.
- **Verify**: re-read with `javascript_tool`: target toggle's `aria-checked` should change from `"true"` → `"false"`.
- **Common pitfall**: synthetic JS click events are dropped by Substack's React switch. Must use real Chrome `left_click` via the `find` ref.

### Mailchimp (`*.list-manage.com`, `*.list-manage1.com`, etc.)

- **URL pattern**: `/unsubscribe?u=…&id=…&e=…&c=…`
- **Page type**: confirmation page with a single "Unsubscribe" button. The GET shows the page; the actual unsubscribe fires when the button is clicked.
- **Action**: `find` "Unsubscribe button", `left_click` it. Wait for the confirmation page.
- **Verify**: post-click URL should redirect to a goodbye/confirmation page (typically `/unsubscribe-success` or contains the word "unsubscribed" in the URL path, NOT just the body).

### Beehiiv (`*.beehiiv.com`)

- **URL pattern**: `/unsubscribe?token=…` or `/p/unsubscribe-confirmed`
- **Page type**: confirmation page with a "Yes, unsubscribe" button. RFC 8058 one-click variant exists too.
- **Action**: navigate; if landing on a confirmation page, `find` "Yes, unsubscribe button" and `left_click`. If the page already shows "You have been unsubscribed" headline, no click needed.
- **Verify**: page text contains "you have been unsubscribed" or URL contains `/unsubscribe-confirmed`. Use `get_page_text`, not raw HTML body — the rendered text is reliable; the bundle text is not.

### ConvertKit (`*.convertkit-mail.com`, `*.kit.com`)

- **URL pattern**: `/subscribers/unsubscribe?…`
- **Page type**: confirmation page asking "Are you sure?" with an "Unsubscribe" button.
- **Action**: `find` "Unsubscribe confirm button", `left_click`.
- **Verify**: post-click URL contains `unsubscribed` or page heading reads "You've been unsubscribed".

### Buttondown (`buttondown.email`, `*.buttondown.email`)

- **URL pattern**: `/unsubscribe/<token>`
- **Page type**: confirmation page with an "Unsubscribe" button.
- **Action**: `find` "Unsubscribe button", `left_click`.
- **Verify**: page heading changes to "You've been unsubscribed".

### SendGrid (`*.sendgrid.net`, links with `?action=unsubscribe`)

- **URL pattern**: varies; commonly `?action=unsubscribe&unsub=<token>`
- **Page type**: depends on the sender's template. Often genuine one-click GET; sometimes a confirmation page.
- **Action**: navigate. If a confirm button is present, `find` and `left_click`. If the page shows a success message immediately, no click needed.
- **Verify**: page text contains "unsubscribed" / "removed from this list".

### Mailto (any `List-Unsubscribe: mailto:…`)

- **URL pattern**: `mailto:unsubscribe@…?subject=…`
- **Page type**: not a webpage — needs the user's mail client.
- **Action**: do **not** drive the browser. Instead, draft the email, run `open "mailto:…"` to open the user's mail client pre-filled, and mark `mailto opened — user to send` in the summary.
- **Verify**: cannot verify; the user has to press send.

### Unknown — multi-step (default for unrecognized hostnames)

- **Page type**: assume settings deep-link or confirmation page; do not assume one-click.
- **Action**: navigate, screenshot the page, then look for an obvious "unsubscribe" button. If one exists, `find` + `left_click`. If the page is clearly a settings UI, abort the auto-action and mark `needs your verification`.
- **Verify**: post-click DOM state vs. pre-click. If indistinguishable, mark `needs your verification`.

---

## Logging contract

Every action goes into `enuff-is-enuff-report/action-log.md` with:

- ISO timestamp
- Item id (`{domain}::{stream}`)
- URL
- Provider recipe used (or `unknown — multi-step`)
- Method (`browser-click` / `browser-confirm-page` / `mailto` / `degraded-open`)
- DOM state before and after (e.g., `aria-checked: true → false`, `URL: …/unsubscribe → …/unsubscribed`)
- Screenshot reference (if captured)
- Conclusion: `completed`, `needs your verification`, `mailto opened — user to send`, `failed: <reason>`

## End-of-Act Summary (mandatory)

After all approved items have been processed, post a final summary:

- Counts: total processed / completed / needs verification / mailto pending / failed.
- Per-item table: company, stream, recipe used, conclusion. Use ✓ / ⚠ / ✗ icons.
- Items still needing user attention.
- Pointer to `enuff-is-enuff-report/action-log.md`.
- "What happens next" line — typically that the approval queue is drained and the user can re-scan for fresh data.

Without this summary the user has no concise view of what got done, even though every detail was logged. Always close the act phase with this recap.
