---
description: Review company-wise unsubscribe candidates in Claude and generate the read-only report.
---

# Review Company Candidates

Review the scan state with the user in Claude. The HTML report is not the selection interface.

Required behavior:

1. **Always conduct the review conversationally with the user, brand by brand.** Read `enuff-is-enuff-report/report-state.json` and walk the user through each company that has a plausible unsubscribe target. Ask which streams to mark for unsubscribe. Do not auto-approve. Do not skip ahead to rendering the report.
2. Review company-wise only for the MVP.
3. Group plausible unsubscribe targets (streams classified as `marketing_promos`, `newsletter`, or `unknown` with `List-Unsubscribe` metadata). Skip protected streams entirely — they are locked.
4. After the user has decided per brand, write their selections to `enuff-is-enuff-report/approved-actions.json` (set `"approved": true` on the chosen items). Do this directly via the Edit/Write tool — no interactive CLI prompt required.
5. Do not delete, archive, filter, or modify the exported mailbox.
6. Once approvals are saved, render the read-only HTML report:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/enuff_scan.mjs" review enuff-is-enuff-report
```

The CLI's `--approve-candidates` flag and `--line-mode` prompt are fallbacks for headless use only. The default flow is conversational review in Claude.

After the report is generated, tell the user to review it and then run:

```text
/enuff-is-enuff-unsubscribe:act
```
