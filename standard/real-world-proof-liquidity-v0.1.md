# Real-World Proof Liquidity Snapshot v0.1

Status: Community Draft

## 1. Purpose

A Proof Liquidity Snapshot aggregates validated public Pool Adoption Cards for one Trade Pool.

It separates verifiable independent adoption from browsing, wallet connection, empty forks, social sharing and repeated submission of the same workflow.

```text
Trade Pool
→ independent RWP adoption
→ Adoption Card
→ deterministic deduplication
→ Proof Liquidity Snapshot
→ privacy-bounded Snapshot Card
```

## 2. Proof-liquidity unit

One verified proof-liquidity unit requires all of the following:

```text
adoptionStatus = verified_adoption
proofLiquidityEligible = true
observability = full_artifact_bundle
unique Passport root
unique Case Graph
unique Adoption Receipt
unique Adoption Card
```

A proof-liquidity unit is a protocol adoption unit. It is not financial liquidity, capital, collateral, credit, legal approval, Token entitlement or RWA issuance.

## 3. Single-Pool invariant

Every Snapshot contains Adoption Cards for exactly one Trade Pool.

All cards must agree on:

```text
poolId
poolDigest
pool label
pool scope
pool generation
```

Cards from different Pools cannot be mixed into one Snapshot.

## 4. Deterministic deduplication

Cards are sorted by:

```text
passportDigest
→ graphDigest
→ receiptDigest
→ cardDigest
```

The first canonical card is retained. A later card is excluded when it repeats any of:

```text
cardDigest
receiptDigest
graphDigest
passportDigest
```

A duplicate may list more than one repeated dimension. Duplicate submissions never increase `verifiedAdoptionUnits`.

This prevents one adopter from increasing apparent Proof Liquidity by:

- copying the same public Adoption Card;
- regenerating a card for the same Receipt;
- submitting the same Case Graph through multiple cards;
- submitting multiple graphs under the same Passport root.

## 5. Snapshot object

Canonical format:

```text
real-world-proof-liquidity-snapshot
```

The complete Snapshot contains:

- the common Pool identity and metadata;
- the validated public Adoption Cards used as deterministic inputs;
- unique included adoption records;
- excluded duplicate card digests and duplicate dimensions;
- aggregate counts;
- deterministic projection time;
- Snapshot ID and canonical Keccak digest.

Snapshot ID:

```text
rwppls:<16 lowercase hexadecimal characters>
```

The complete Snapshot is intended for download and independent recomputation. It is not encoded in a public share URL.

## 6. Aggregate counts

A Snapshot reports:

```text
submittedCards
uniqueCards
verifiedAdoptionUnits
partialAdoptions
notAdopted
excludedDuplicates
fullArtifactVerified
firstAdoptionAt
lastAdoptionAt
```

`verifiedAdoptionUnits` only counts unique full-artifact verified adoptions.

`partialAdoptions` and `notAdopted` remain visible. They are not silently deleted to make a Pool appear more successful.

## 7. Public Snapshot Card

Canonical format:

```text
real-world-proof-liquidity-snapshot-card
```

The public Card contains:

- Snapshot ID and digest;
- Pool ID and digest;
- public Pool label, scope and generation;
- aggregate verified, partial, rejected and duplicate counts;
- first and last adoption timestamps;
- Card ID and digest.

Card ID:

```text
rwpplcard:<16 lowercase hexadecimal characters>
```

The Card does not contain individual adopter Passport, Graph, Receipt or Adoption Card digests.

A recipient who needs to audit the aggregate must obtain the complete Snapshot through an appropriate public repository or authorized channel and recompute its digest.

## 8. Privacy boundary

The public Snapshot Card must not expose:

- adopter identity or organization name;
- Passport ID;
- Party ID;
- Evidence ID;
- source file, file name or file digest;
- evidence digest or computed digest;
- trade fact statement;
- goods description, price, bank data or delivery endpoint;
- private note or credential.

The complete Snapshot contains already-public Adoption Cards and digest references. It does not recover the private RWP artifacts behind those cards.

## 9. Viral boundary

The viral unit is a verifiable aggregate, not an attention metric.

The following do not create Proof Liquidity:

```text
page view
wallet connection
Pool link copy
social post
empty Pool fork
partial adoption
not-adopted result
duplicate Passport or Graph submission
```

A public Snapshot Card may be shared widely, but its count derives only from validated Adoption Cards.

## 10. Decentralized publication

Version 0.1 does not require a central index.

Any party may:

1. collect public Adoption Cards;
2. build the same deterministic Snapshot locally;
3. publish the complete Snapshot as a static JSON file;
4. share the compact Snapshot Card;
5. let another party recompute the Snapshot and compare the digest.

Different publishers may produce different snapshots from different input sets. A Snapshot therefore proves only the exact card set committed by its digest. It does not claim global completeness.

## 11. Governance and truth boundary

```text
DAO vote != verified adoption
Token balance != Proof Liquidity
Snapshot size != legal compliance
Pool popularity != trade truth
verified adoption != identity authentication
```

A future DAO may govern schemas, canonical vocabularies, grants and discovery policy. It cannot vote a duplicate, partial workflow or unsupported claim into a verified unit.

## 12. Non-goals

Version 0.1 does not provide:

- a global Pool registry;
- a canonical leaderboard;
- identity or organization verification;
- reputation or credit scoring;
- payment, settlement, financing or custody;
- Token rewards or claims;
- RWA issuance;
- mainnet execution.

## 13. Open implementation

The Snapshot builder, validator, JSON Schema, browser page and tests are open source. Any party may independently host and reproduce the same canonical result from the same Adoption Cards.
