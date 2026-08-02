# RWP Pool Adoption Case Study v0.1

Status: Non-normative synthetic acceptance pack

## 1. Purpose

This case study demonstrates the already-defined Pool Adoption and Proof Liquidity loop without creating another protocol owner.

```text
synthetic source RWP
→ source Case Graph
→ Proof Pattern
→ public Trade Pool
→ independent synthetic adopter RWP
→ graph-only partial result
→ full-artifact verified adoption
→ duplicate-resistant Proof Liquidity Snapshot
→ open Pool Directory
```

The pack is a reproducible fixture and public explanation layer. It is not a new attestation, settlement, reputation, identity, payment, RWA or Token object.

## 2. Reused canonical owners

| Concern | Existing owner reused |
| --- | --- |
| Claims, evidence, provenance and confirmations | Trade Proof Passport / RWP Core |
| Recipient workflow | RWP Request and Request Response |
| Authorized evidence transfer | Evidence Package |
| Recipient-side digest matching | Evidence Receipt |
| Workflow lineage | RWP Case Graph |
| Reusable rules | RWP Proof Pattern and Trade Pool |
| Adoption decision | Pool Adoption Receipt |
| Public adoption projection | Pool Adoption Card |
| Duplicate-resistant aggregation | Proof Liquidity Snapshot and Snapshot Card |
| Open discovery | Pool Directory and Directory Card |

No new table, RPC, database, registry, identity service, Attestation owner or Settlement owner is introduced.

## 3. Fixed synthetic scenario

The source workflow uses the repository's synthetic steel-cabinet Passport and produces a Pool requiring:

```text
roles = buyer + exporter
evidence categories = inspection_report + purchase_order
status gate = evidence_received
```

The adopter uses a different Passport root and independently completes the same bounded workflow.

```text
source Passport digest != adopter Passport digest
```

The source case cannot count as its own adopter.

## 4. Two observability results

### Graph-only

The adopter Graph satisfies the structural workflow and state gate, but role and matched-evidence requirements remain unobservable.

```text
adoptionStatus = partial_adoption
proofLiquidityEligible = false
```

### Full artifact bundle

The same Graph is rebuilt from the independent adopter's synthetic Passport, Proof Card, Request, Response, Evidence Package and matched Evidence Receipt.

```text
adoptionStatus = verified_adoption
proofLiquidityEligible = true
notSatisfied = 0
notObservable = 0
```

## 5. Duplicate-resistant aggregation

The verified public Adoption Card is submitted twice to the Snapshot builder.

Expected deterministic result:

```text
submittedCards = 2
uniqueCards = 1
verifiedAdoptionUnits = 1
excludedDuplicates = 1
duplicate dimensions = card + receipt + graph + passport
```

The second submission remains visible as excluded and contributes zero units.

## 6. Open discovery result

The complete Pool and its matching public Liquidity Card are placed into one open Directory.

Expected result:

```text
entryCount = 1
verifiedAdoptionUnits = 1
entriesAreEndorsements = false
rankingProvided = false
```

Directory inclusion does not make the Pool official, compliant or superior.

## 7. Attention and fork boundary

The case-study summary fixes:

```text
viewsCounted = 0
emptyForksCounted = 0
```

A page view, copied link, social post, wallet connection, empty Pool fork or duplicate card never becomes Proof Liquidity.

## 8. Privacy and publication

The public page displays only bounded labels, aggregate results and canonical digests.

The downloadable complete acceptance pack includes the repository's synthetic private-style fixture fields so that the full Graph and Receipt can be recomputed. It must never be treated as a safe publication template for real commercial files.

For a real adoption:

- complete RWP artifacts remain holder-controlled;
- the full Adoption Receipt remains a local or explicitly shared object;
- only privacy-bounded Cards and aggregate Cards are intended for public URLs.

## 9. Fixed boundaries

```text
no central database
no ranking or reputation score
no automatic identity authentication
no attestation authority
no payment or settlement
no RWA or Token claim
no chain write
```

The case study does not prove legal compliance, organization identity, authority, credit quality, financial liquidity, market depth or absolute real-world truth.

## 10. Public CI and reproduction

This repository is public. Validation runs in its own public GitHub Actions workflow, not in a private-repository CI carrier.

```bash
node tools/verify-rwp-pool-adoption-case-study.mjs
node tools/validate-rwp-case-study-page.mjs
```

The verifier writes the complete deterministic pack to:

```text
/tmp/rwp-pool-adoption-case-study.json
```

The same input and code must reproduce the same constituent Graph, Pool, Receipt, Card, Snapshot and Directory digests.
