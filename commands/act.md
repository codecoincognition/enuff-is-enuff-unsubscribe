---
description: Execute approved unsubscribe actions by driving Chrome via a browser-control MCP, with DOM-state verification.
---

# Act On Approved Unsubscribes

This command is gated. Before doing anything external, ask exactly:

```text
Have you reviewed the report? Are you okay with everything?
```

Continue only after an explicit yes.

## Required tooling

The act phase drives Chrome via a browser-control MCP and verifies completion by reading DOM state (e.g., `aria-checked` on toggle switches). Required tools:

- **Primary**: `mcp__claude-in-chrome__*` (Anthropic's Claude-in-Chrome extension + MCP). Specifically `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `find`, `computer` (for `left_click` and `screenshot`), and `javascript_tool` (for DOM state inspection).
- **Compatible alternative**: any equivalent browser-control MCP that exposes navigate/click/read-DOM/screenshot.
- **Fallback (degraded mode)**: if no browser-control MCP is available, fall back to `open <url>` and tell the user explicitly what to click. Mark every item as `needs your verification` in the summary. Never claim completion in degraded mode.

If the user has no browser-control MCP installed, before proceeding ask once: *"This act phase works best with the Claude-in-Chrome extension (https://claude.com/product/claude-for-chrome). Without it I can only open pages — you'll click toggles yourself. Continue in degraded mode, or install the extension first?"*

## Flow

1. Read `enuff-is-enuff-report/approved-actions.json`.
2. If the file is missing or empty, stop and send the user back to the report.
3. Summarize only approved unsubscribe actions (filter `approved === true`). Show the user the queue (count + per-item one-line summary: company · stream · method) so they have a final visual pass before things start happening.
4. **Single global approval, then process the entire queue.** The user's "yes" to the global gate authorizes processing every approved item in `approved-actions.json`. Do **not** ask for per-item approval — the user already curated the queue brand-by-brand in the review phase. Process items sequentially and announce each completion in plain English as you go.
5. **Always treat every URL as multi-step until you have read the page.** Do not assume from URL shape alone that something is a one-click GET, a confirm-page, or a settings deep-link. URL pattern matching produces false confidence and false positives — the Lenny's Newsletter incident is a lesson burned into this contract.
   - **Step 5a — navigate first.** Use the browser-control MCP to open the URL.
   - **Step 5b — read what's actually on the page.** Use `read_page`, `get_page_text`, and/or `javascript_tool` to inspect the rendered DOM. Identify what controls exist (toggles? buttons? settings panels? confirmation banner?).
   - **Step 5c — describe the action you're about to take, in one line.** *"This is the Substack settings page; the 'Marketing emails' toggle is currently aria-checked=true; I'll click it to flip it off."*
   - **Step 5d — execute that exact action.** Click via the `find` ref + `computer left_click` (real Chrome event, not synthetic JS). Take a screenshot.
   - **Step 5e — verify via DOM state.** Re-read the relevant attribute (`aria-checked`, page text, URL) after the click. Body-keyword matching against rendered HTML is forbidden — providers' SPA shells contain success/failure strings as JS bundles regardless of actual state.
   - **The Provider Playbook** in `skills/safe-action/SKILL.md` is a *reference for what to look for* on each provider's pages — common control labels, common page types, common verification cues. It is **not** an autopilot. Always read the page first; confirm what you're about to do; then click.
6. **If the page state is ambiguous** (login wall, multiple plausible controls, confirmation popups you didn't expect, anti-bot challenge, page didn't load), do not click. Take a screenshot, mark the item as `needs your verification` in the summary, and move on.
7. Never enter credentials, delete messages, archive messages, create filters, submit account deletion, or actively send mail on the user's behalf — the global "yes" authorizes navigating to unsubscribe URLs, clicking unsubscribe-specific UI controls, and drafting mailto messages, not destructive or credentialed operations.
8. Append every action to `enuff-is-enuff-report/action-log.md`:
   - timestamp
   - item id (`{domain}::{stream}`)
   - URL
   - provider recipe used (or `unknown — multi-step`)
   - method (`browser-click` / `browser-confirm-page` / `mailto` / `degraded-open`)
   - DOM state before and after (`aria-checked: true → false`, etc.)
   - screenshot reference (if captured)
   - conclusion (`completed`, `needs your verification`, `mailto opened — user to send`, `failed: <reason>`)
9. **End-of-act summary (mandatory).** Once every approved item has been processed, post a final summary to the user:
   - Counts: total / `completed` / `needs verification` / `mailto pending` / `failed`.
   - Per-item table: company, stream, recipe used, conclusion. Use ✓ / ⚠ / ✗ icons.
   - Items needing user follow-up.
   - Pointer to `enuff-is-enuff-report/action-log.md`.
   - "What happens next" line.

High-risk senders are protected even if accidentally selected. If the approved list contains an item whose stream is `account_security`, `orders_receipts`, or `protected_high_risk` (which should be impossible because those are locked at the planning stage), refuse and warn the user.
