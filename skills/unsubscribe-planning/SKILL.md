---
name: unsubscribe-planning
description: Walk the user company-by-company through unsubscribe candidates in chat, collect their per-brand selections, then generate the read-only HTML report.
---

# Unsubscribe Planning

Use this skill after `scan` has produced `enuff-is-enuff-report/report-state.json`. The HTML report is generated **after** review, never before.

## Required Flow (do not skip)

1. **Read** `enuff-is-enuff-report/report-state.json`.
2. **Filter** to plausible unsubscribe candidates only — streams classified as `marketing_promos`, `newsletter`, `saas_lifecycle`, `social_notification`, or `unknown`. Skip protected streams entirely (`account_security`, `orders_receipts`, `protected_high_risk`); they are locked by the safety rules and should not appear in the prompt.
3. **Present** the candidates to the user as a compact, scannable per-brand table in chat. Group by company; show stream, volume, sample subject, and whether a `List-Unsubscribe` header was found. Cap the visible list at the top ~20 brands by volume; offer to show more if asked.
4. **Call out brands with multiple non-locked streams** (e.g. `Substack: newsletter (5) · marketing_promos (1)`). Stream-level granularity is supported — `approved-actions.json` has one row per `{domain, stream}` pair, each with its own `approved` flag, so the user can flag `Substack newsletter` while keeping `Substack marketing_promos`. Do not collapse multi-stream brands into a single yes/no question.
5. **Ask** the user which brands/streams to flag for unsubscribe. Show a short grammar example so the answer is unambiguous:

   - `Substack:newsletter, Ollama:newsletter` — explicit per-stream
   - `Substack:newsletter+marketing_promos` — multiple streams from one brand
   - `all newsletters` — every `newsletter` stream across all brands
   - `all newsletters except GitHub` — pattern with exclusions
   - `none` — flag nothing, render the report as-is

   Accept free-form variants too. Do not auto-approve.

6. **Write** their selections into `enuff-is-enuff-report/approved-actions.json` directly with the Edit tool — set `"approved": true` on the chosen items, leave the rest `false`. Match by `id` (`{domain}::{stream}`) so per-stream granularity is preserved. `approved-actions.json` is the canonical source of truth for approvals; do not edit `report-state.json`'s `approved_actions` field — the next `review` invocation regenerates it from `approved-actions.json`.
7. **Render** the read-only HTML report only after approvals are saved:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/enuff_scan.mjs" review enuff-is-enuff-report
```

8. **Hand off** to `/enuff-is-enuff-unsubscribe:act` for execution.

## Review Mode

Company-wise review only for the MVP. The HTML report is a confirmation surface, not a selection interface.

## Actions

Allowed choices on each stream:

- keep
- unsubscribe
- draft unsubscribe email
- review manually
- protected

## Product Rule

Do not unsubscribe from a whole company when only marketing/promotional streams should be removed. Preserve receipts, account notices, security alerts, and other transactional streams. Do not delete, archive, filter, or modify the exported mailbox.

## Anti-Patterns (never do these)

- Running `node bin/enuff_scan.mjs review … --approve-candidates` as the default path — that flag is for headless/CI use only.
- Rendering `report.html` before the user has confirmed per-brand selections.
- Asking the user about protected streams (account/security/receipts/high-risk). Those are blocked, not negotiable.
- Treating absence of unsubscribe candidates as "nothing to do" without showing the user the per-brand list — they may still want to flag a `review_manually` brand for a manual unsubscribe draft.
