# Roadmap

`enuff-is-enuff-unsubscribe` is local-first by architecture, not as a phase. There are no plans to add OAuth flows, hosted SaaS components, telemetry, or any feature that requires sending your mail or your account credentials to a remote service. If those constraints don't suit your use case, this is not the tool — and that's fine.

## v0.1 (shipped)

- `.mbox` (Gmail Takeout, Apple Mail, Thunderbird) and `.eml` folder input
- Brand-by-brand conversational review in Claude
- Read-only HTML confirmation report with green-highlighted approvals
- Per-stream approval written to `approved-actions.json`
- One global "yes" at act time; per-URL execution via `fetch()` (one-click) / `open` (multi-step) / `open mailto:` (drafts)
- Hard locks on account/security, orders/receipts, and financial/payroll/healthcare/government senders
- Two install paths: Claude Code plugin marketplace + directory mode via `CLAUDE.md`
- `examples/sample-inbox/` ships with sample fixtures for end-to-end testing (initial set; expanded to 209 fixtures across 55 brands in v0.2)

## v0.2 (shipped — current)

- **Browser-control act phase.** The act phase now drives Chrome via a browser-control MCP (Claude-for-Chrome, gstack `/browse`, or compatible) to actually click the right unsubscribe controls and verify completion by reading DOM state.
- **Provider Playbook.** Per-provider recipes for Substack, Mailchimp, Beehiiv, ConvertKit, Buttondown, SendGrid, and mailto unsubscribes — each describes URL pattern, page type, what to click, and what DOM state proves completion.
- **DOM-state verification, not body-keyword matching.** The earlier `fetch() + grep response body` approach was unreliable (provider SPA shells contain success/failure strings as JS bundles regardless of state). Replaced with `aria-checked` / page-text / URL-change verification.
- **Substack classifier fix.** `/action/disable_email?token=…` URLs are now correctly labeled `multi_step_settings` (deep-link to email-preferences) instead of `open_link` (one-click GET). The Provider Playbook handles the toggle-flip.
- **Degraded mode** for users without any browser-control MCP — falls back to `open <url>` and explicit click instructions, with every item marked "needs your verification."

## v0.3 (planned)

- **Outlook `.pst` support.** Ships a `convert-pst.mjs` helper that shells out to `readpst` (from `libpst`, brew-installable) to convert `.pst` → folder of `.eml`. Keeps the core scanner stdlib-only; only Outlook users need the extra brew install.

## v0.4 (planned)

- **`--dry-run` flag for the act phase.** Walks the entire approved queue and reports what *would* be done — recipe selected, expected DOM verification, items that would need user follow-up — without firing a single click. Useful for previewing a large queue before authorizing it, and for CI / red-team audits.
- **Per-provider recipe expansion.** More recipes for the long-tail providers as users report them.

## Out of scope (will not ship)

- OAuth or any provider authentication. The plugin will never ask for a Gmail/Outlook/Yahoo password or token.
- A hosted version. There is no `enuffisenuff.com`. There never will be.
- Telemetry of any kind.
- Auto-deletion or auto-archival of messages from your live inbox.
- Submitting final confirmation forms ("Yes, cancel my account") on your behalf.

## Maintenance

This is open-source software maintained by [Code Coin Cognition LLC](https://github.com/codecoincognition). Bug reports and PRs are welcome at the [issue tracker](https://github.com/codecoincognition/enuff-is-enuff-unsubscribe/issues). Best-effort response on substantive issues; security-relevant issues take priority.

If you depend on this for production use and need a stronger SLA, please open an issue describing your needs — happy to discuss.
