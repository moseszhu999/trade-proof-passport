# Trade Proof Passport v0.1

Status: Community Draft  
Date: 2026-07-31

## 1. Purpose

A Trade Proof Passport is a portable package that lets a receiver inspect selected facts about a trade case together with supporting evidence references, party confirmations, version history, and current lifecycle status.

It is intended to reduce repeated document forwarding and manual reconstruction. It does not make a fact true merely because the fact appears in a passport.

## 2. Core distinction

A passport separates four things that are often mixed together:

1. **Fact** — a precise statement about a trade case.
2. **Evidence** — a referenced source that may support the fact.
3. **Confirmation** — a named party's decision about a specific fact version.
4. **Lifecycle** — whether the passport or fact is current, superseded, disputed, expired, or revoked.

## 3. Minimum object

A conforming v0.1 passport MUST contain:

- `schemaVersion`
- `passportId`
- `createdAt`
- `updatedAt`
- `tradeCase`
- `parties`
- `facts`
- `evidence`
- `confirmations`
- `lifecycle`
- `disclosure`

## 4. Trade case

`tradeCase` identifies the bounded commercial context. It MUST include:

- `caseReference`
- `goodsDescription`

It MAY include quantity, unit, batch reference, purchase-order reference, shipment reference, or other non-sensitive identifiers.

## 5. Parties

Each party MUST include:

- `partyId`
- `role`
- `displayName`

A party identifier MAY be a local identifier, URI, DID, legal entity identifier, registry identifier, or another scheme. Presence of an identifier does not prove that the party is authorized.

## 6. Facts

Each fact MUST include:

- `factId`
- `type`
- `statement`
- `status`
- `version`
- `assertedBy`
- `assertedAt`
- `evidenceRefs`

Allowed v0.1 statuses are:

- `asserted`
- `confirmed`
- `disputed`
- `superseded`
- `expired`
- `revoked`

When a fact replaces an earlier fact, it SHOULD use `supersedesFactId`.

## 7. Evidence

Each evidence record MUST include:

- `evidenceId`
- `type`
- `title`
- `digest.algorithm`
- `digest.value`
- `disclosure`

The digest identifies a specific byte representation. Implementers MUST document any normalization or canonicalization performed before hashing.

Source documents SHOULD remain off-chain and access-controlled. A URI MAY resolve to a private, expiring, or selectively disclosed resource.

## 8. Confirmations

Each confirmation MUST include:

- `confirmationId`
- `factId`
- `factVersion`
- `partyId`
- `decision`
- `decidedAt`

Allowed decisions are:

- `confirm`
- `reject`
- `request_change`
- `acknowledge`

A confirmation MUST address one fact version. Confirming version 1 does not automatically confirm version 2.

An optional `proof` object MAY carry a signature or verifiable-credential envelope. v0.1 does not mandate one cryptographic suite.

## 9. Lifecycle

Passport lifecycle status MUST be one of:

- `draft`
- `active`
- `superseded`
- `expired`
- `revoked`

Revocation SHOULD include a time and reason. Supersession SHOULD identify the successor passport.

## 10. Disclosure

`disclosure.profile` MUST be one of:

- `private`
- `shared`
- `public_summary`

A public summary MUST NOT expose confidential source documents merely because their digests or metadata appear in the passport.

## 11. Reference integrity

A v0.1 verifier SHOULD reject a passport when:

- IDs are duplicated;
- a fact references an unknown party;
- a fact references unknown evidence;
- a confirmation references an unknown fact or party;
- a confirmation addresses a fact version that does not exist;
- a supersession reference points to the same object;
- lifecycle values fall outside the defined sets.

## 12. Cryptography and blockchain

The core passport is ordinary JSON and MUST remain usable without a blockchain.

Implementations MAY anchor a digest, Merkle root, signature, or verifiable credential on a distributed ledger. Such anchoring proves integrity and timing under the chosen mechanism; it does not by itself prove the truth of a fact, the authority of an issuer, legal title, regulatory approval, or creditworthiness.

## 13. Portability and viral use

A passport MAY be distributed as:

- JSON;
- a human-readable web page;
- a QR-resolvable verification page;
- an attachment to a handoff package;
- an input to an AI agent or enterprise system;
- a W3C Verifiable Credential wrapper.

A request for another party to confirm a fact SHOULD be possible without requiring that party to adopt the full tradeOS application. This is the intended product-led distribution loop.

## 14. Standards alignment

This community draft should evolve by mapping to established work, especially:

- UN/CEFACT Verifiable Trade Documents: https://unvtd.unece.org/
- UN Transparency Protocol Digital Product Passport: https://untp.unece.org/docs/specification/DigitalProductPassport/
- W3C Verifiable Credentials Data Model 2.0: https://www.w3.org/TR/vc-data-model-2.0/
- JSON Schema: https://json-schema.org/

This document does not claim endorsement or conformance certification from those organizations.
