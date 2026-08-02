# Real-World Proof Case Graph v0.1

## Status

Open draft for deterministic, holder-controlled TradeProof clients.

## Purpose

The RWP Case Graph projects a set of already validated RWP artifacts into an append-only relationship graph.

It answers:

- which Passport root all objects belong to;
- which Proof Card projected that Passport;
- which Requests were created from the Card;
- which Responses answered each Request;
- which Evidence Packages were authorized by each Response;
- which Receipts recorded delivery checks;
- which Resolution Packages addressed prior problems;
- which Resolution Receipts recorded the later verification result;
- which state is current without deleting earlier states.

The graph is not another source of truth. It is a deterministic projection of source-bound objects.

## Core rule

```text
artifact validity
+ source digest equality
+ identifier equality
+ chronological ordering
= graph edge
```

A graph builder must not infer an edge merely because two artifacts look similar.

## Supported nodes

```text
passport
proof_card
request
request_response
evidence_package
evidence_receipt
evidence_resolution
evidence_resolution_receipt
```

A v0.1 graph has exactly one Passport root and one Proof Card projection. It may branch into multiple Requests, Responses, Packages, Receipts and Resolutions.

## Supported edges

```text
passport projects_to proof_card
proof_card requests_from request
request responds_to request_response
request_response packages_for evidence_package
evidence_package receives evidence_receipt
evidence_package resolves_package evidence_resolution
evidence_receipt resolves_receipt evidence_resolution
evidence_resolution verifies_resolution evidence_resolution_receipt
```

Every edge endpoint must exist in the same graph.

## Root isolation

Every artifact must resolve to the same canonical Passport digest.

```text
one graph
= one Passport root digest
```

A Request, Response, Package, Receipt or Resolution from a different Passport cannot be inserted, even when roles, dates or evidence categories appear similar.

## Validation before projection

Before graph construction, each object must pass its own canonical validator:

```text
Proof Card validator
RWP Request validator
Request Response validator
Evidence Package validator
Evidence Receipt validator
Evidence Resolution validator
Resolution Receipt validator
```

The Passport digest is recomputed locally from canonical JSON.

## Chronology

For every graph edge:

```text
child.at >= parent.at
```

A child object that predates its declared parent is rejected rather than silently reordered.

Equal timestamps are permitted because several deterministic projections may be generated during the same recorded instant.

## Append-only history

The graph does not collapse an earlier failure into a later success.

Example:

```text
Evidence Receipt: mismatch
→ Evidence Resolution: combined
→ Resolution Receipt: resolved
```

All three events remain visible.

`resolved` means a later Resolution Receipt satisfied its deterministic conditions. It does not rewrite the earlier mismatch as though it never occurred.

## Node projection

A graph node contains only:

```text
id
type
canonical digest
timestamp
bounded status
aggregate integer metrics
```

It excludes source-document bytes, full claims, evidence identifiers, evidence digests, file names, party identifiers, organization names, commercial values and delivery endpoints.

## Graph digest

The graph digest is:

```text
keccak256(canonical JSON(graph payload without graphId and graphDigest))
```

The graph ID is:

```text
rwpgraph:<first 16 lowercase hex characters after 0x>
```

The graph projection time is deterministic:

```text
projectedAt = latest node timestamp
```

Rebuilding the graph from the same valid artifacts must produce the same nodes, edges, summary, ID and digest.

## Current state

The current state is a bounded navigation aid derived from the latest graph event:

```text
proof_available
awaiting_response
declined
action_required
awaiting_evidence_package
awaiting_evidence_receipt
evidence_received
awaiting_resolution_receipt
resolved
```

It is not a legal conclusion, risk score, financing approval or claim of objective truth.

## Public Timeline Card

The public Timeline Card is a smaller projection of a validated Case Graph.

It contains:

```text
graph ID and digest
Passport and Proof Card digests
current bounded state
event type
event timestamp
event status
event canonical digest
aggregate counts
first and last event times
Timeline Card ID and digest
```

It excludes:

```text
participant or organization names
party identifiers
Evidence IDs
file names
evidence or computed file digests
source-document content
trade fact text
prices, accounts or payment data
delivery endpoints
private notes
```

## Timeline digest

The Timeline Card digest is:

```text
keccak256(canonical JSON(timeline payload without timelineId and timelineDigest))
```

The Timeline Card ID is:

```text
rwptl:<first 16 lowercase hex characters after 0x>
```

Only the Timeline Card may be encoded in a public URL. The source artifacts and full Case Graph are local imports or downloads.

## Viral value

The useful viral object is not an image claiming success.

It is a portable, independently recomputable sequence:

```text
proof available
→ request
→ response
→ evidence delivery check
→ recorded problem
→ append-only correction
→ re-verification
```

A recipient can inspect the object sequence without receiving the underlying commercial documents.

## Security and privacy boundaries

The Case Graph and Timeline Card do not:

- authenticate a wallet, person or organization;
- prove authority to bind a company;
- prove legal delivery or legal effect;
- validate the semantic truth of a document;
- disclose source evidence;
- create an asset, title, receivable or RWA;
- execute payment, settlement, financing or custody;
- activate Token distribution, a market or liquidity;
- allow a DAO vote to manufacture or erase a real-world fact.

```text
DAO governance != graph truth
Token balance != artifact validity
later resolution != erased history
```

## Local-first implementation

A conforming browser client may:

```text
import multiple JSON files
validate them locally
build the deterministic graph
render a timeline
save the graph JSON
create a bounded Timeline Card link
```

It must not upload imported artifacts by default.

## Relationship to RWP Core

RWP Core defines claims, evidence, provenance, confirmation, state, disclosure, digest and history.

The Case Graph makes the object history navigable:

```text
RWP Core establishes valid objects.
Case Graph establishes deterministic relationships among those objects.
Timeline Card makes the relationship history portable without exposing secrets.
```
