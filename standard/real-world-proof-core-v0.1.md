# Real-World Proof Core v0.1

Status: community draft.

## Category declaration

Before Real-World Assets, there must be Real-World Proof.

RWA represents an asset or right. RWP records how a real-world claim was formed, what evidence supports it, where each claim came from, which responsible roles confirmed or disputed it, which version is current, and what may be disclosed.

TradeProof begins with global trade because trade naturally combines multiple organizations, documents, systems, responsibilities, jurisdictions and long-lived state changes. The Trade Proof Passport is the first domain-specific carrier of RWP Core.

## RWP Core

An RWP is not an assertion of absolute truth and is not merely a file hash. It is a portable, auditable relationship between:

```text
Claim
+ Evidence
+ Provenance
+ Confirmation
+ State
+ Disclosure
+ Digest
+ History
```

RWP proves who or what asserted a claim, which exact records were cited, where the claim was extracted from, which roles responded, and how the object changed over time. It does not automatically prove legal authority, organizational identity, regulatory approval, title, ownership or the objective truth of an off-chain event.

## Core invariants

1. No evidence-backed claim without an evidence reference.
2. No provenance record without a claim and evidence reference.
3. No role confirmation without an explicit decision, time and addressed claim version.
4. Private source material must not be copied into a public projection by default.
5. Supersession and revocation must preserve history.
6. An Agent may extract and reconcile candidate claims but cannot become the source of a real-world fact merely by generating text.
7. DAO governance and Token balances cannot change whether evidence exists or whether a real-world event occurred.
8. Every public proof card must identify itself as a privacy-bounded projection rather than the complete RWP.
9. The complete RWP digest and an evidence-file digest are different objects.
10. RWP must remain usable without holding TPROOF.

## Provenance model

The optional `provenance` array in Trade Proof Passport v0.1 adds field-level source records without breaking existing Passport objects.

Each record contains:

```text
provenanceId
factId
evidenceId
locator
extraction
review
```

A locator may identify a page, field name, spreadsheet cell, JSON Pointer or system event ID. At least one locator field is required.

Extraction methods are:

```text
manual
document_parser
system_event
agent_assisted
```

`agent_assisted` means an Agent proposed the mapping. It does not mean the Agent independently verified the real-world fact.

A review record identifies the responsible reviewer and review time. A Passport may contain unreviewed candidate provenance, but a public projection must not label such a claim as reviewed.

## Trade-domain carrier

Trade Proof Passport remains the canonical trade-domain carrier. Existing fields map to RWP Core as follows:

| RWP Core | Trade Proof Passport |
| --- | --- |
| Claim | `facts[]` |
| Evidence | `evidence[]` |
| Provenance | `provenance[]` |
| Confirmation | `confirmations[]` |
| State | fact status + `lifecycle` |
| Disclosure | evidence and Passport `disclosure` |
| Digest | JCS-compatible canonical JSON + Keccak-256 |
| History | versions, supersession and Registry state |

## Viral Proof Card

A Viral Proof Card is a public projection generated locally from a complete Passport. It may disclose only:

```text
card format and version
Passport digest
public case label chosen by the holder
lifecycle status
claim counts by state
public evidence count
provenance coverage count
confirmation count
confirmed role categories
updated time
assurance boundary
```

It must exclude:

```text
organization and personal names
party identifiers
source-document contents
evidence URIs
evidence digests
commercial prices and bank details
private fact statements
confirmation notes
wallet-to-legal-entity claims
```

The share link contains only the bounded card projection. The complete Passport remains on the holder's device or chosen storage.

The viral loop is useful rather than impression-based:

```text
holder generates a Proof Card
→ recipient inspects the bounded proof state
→ recipient opens or requests the underlying authorized package
→ recipient confirms, disputes or reuses the proof pattern
→ a distinct real workflow creates another RWP
```

Page views, wallet connections, empty social posts, copied cards and self-responses are not proof contributions.

## Agent role

Agents may:

- extract candidate fields from local files;
- propose provenance locators;
- compare values across records;
- identify missing or conflicting claims;
- compile a Passport and public projection;
- route review tasks to responsible roles.

Agents must not:

- invent evidence;
- silently choose between conflicting source values;
- expose private source content in a public card;
- represent themselves as an authorized trade party;
- convert a prediction into a confirmed fact;
- use Token or DAO state as evidence.

## DAO role

The DAO may govern public infrastructure such as schemas, canonicalization profiles, Trade Pools, Hooks, connectors, grants, contribution rules and Treasury policy.

The DAO cannot vote a shipment, inspection, invoice, acceptance, warehouse event or legal right into existence.

```text
DAO governance != real-world truth
Token balance != evidence validity
```

## RWA boundary

RWP is upstream of RWA:

```text
real-world event
→ RWP claim, evidence, provenance and confirmation
→ established right or asset candidate
→ optional RWA projection
→ optional finance, insurance or capital workflow
```

TradeProof does not claim that every RWP forms an asset, that every asset is legally valid, or that every asset may be tokenized.

## Permanent public promise

```text
Your trade data stays with you.
Share proofs, not secrets.
```

The protocol is open source. Its scarcity comes from verified participation, real counterparty confirmation, accepted proof patterns, durable provenance histories and useful integrations—not from closed code or manufactured social activity.
