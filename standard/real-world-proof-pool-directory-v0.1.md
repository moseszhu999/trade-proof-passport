# Real-World Proof Pool Directory v0.1

Status: Community Draft

## 1. Purpose

A Real-World Proof Pool Directory is an open, forkable and self-declared discovery manifest for public Trade Pools.

It allows any community, trade corridor, industry group, developer, DAO working group or individual curator to publish a deterministic list of validated Pool objects and optional matching Proof Liquidity Cards without creating a central ranking service or private database.

```text
Trade Pools
+ optional Proof Liquidity Cards
→ deterministic Directory Manifest
→ privacy-bounded Directory Card
→ open sharing and Fork lineage
```

## 2. What the Directory is

A Directory is:

- an open public manifest;
- a deterministic list of complete validated Trade Pools;
- an optional attachment point for each Pool's public Proof Liquidity Card;
- a curator-declared inclusion decision;
- a forkable object with parent Directory lineage;
- independently hostable and verifiable.

## 3. What the Directory is not

A Directory is not:

- a central Pool registry;
- a global ranking;
- an endorsement list;
- an identity registry;
- a compliance approval system;
- a credit score;
- a Token allocation table;
- an RWA issuance list;
- proof that every listed Pool is useful or safe.

The fixed curation boundary is:

```text
mode = open_self_declared
entriesAreEndorsements = false
rankingProvided = false
```

## 4. Canonical formats

Complete Manifest:

```text
real-world-proof-pool-directory
```

Public Card:

```text
real-world-proof-pool-directory-card
```

Version:

```text
0.1
```

Directory ID:

```text
rwpdir:<16 lowercase hexadecimal characters>
```

Directory Card ID:

```text
rwpdircard:<16 lowercase hexadecimal characters>
```

Both IDs derive from the first 16 hexadecimal characters of the canonical Keccak digest.

## 5. Complete Directory Manifest

A complete Directory embeds:

- public Directory label and scope;
- optional bounded public description;
- fixed curation boundary;
- Directory Fork lineage;
- 1 to 12 complete validated Trade Pools;
- optional matching Proof Liquidity Card for each Pool;
- optional bounded curator note for each entry;
- deterministic summary;
- Directory digest and ID.

The complete Manifest is downloaded as JSON. It is not encoded into the public share URL.

## 6. Entry validation

Every entry must contain one complete `real-world-proof-trade-pool` object that passes the canonical Pool validator.

When a Proof Liquidity Card is attached, it must:

- pass the canonical Proof Liquidity Card validator;
- reference the exact Pool ID;
- reference the exact Pool digest;
- repeat the Pool label, scope and generation exactly.

A mismatched Card fails closed. It is not treated as a loose popularity claim.

## 7. Canonical ordering and uniqueness

Entries are sorted by:

```text
poolDigest ascending
```

Within one Directory:

```text
Pool ID must be unique
Pool digest must be unique
```

A duplicate Pool fails closed instead of artificially increasing entry count.

## 8. Directory scopes

A Directory declares one public scope:

```text
community
trade_corridor
industry
workflow
other
```

The Directory scope describes the curator's intended discovery context. It does not change the scope declared by any embedded Pool.

## 9. Summary

The deterministic summary includes:

```text
entryCount
poolsWithLiquidity
poolsWithoutLiquidity
verifiedAdoptionUnits
uniqueAdoptionCards
excludedDuplicates
partialAdoptions
notAdopted
scopes.trade_corridor
scopes.industry
scopes.workflow
scopes.other
firstPoolCreatedAt
lastObservedAt
```

Liquidity totals are copied only from validated matching Proof Liquidity Cards. The Directory does not independently recalculate Pool Adoption Cards or create new Proof Liquidity units.

## 10. Fork lineage

A root Directory has:

```text
generation = 0
```

and no parent digest.

A fork has:

```text
generation = parent.generation + 1
forkedFromDirectoryDigest = parent.directoryDigest
```

A fork may:

- add a Pool;
- remove a Pool;
- attach or replace a matching Liquidity Card;
- change curator notes;
- change Directory label, scope or description.

A fork does not:

- modify the embedded Pool digest;
- modify the embedded Liquidity Card digest;
- inherit legal authority from the parent curator;
- imply endorsement by the parent curator;
- preserve a global canonical ordering outside the deterministic local Manifest.

## 11. Public Directory Card

The public Directory Card projects:

- Directory ID and digest;
- Directory label, scope and generation;
- optional parent Directory digest;
- Pool ID, Pool digest and Pattern digest;
- Pool label, scope and generation;
- optional curator note;
- optional aggregate Proof Liquidity Card projection;
- Directory summary;
- projected timestamp;
- Card digest and ID.

The public Card does not embed complete Pool rules or complete Liquidity Cards. It is a discovery projection bound to the complete Directory digest.

## 12. Viral flow

```text
Curator imports public Pools
→ optionally attaches matching Liquidity Cards
→ builds complete Directory locally
→ downloads Directory Manifest
→ publishes privacy-bounded Directory Card link
→ another curator imports the full Manifest
→ adds/removes entries
→ creates a Fork with parent digest
```

The viral unit is an inspectable, digest-bound discovery list rather than an unverifiable screenshot or a central website counter.

## 13. Privacy boundary

The complete Directory and public Card may expose only already-public protocol objects and projections.

They must not expose:

- source Passport ID;
- Party ID or participant name;
- Evidence ID;
- file name or file bytes;
- evidence digest or locally computed file digest;
- trade fact statement;
- goods description;
- delivery endpoint;
- bank account or unit price;
- confidential note or credential.

Curator notes are public, bounded to 160 characters and must not contain private-field markers.

## 14. Ranking boundary

Version 0.1 deliberately has no score, weight, sort-by-quality function or recommended badge.

```text
Directory inclusion != endorsement
Directory position != ranking
Liquidity units != quality score
Fork count != real adoption
Token balance != curation authority
```

Entries use canonical digest ordering only.

## 15. DAO boundary

A DAO or community may use this open object to publish its own curated Directory.

A DAO may:

- define transparent inclusion criteria outside the protocol object;
- fork another Directory;
- publish competing Directories;
- maintain a public audit trail of Directory digests;
- fund open Pool and Connector development.

A DAO cannot:

- vote an invalid Pool into protocol validity;
- alter a Pool or Liquidity Card without changing its digest;
- convert inclusion into proof of truth;
- make Token holders the source of trade facts.

## 16. Integrity model

The complete Directory digest is:

```text
keccak256(canonical JSON Directory payload)
```

The public Directory Card separately computes:

```text
keccak256(canonical JSON Directory Card payload)
```

A public Card preserves the complete `directoryDigest`, allowing a recipient who later receives the full Manifest to perform exact cross-verification.

## 17. Bounded implementation

Version 0.1 provides:

- deterministic JavaScript builder and validator;
- Directory Fork helper;
- machine-readable JSON Schema;
- browser-local Manifest builder;
- downloadable complete Directory JSON;
- shareable public Directory Card;
- canonical test vectors;
- no official server dependency.

One Directory contains at most 12 Pool entries so the public projection remains bounded.

## 18. Non-goals

Version 0.1 does not provide:

- central search API;
- global registry or ranking;
- crawler or automatic Pool discovery;
- organization identity verification;
- anti-Sybil enforcement;
- database-backed counters;
- wallet signatures;
- chain writes;
- payment, financing or custody;
- Token distribution or market liquidity;
- RWA issuance;
- mainnet execution.

## 19. Open implementation

The Directory schema, canonicalization rules, validator, Fork logic, browser page and test vectors are open source. Any party may independently host a Directory builder, publish a competing Directory and verify the same digests without using an official server.
