# Supplier Response Workspace v0.5

## Purpose

This slice turns a holder-local supplier candidate list into one consistent response workflow:

```text
holder-confirmed Trade Case requirements
+ fixed supplier due-diligence questions
+ holder-selected supplier candidates
→ unified Supplier Response Request
→ one response template per selected candidate
→ holder imports returned JSON
→ explainable answered / missing / conflict comparison
```

It does not send the request, contact a supplier, create a formal shortlist, rank suppliers, or decide eligibility.

## Local browser objects

### Request

```text
schemaVersion = tradeproof.supplier-response-request.v0.5
state = holder_local_draft
externalSendPerformed = false
contactDisclosurePerformed = false
formalShortlistCreated = false
supplierEligibilityDecided = false
rankingGenerated = false
```

The request contains:

- eight fixed questions covering company identity, manufacturing role, product catalogue, certifications, capacity and lead time, delivery and installation, commercial terms, and sample/quality handling;
- one additional question for every requirement that the holder explicitly confirmed from supplied source text;
- only candidate IDs already selected in `tradeproof.supplier-review.v0.4`.

Unconfirmed requirement candidates are excluded.

### Supplier response

```text
schemaVersion = tradeproof.supplier-response.v0.5
state = supplier_response_draft | holder_imported_unverified
supplierStatementClassification = supplier_submitted_unverified
supplierIdentityVerified = false
evidenceVerified = false
formalSubmissionPerformed = false
eligibilityDecisionCreated = false
```

Evidence is metadata only:

- file name;
- media type;
- optional digest;
- `contentUploaded=false`;
- `evidenceVerified=false`.

The workspace does not upload or parse evidence files.

## Comparison states

For each question and supplier:

- `missing_response`
- `answered_unverified`
- `answered_with_unverified_evidence_metadata`
- `claim_response_conflict`

Candidate-level states:

- `no_response`
- `partial_response_unverified`
- `response_received_unverified`

Counts are operational completeness counts, not a supplier score. The model always emits:

```text
numericScore = null
rank = null
supplierEligibilityDecided = false
formalShortlistCreated = false
```

## Bounded conflict detection

v0.5 has two explainable conflict checks:

1. a supplier response says it cannot provide installation while its public website observation contains an installation claim;
2. a supplier response says it has no certification while its public website observation contains ISO, CE, certificate, or certification claims.

A conflict is a review signal, not proof of deception. Public website observations and imported responses are both unverified.

## Page

`docs/supplier-responses.html`

The page reads the same browser-local objects used by prior slices:

- `tradeproof.trade.case.v0.2`
- `tradeproof.supplier.review.v0.4`
- the public candidate collection bound to TED notice `519243-2026`

It stores:

- `tradeproof.supplier.response.request.v0.5`
- `tradeproof.supplier.responses.v0.5`

The holder can:

- export the unified question pack;
- export one blank response template per selected candidate;
- import one or more returned response JSON files;
- remove an imported response locally;
- inspect answered, missing, conflict, and evidence-metadata states.

## Explicit non-capabilities

v0.5 does not:

- send email or platform messages;
- disclose or scrape contact details;
- verify who completed a response;
- upload certificates, catalogues, quotations, or other evidence;
- verify evidence authenticity;
- calculate a supplier score;
- rank suppliers;
- decide tender eligibility;
- produce a formal shortlist;
- submit an RFQ or quotation;
- create a contract, award, payment, settlement, financing, insurance, logistics, or customs action.
