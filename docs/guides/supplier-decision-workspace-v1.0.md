# Supplier Decision Workspace v1.0

## Purpose

This slice combines the existing holder-controlled Trade Case workflow into one human review surface:

```text
confirmed formal requirements
+ supplier response completeness
+ supplier evidence queue
+ external-verification receipt candidates
+ inbound communication timeline
→ per-requirement supported / missing / contradicted / stale / unverified signals
→ explicit follow-up tasks
→ deterministic next-step suggestion
→ holder-confirmed local case-progression decision
```

It does not score or rank suppliers, create a formal shortlist, decide supplier or tender eligibility, issue an award, or execute an external action.

## Requirement states

Each confirmed formal requirement is represented separately as one of:

- `supported_candidate`: a human-reviewed external receipt candidate supports evidence bound to the requirement;
- `contradicted_candidate`: an external receipt candidate contradicts evidence bound to the requirement;
- `stale`: locally confirmed expiry information indicates the evidence may be out of date;
- `missing`: no substantive supplier answer exists;
- `unverified_evidence_available`: a supplier answer and local evidence exist, but no supported reviewed receipt exists;
- `unverified_response_only`: only the supplier's unverified answer exists.

None of these states is a supplier-eligibility conclusion.

## Explicit deterministic suggestion

The workspace uses visible rules rather than a numerical score:

1. any contradiction → `deeper_verification_required`;
2. otherwise any stale evidence → `deeper_verification_required`;
3. otherwise missing response or requirement data → `pause_pending_information`;
4. otherwise → `continue_contact`.

The system never suggests `exclude_from_current_case`. Exclusion is available only as an explicit holder choice.

Every suggestion is classified as:

```text
deterministic_next_step_suggestion_not_decision
```

## Human candidate decision

The holder may select:

- `continue_contact`;
- `pause_pending_information`;
- `deeper_verification_required`;
- `exclude_from_current_case`.

A reason is mandatory and the exact confirmation phrase is:

```text
CONFIRM SUPPLIER CASE DECISION
```

The saved record remains:

```text
schemaVersion = tradeproof.supplier-decision-record.v1.0
state = holder_local_candidate_decision
decisionClassification = human_case_progression_candidate
```

Even an exclusion is limited to the current local case and is not a platform-level supplier disqualification.

## Fixed boundaries

```text
numericScore = null
rank = null
rankingGenerated = false
formalShortlistCreated = false
supplierEligibilityDecided = false
awardDecisionCreated = false
externalActionPerformed = false
serverPersistencePerformed = false
```

## Page and local owner

Page:

```text
docs/supplier-decisions.html
```

Local storage owner:

```text
tradeproof.supplier.decision.workspace.v1.0
```

The page reads existing local owners from v0.2 through v0.9 and does not replace them.

## Explicit non-capabilities

v1.0 does not:

- generate a composite supplier score;
- rank, recommend a winner, or create a formal shortlist;
- verify supplier identity, evidence, verifier identity, or receipt authenticity;
- automatically exclude a supplier;
- send clarification or follow-up messages;
- make tender eligibility, supplier approval, award, purchase-order, contract, payment, financing, insurance, logistics, customs, or settlement decisions.
