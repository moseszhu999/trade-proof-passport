# Real-World Proof Pattern and Trade Pool v0.1

Status: Community Draft

## 1. Purpose

A Real-World Proof Pattern extracts a reusable public workflow shape from a validated RWP Case Graph or privacy-bounded Timeline Card.

A Trade Pool publishes that Pattern together with openly declared roles, evidence categories and state gates so that another party can build an independent RWP using the same public rules.

The Pool is not a shared trade database. It contains no source Passport, evidence record, file digest, participant identity or confidential trade statement.

## 2. Category statement

```text
Case Graph / Timeline Card
→ Proof Pattern
→ Trade Pool
→ independent adopter workflow
→ independent RWP
```

The protocol separates two kinds of information.

### 2.1 Derived workflow

The following fields are derived deterministically from a validated Case Graph or Timeline Card:

- ordered RWP artifact types;
- observed bounded states;
- required node types;
- graph relations when a full Case Graph is available;
- whether branching was observed;
- the terminal state observed in the source workflow.

### 2.2 Declared requirements

The following fields are explicitly declared by the Pool operator and are not represented as facts derived from the source trade:

- required role categories;
- requested evidence categories;
- acceptable workflow state gates.

Every declared requirement carries the provenance marker `operator_declared` or `pool_operator_declared`.

## 3. Proof Pattern object

The canonical format is:

```text
real-world-proof-pattern
```

A Pattern contains:

- source artifact type, ID and canonical digest;
- root Passport and Proof Card digests;
- ordered public workflow steps;
- deduplicated relation types when available;
- relation coverage: `explicit_graph` or `sequence_only`;
- observed terminal state and branching flag;
- operator-declared roles, evidence categories and status gates;
- deterministic Pattern ID and digest.

Pattern ID format:

```text
rwppat:<16 lowercase hexadecimal characters>
```

The Pattern digest is:

```text
keccak256(canonical JSON Pattern payload)
```

The Pattern ID and digest are recomputed during validation.

## 4. Relation coverage

### `explicit_graph`

The source is a complete RWP Case Graph. Relation triples are derived from validated graph edges:

```text
fromType + relation + toType
```

Repeated triples are deduplicated and sorted.

### `sequence_only`

The source is a public Timeline Card. Event order and states are available, but full edge topology is not. The Pattern must not invent graph relations that are absent from the public projection.

## 5. Trade Pool object

The canonical format is:

```text
real-world-proof-trade-pool
```

A Trade Pool contains:

- a public label and scope;
- an optional bounded public summary;
- one complete validated Proof Pattern;
- public operator-declared role, evidence and status-gate rules;
- lineage information;
- a deterministic Pool ID and digest.

Pool scopes are:

```text
trade_corridor
industry
workflow
other
```

Pool ID format:

```text
rwppool:<16 lowercase hexadecimal characters>
```

The Pool digest is:

```text
keccak256(canonical JSON Pool payload)
```

## 6. Independent reuse invariant

Every Pool fixes:

```text
reuseMode = independent_rwp_only
```

Forking or adopting a Pool copies only public rules.

It does not copy or inherit:

- the source Passport;
- source facts or confirmations;
- source evidence or provenance;
- participant identity or authority;
- source organization reputation;
- a source Receipt or Resolution result;
- compliance, approval, legal effect or truth.

Each adopter must create its own RWP objects, evidence, confirmations, receipts and timeline.

## 7. Fork lineage

A root Pool has:

```text
generation = 0
```

and no `forkedFromPoolDigest`.

A fork has:

```text
generation = parent.generation + 1
forkedFromPoolDigest = parent.poolDigest
```

Fork lineage proves that one public rules object was derived from another. It does not prove cooperation, endorsement or ownership by the parent Pool operator.

## 8. Public rule vocabulary

### Roles

```text
exporter
buyer
supplier
manufacturer
inspection
logistics
warehouse
customs
insurance
legal
funder
other
```

### Evidence categories

```text
bill_of_lading
commercial_invoice
customs_record
inspection_report
insurance_record
logistics_event
packing_list
purchase_order
warehouse_receipt
other
```

### Status gates

```text
proof_available
awaiting_response
awaiting_evidence_package
awaiting_evidence_receipt
evidence_received
awaiting_resolution_receipt
action_required
resolved
declined
```

Status gates are public workflow requirements. They are not statements that an adopter has already reached those states.

## 9. Privacy boundary

A Pattern or Pool may expose:

- RWP object types;
- bounded workflow states;
- abstract graph relation types;
- public role categories;
- public evidence categories;
- state gates;
- canonical source, Pattern and Pool digests;
- fork lineage.

A Pattern or Pool must not expose:

- Passport ID;
- Party ID or organization name;
- evidence ID;
- file name, file bytes or evidence digest;
- source document URI;
- trade fact statement;
- goods description, price or bank data;
- delivery endpoint;
- computed local file digest;
- confidential note or credential.

The complete Pool is public and may be encoded into a bounded share URL because every allowed field is part of the public rule object.

## 10. Viral adoption loop

```text
Publish Pool
→ recipient inspects public rules
→ recipient forks Pool
→ fork records parent Pool digest
→ recipient creates an independent Passport
→ recipient produces an independent Proof Card and Case Graph
→ new validated pattern can improve or fork the Pool again
```

The viral unit is not an empty social share. It is a reusable public workflow rule followed by a new independently verifiable RWP.

## 11. Governance and truth boundary

```text
DAO vote != real-world truth
Token balance != evidence validity
Pool popularity != compliance
Fork count != successful trade
Pattern reuse != participant authorization
```

A DAO may govern schemas, public vocabulary, grants and canonical Pool discovery. It cannot vote a trade fact, receipt or resolution into existence.

## 12. Non-goals

Version 0.1 does not provide:

- central Pool registry or ranking;
- identity or organization verification;
- automatic evidence retrieval;
- legal or regulatory approval;
- payment, settlement, financing or custody;
- RWA issuance;
- Token distribution or liquidity;
- mainnet execution.

## 13. Open implementation

The Pattern, Pool schema, validator, browser builder and tests are open source. Any party may independently host the frontend, verify the same canonical digests and fork the public rules without using an official server.
