# Supplier Candidate Workspace v0.4

## Purpose

Turn confirmed Trade Case requirements into an explainable supplier discovery and comparison workspace without creating a marketplace ranking, verified supplier badge or tender eligibility decision.

```text
public procurement Opportunity
→ holder-controlled Trade Case
→ holder confirms source requirements
→ observe candidate suppliers from public company websites
→ preserve each public claim and source URL
→ compare claims against confirmed requirements
→ expose evidence gaps and review questions
→ holder saves a local candidate list
```

## First bounded market

The initial candidate collection is tied to:

- TED notice `519243-2026`;
- CPV `39100000` furniture;
- hospital furniture as the broad source scope;
- five China-based candidate manufacturers observed from their public websites.

The candidate collection is not a comprehensive market map.

## Evidence classification

Every supplier statement is recorded as:

```text
evidenceClassification = public_self_asserted
verified = false
state = observed_unclaimed
```

This means only that the statement was observed on the named public website. It does not establish:

- legal identity;
- factory ownership;
- current production capacity;
- certification validity or product scope;
- export history;
- tender eligibility;
- ability to deliver, install or provide local service;
- buyer approval;
- TradeProof endorsement.

## Requirement projection

The workspace separates two inputs:

1. **source opportunity scope** — title, CPV and product-family context from the public Opportunity;
2. **confirmed formal requirements** — only Trade Case candidates explicitly confirmed by the holder as appearing in the supplied official source.

When there are no confirmed requirements, the workspace can show only `scope_candidate_only`. It must not imply qualification or suitability.

## Explainable comparison states

The workspace uses qualitative states rather than scores:

- `scope_candidate_only` — public product range appears related, but no confirmed requirements are available;
- `scope_mismatch` — no public product-scope overlap was observed;
- `potential_candidate_with_gaps` — product scope appears related and one or more confirmed requirements lack supporting material;
- `public_claim_overlap_requires_verification` — public claims appear to address the confirmed requirement categories, but all claims still require verification;
- `public_claim_only` — a specific requirement is touched by a public self-assertion only;
- `evidence_gap` — no bounded supporting statement was observed;
- `not_supplier_capability_criterion` — deadlines or communication actions are not supplier capability evidence.

No numeric score, rank or automatic shortlist is generated.

## Local candidate review

The holder may select candidates into a browser-local review object:

```text
schemaVersion = tradeproof.supplier-review.v0.4
state = holder_local_draft
formalWritePerformed = false
externalContactPerformed = false
supplierEligibilityDecided = false
```

Selection does not contact the company, disclose personal details, send an RFQ or create a formal buyer-facing shortlist.

## Contact boundary

The initial collection contains company names, regions, product claims and official public website links. It intentionally excludes scraped email addresses, phone numbers, WhatsApp, WeChat and named sales contacts.

## Ordering boundary

Candidates remain in source observation order:

```text
orderingPolicy = source_observation_order_no_ranking
rankingGenerated = false
```

The order is not a recommendation.

## Prohibited actions

This slice does not:

- verify a supplier;
- decide China or foreign supplier eligibility;
- contact suppliers;
- send RFQs, quotations or messages;
- expose personal contact details;
- scrape authenticated or restricted systems;
- create a contract, purchase order or award;
- initiate payment, settlement, financing, insurance or customs action;
- write to a server-side supplier registry.

## Next owners

1. holder-authorized public supplier discovery connectors;
2. company claim and correction flow;
3. structured supplier response request;
4. evidence upload and certificate verification;
5. product/requirement comparison with explicit source mapping;
6. buyer-reviewed shortlist and reasoned exclusions;
7. email connector and controlled outreach;
8. relationship workspace and response history.
