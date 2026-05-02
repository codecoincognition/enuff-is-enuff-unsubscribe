# Claude Plugin Spec

## Plugin identity

Slug:

```text
enuff-is-enuff-unsubscribe
```

Display name:

```text
Enuff Is Enuff Unsubscribe
```

Short description:

```text
Find recurring email junk and make it stop with Claude.
```

## plugin.json draft

```json
{
  "name": "enuff-is-enuff-unsubscribe",
  "version": "0.1.0",
  "description": "Find recurring email junk and make it stop with Claude. Scan inbox exports, rank noisy senders, and unsubscribe, filter, or delete with approval.",
  "author": {
    "name": "Code Coin Cognition"
  },
  "homepage": "https://github.com/codecoincognition/enuff-is-enuff-unsubscribe",
  "repository": "https://github.com/codecoincognition/enuff-is-enuff-unsubscribe",
  "keywords": [
    "email",
    "unsubscribe",
    "inbox",
    "gmail",
    "privacy",
    "cleanup"
  ]
}
```

## Commands

### scan

Command:

```text
/enuff-is-enuff-unsubscribe:scan
```

Purpose:

Analyze a user-provided email export and generate the cleanup report.

User prompt:

```text
Scan my email export for recurring senders, newsletter junk, promotional senders, abandoned SaaS drips, and unsubscribe candidates. Generate a local report and do not perform any actions yet.
```

### review

Command:

```text
/enuff-is-enuff-unsubscribe:review
```

Purpose:

Review the report with the user and create an approved action list.

User prompt:

```text
Review my Enuff Is Enuff report. Let me review by bucket or company. Save every checkbox and action choice immediately into the report state and approved action queue.
```

### act

Command:

```text
/enuff-is-enuff-unsubscribe:act
```

Purpose:

Take approved cleanup actions.

Hard gate:

Before any action, Claude must ask:

```text
Have you reviewed the report? Are you okay with everything?
```

Claude must only continue after explicit user confirmation. If the user has not reviewed the report, Claude should send them back to `report.html` or summarize the pending approval queue.

Allowed actions:

- draft unsubscribe emails
- open unsubscribe links for user approval
- generate Gmail filter rules
- generate deletion search queries
- generate account deletion request drafts

Disallowed by default:

- deleting emails without approval
- submitting unsubscribe forms without approval
- entering credentials
- canceling accounts
- removing saved payment methods

## Skills

### inbox-scan

Reads email metadata, identifies recurring senders, extracts unsubscribe headers, and creates structured findings.

### unsubscribe-planning

Turns raw findings into a practical action plan with confidence and risk categories.

### safe-action

Guides Claude through approval-based actions and blocks risky behavior.

## Agents

### inbox-detective

Finds recurring senders and classifies them.

Core questions:

- Who emails the user repeatedly?
- Which senders are likely optional?
- Which senders are connected to accounts, payments, or security?
- Which senders should be handled carefully?

### unsubscribe-operator

Executes low-risk approved actions.

Core tasks:

- locate unsubscribe paths
- draft unsubscribe emails
- generate Gmail searches
- generate filter rules
- maintain action log

### safety-reviewer

Prevents destructive or unsafe behavior.

Core tasks:

- block high-risk unsubscribe recommendations
- flag financial, medical, government, work, and security senders
- require user approval for any external action
- warn about suspicious unsubscribe links

## Report schema

Each sender record should include:

```json
{
  "sender_name": "Example Store",
  "sender_email": "deals@example.com",
  "domain": "example.com",
  "message_count": 42,
  "latest_seen": "2026-05-01",
  "category": "ecommerce_promo",
  "recommended_action": "unsubscribe",
  "confidence": 0.91,
  "risk": "low",
  "unsubscribe_header_found": true,
  "unsubscribe_url_found": true,
  "reason": "High-volume promotional sender with recurring sale language and unsubscribe headers."
}
```

## Approval state schema

The interactive report should persist user choices immediately.

Files:

```text
enuff-is-enuff-report/report-state.json
enuff-is-enuff-report/approved-actions.json
```

Example approved action:

```json
{
  "company": "Nike",
  "domain": "nike.com",
  "stream": "marketing_promos",
  "action": "unsubscribe",
  "approved": true,
  "risk": "low",
  "method": "list_unsubscribe_header",
  "also_delete_old_messages": true,
  "delete_query": "from:(nike.com) older_than:30d",
  "user_reviewed_at": "2026-05-02T00:00:00-04:00"
}
```

Allowed actions:

- keep
- unsubscribe
- unsubscribe_promos_only
- filter_to_label
- archive_future
- delete_old
- draft_unsubscribe_email
- review_manually
- investigate_account_deletion
- protected

The action command must read from `approved-actions.json`, not infer approvals from the raw scan.

## Risk levels

### Low

Safe candidates:

- newsletters
- promo campaigns
- creator emails
- abandoned product updates
- conference promotions

### Medium

Review carefully:

- SaaS account updates
- community notifications
- old work tools
- travel accounts
- ecommerce accounts with order history

### High

Do not auto-action:

- banks
- healthcare
- insurance
- government
- tax/payroll
- password/security alerts
- active employer tools

## HTML report sections

`report.html` should include:

- headline stats
- bucket/company tabs
- checkbox controls
- action dropdowns
- immediately persisted approval queue
- worst senders
- recommended unsubscribe batch
- recommended filter batch
- possible zombie accounts
- high-risk do-not-touch senders
- unsubscribe links found
- draft email section
- Gmail query suggestions
- next actions

Interface tabs:

```text
Overview | Buckets | Companies | Approval Queue | Safety Blocked
```

The approval queue must be visible before execution.

## Example headline stats

```text
412 recurring senders found
137 unsubscribe candidates
51 filter candidates
23 possible zombie accounts
18 high-risk senders blocked from auto-action
```

## Privacy promise

Marketplace copy should be explicit:

> Enuff Is Enuff can run from local inbox exports. Your email does not need to be uploaded to a hosted cleanup service for the MVP workflow.

## Differentiator

Do not position this as:

```text
Bulk unsubscribe from newsletters.
```

Position it as:

```text
Claude-powered inbox offboarding.
```

The plugin should help users break up with senders, not just list them.
