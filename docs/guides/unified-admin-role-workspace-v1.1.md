# Unified Admin Role Workspace v1.1

## Purpose

This slice changes the visible product frame from a chain of disconnected workflow pages into one object-oriented back-office workspace.

```text
role view
→ first-level business object menu
→ second-level business object page
→ persistent current-case context
→ existing v0.1–v1.0 local owner page
```

The shell does not replace the existing canonical pages or localStorage owners. It loads them inside one same-origin workspace frame and removes their duplicate top navigation only while embedded.

## Primary entry

```text
docs/admin.html
```

## First-level business objects

- Today Work
- Market Opportunities
- Trade Cases
- Suppliers
- Communications
- Evidence
- Verification
- Decisions
- Learning & Intelligence
- System Administration

Each first-level business object owns one or more second-level menu entries. Existing pages remain the implementation owners:

```text
operations.html
document-intake.html
suppliers.html
supplier-responses.html
supplier-outreach.html
inbound-communications.html
supplier-evidence.html
evidence-verification.html
supplier-decisions.html
```

## Role views

The shell includes five role projections:

- buyer / procurement lead;
- supplier collaboration coordinator;
- evidence reviewer;
- external verifier;
- system administrator.

Role switching changes visible menus and displays the corresponding capability level:

- view;
- local edit;
- local export;
- local case decision;
- administration view;
- hidden.

## Permission matrix boundary

The role matrix is a front-end information architecture and interaction model only.

It is not:

- an account system;
- organization membership;
- server authorization;
- database RLS;
- API enforcement;
- production audit enforcement.

A user can still open the underlying static HTML directly. Therefore the UI explicitly labels this as an "演示权限投影" rather than production access control.

## Current-case and owner status

The shell reads, but never replaces, the canonical browser-local owners from v0.2 through v1.0. It shows:

- active Trade Case title, ID and stage;
- whether each workflow owner exists in the current browser;
- missing prerequisites as missing, never as zero or complete;
- browser-local persistence and external-execution boundaries.

## Interaction delivered

- persistent left navigation;
- collapsible business-object groups;
- role switcher;
- role/menu/object permission matrix;
- workflow-owner status dialog;
- current-case context banner;
- mobile navigation drawer;
- iframe refresh and standalone-page fallback;
- integration-status preview for future object planning.

## Fixed non-capabilities

The shell does not add:

- real login, tenant, organization or user accounts;
- production authorization;
- supplier score or ranking;
- formal shortlist or eligibility decision;
- award, order, payment, financing, logistics, customs, insurance or settlement execution;
- email sending or automatic supplier contact;
- connector write-back, registry write or chain submission;
- evidence, identity, verifier or receipt verification claims.
