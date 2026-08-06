# TradeOS → TradeProof Relationship Feedback Handoff v0.1

## Product path

```text
TradeOS Case / Evidence review
→ disclosure-authorized relationship feedback
→ deterministic handoff envelope
→ TradeProof candidate pending holder review
→ later controlled import/publication
```

This module is a cross-repository data contract. It does not import automatically, publish, verify identity, score a party, update a public profile, write a Registry, or submit anything on-chain.

## Required source fields

```text
source Case ID and SHA-256 digest
source evidence SHA-256 digest
public subject kind, ID and digest
relationship type
reviewed statement
provenance references
review status
uncertainty where gaps remain
public disclosure authority
exact human confirmation
prepared timestamp
```

## Supported relationship candidate types

```text
delivery_completed
response_observed
inspection_verified
correction_required
```

These are review candidate labels, not public truth or qualification decisions.

## Digest model

The candidate digest is SHA-256 over canonical JSON of the candidate before IDs/digests are attached. The handoff digest is SHA-256 over canonical JSON of the complete unsigned envelope.

```text
candidateDigest = sha256(canonical candidate)
handoffDigest   = sha256(canonical unsigned handoff envelope)
```

## Privacy boundary

The public candidate projection excludes:

```text
source Case ID
organization ID
actor ID
source evidence digest
raw evidence
contact data
```

Internal handoff consumers may retain source Case and evidence digests for traceability, but those fields are not part of the public projection.

## Human-control boundary

The exact confirmation text is:

```text
PREPARE TRADEPROOF RELATIONSHIP CANDIDATE
```

The resulting state is:

```text
candidate_pending_holder_review
handoff_prepared_not_imported
```

## Explicit false boundaries

```text
identityVerified = false
relationshipVerifiedForPublicUse = false
rankingPerformed = false
scoreCreated = false
publicProfileUpdated = false
importPerformed = false
publicationApproved = false
publicWritePerformed = false
registryWritePerformed = false
chainSubmissionPerformed = false
externalActionPerformed = false
```

## Validation

Run:

```bash
node tools/verify-relationship-feedback-handoff.mjs
```

The verifier covers deterministic digests, privacy projection, disclosure/provenance/confirmation rejection, uncertainty requirements and no-write boundaries.
