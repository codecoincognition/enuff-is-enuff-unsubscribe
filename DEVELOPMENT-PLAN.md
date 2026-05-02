# Development Plan

## Goal

Build `enuff-is-enuff-unsubscribe` as a Claude plugin that turns inbox cleanup into a guided, approval-based workflow.

The plugin should feel like a consumer painkiller, not an enterprise email analytics dashboard.

## Phase 1: Spec and local prototype

### Scope

Build a local-only analyzer that accepts an `.mbox` file or exported email metadata.

### Features

- parse email sender, subject, date, headers, and unsubscribe fields
- group emails by sender domain and sender address
- detect recurring senders
- identify list-unsubscribe headers
- classify sender type
- rank senders by volume and recency
- generate a static report

### Output

```text
enuff-is-enuff-report/
  report.html
  report-state.json
  sender-ranking.csv
  recommended-actions.md
  approved-actions.json
  unsubscribe-links.csv
```

### Acceptance test

Given a sample `.mbox`, the tool should produce a ranked list of recurring senders with recommended actions:

- unsubscribe
- filter
- delete old emails
- keep
- investigate
- possible account deletion

## Phase 2: Claude plugin wrapper

### Scope

Package the workflow as a Claude plugin with commands and skills.

### Plugin structure

```text
enuff-is-enuff-unsubscribe/
  .claude-plugin/
    plugin.json
  commands/
    scan.md
    review.md
    act.md
  skills/
    inbox-scan/
      SKILL.md
    unsubscribe-planning/
      SKILL.md
    safe-action/
      SKILL.md
  agents/
    inbox-detective.md
    unsubscribe-operator.md
    safety-reviewer.md
  bin/
    enuff-scan
    enuff-render
```

### Commands

```text
/enuff-is-enuff-unsubscribe:scan
```

Analyze email input and generate the report.

```text
/enuff-is-enuff-unsubscribe:review
```

Open or summarize the HTML report and let the user choose what to keep, remove, filter, or investigate. The report itself should provide checkbox and dropdown controls for bucket-level and company-level decisions. Every selection should be saved immediately so the user can stop and resume review.

```text
/enuff-is-enuff-unsubscribe:act
```

Execute approved actions from `approved-actions.json`: open unsubscribe pages, draft emails, write filter rules, or prepare deletion requests.

Before taking any action, Claude must ask:

```text
Have you reviewed the report? Are you okay with everything?
```

If the answer is not an explicit yes, Claude must not execute actions.

## Durable report approval workflow

The HTML report is the primary approval surface.

Requirements:

- all checkbox and dropdown selections persist immediately
- selected actions are mirrored into `approved-actions.json`
- report state is mirrored into `report-state.json`
- users can review by bucket or by company
- users can choose stream-specific actions inside a company
- action execution is blocked until the user confirms they reviewed the report

Company-level stream examples:

```text
Amazon
  [x] Marketing/promos      Action: Unsubscribe
  [ ] Orders/receipts       Action: Keep
  [ ] Account/security      Action: Protected
```

Bucket-level examples:

```text
Unread Retail Promos
  [x] Apply to bucket
  Action: Unsubscribe promos only
  Also: Delete old promos older than 30 days
```

Allowed saved action choices:

- keep
- unsubscribe
- unsubscribe promos only
- filter to label
- archive future emails
- delete old emails
- draft unsubscribe email
- review manually
- investigate account deletion
- protected

## Phase 3: Browser-assisted unsubscribe

### Scope

Use Claude browser tools where available to help with unsubscribe flows.

### Behavior

- prefer safe unsubscribe headers when available
- open unsubscribe pages only after user approval
- avoid suspicious domains
- stop before final confirmation on ambiguous pages
- capture action notes in a local log

### Output

```text
enuff-is-enuff-report/action-log.md
```

The log should record:

- sender
- action attempted
- result
- next step
- whether user approval was required

## Phase 4: Gmail-specific helper

### Scope

Add optional Gmail-focused workflows without making Gmail OAuth mandatory.

### Features

- Gmail search query suggestions
- Gmail filter rule drafts
- label/archive/delete instructions
- import from Google Takeout `.mbox`

Possible future integration:

- Gmail connector support if Claude plugin/tooling allows safe read/write actions

## Phase 5: Marketplace polish

### Scope

Prepare for Claude marketplace submission.

### Required assets

- clear README
- privacy explanation
- demo video
- example report screenshots
- sample data fixture
- install instructions
- safety policy
- limitations section

### Marketplace pitch

> Enuff Is Enuff Unsubscribe finds recurring email junk and helps Claude make it stop. Scan your inbox export, rank the worst senders, and unsubscribe, filter, or delete with approval.

## Technical architecture

### Parser

Responsible for:

- reading `.mbox`
- extracting metadata
- extracting `List-Unsubscribe` and `List-Unsubscribe-Post`
- normalizing sender domains
- preserving minimal useful evidence

### Classifier

Responsible for:

- sender category
- action recommendation
- confidence score
- safety flags

Suggested categories:

- newsletter
- ecommerce promo
- SaaS lifecycle
- account/security
- receipt/order
- social notification
- event/community
- unknown

### Renderer

Responsible for:

- static HTML report
- CSV exports
- Markdown action plan
- draft email files

### Claude layer

Responsible for:

- explaining recommendations
- asking for approval
- deciding when a sender is risky
- drafting unsubscribe messages
- guiding browser flows

## Safety rules

Never auto-click final unsubscribe or deletion actions without explicit user approval.

Never recommend unsubscribing from:

- banks
- government services
- healthcare services
- password/security alerts
- tax/payroll systems
- active work accounts
- receipts needed for warranty/taxes

Do not click body unsubscribe links from suspicious spam. Prefer header-based unsubscribe fields or filters.

Do not delete emails by default. Generate deletion candidates and wait for approval.

## MVP implementation path

1. Build `enuff-scan` local parser.
2. Build `report.html` renderer.
3. Create sample fixture and expected output.
4. Add Claude commands.
5. Add safety agent instructions.
6. Test on exported sample inbox data.
7. Record a short demo.
8. Submit to Claude plugin marketplace.

## Viral demo script

1. Open a messy inbox export.
2. Run:

```text
/enuff-is-enuff-unsubscribe:scan
```

3. Show report:

```text
412 recurring senders found
137 recommended unsubscribe
51 recommended filter
23 possible zombie accounts
18 risky senders requiring review
```

4. Run:

```text
/enuff-is-enuff-unsubscribe:review
```

5. Approve a batch of low-risk newsletter unsubscribes.
6. Show action plan and drafts.
7. End with:

> Your inbox had a supply chain of noise. Claude found it.
