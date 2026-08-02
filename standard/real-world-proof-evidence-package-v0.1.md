# Real-World Proof Evidence Package v0.1

Status: community draft.

## Purpose

A Real-World Proof Evidence Package is a holder-generated manifest for evidence records selected after an RWP Request has been accepted or partially accepted for an `authorized_off_channel` workflow.

It closes this bounded sequence:

```text
Proof Card
→ RWP Request
→ holder Request Response
→ local Passport verification
→ selected evidence manifest
→ delivery through an independently authorized channel
```

The package is not a public Proof Card and must not be embedded in a public URL.

## Source chain

Every package binds to the complete upstream chain:

```text
Passport digest
Proof Card digest
Request ID + Request digest
Response ID + Response digest
Package ID + Package digest
```

The imported Passport digest MUST equal the Proof Card `sourceDigest`.

The Request MUST reference that Proof Card.

The Response MUST reference that Request and MUST have:

```text
decision.status = accept | partially_accept
fulfillment.mode = authorized_off_channel
```

A declined response, clarification-only response, or response with no authorized evidence category cannot create an Evidence Package.

## Evidence selection

The package may contain only Passport evidence records whose normalized category appears in the Response `fulfillment.evidenceTypes`.

Normalization examples:

```text
inspection_summary → inspection_report
logistics_status_record → logistics_event
purchase_order → purchase_order
```

The package records:

- evidence ID;
- normalized category;
- source evidence type;
- declared digest algorithm and value;
- disclosure state;
- optional issue time;
- optional issuer role category;
- local file-verification status.

It intentionally excludes:

- source-document bytes;
- evidence URI;
- organization or personal names;
- party identifiers;
- delivery endpoints;
- bank details, prices, account destinations or credentials.

## Local file verification

The browser may recompute SHA-256, SHA-384 or SHA-512 for a locally selected file.

Possible statuses are:

```text
not_checked
matched
mismatch
unsupported_algorithm
```

`matched` means only that the selected local bytes equal the digest already recorded in the Passport. It does not prove who created the file, whether the document is legally valid, or whether its contents are true.

## Coverage

The package reports:

```text
allowedCategories
includedCategories
missingCategories
complete
```

A partial package remains valid if each selected evidence record is authorized. `complete` is true only when every category authorized by the Response appears in at least one included evidence record.

## Canonical digest

The package payload is canonicalized with the same dependency-free canonical JSON profile used by TradeProof browser objects.

```text
packageDigest = keccak256(canonical JSON payload)
packageId = "rwpep:" + first 16 lowercase hex characters of packageDigest
```

`packageId` and `packageDigest` are excluded while calculating the digest and are added afterward.

## Privacy and transport boundary

The package manifest is downloaded locally. TradeProof does not upload it, host it, email it, or encode it into a share link.

The holder separately transfers the manifest and any selected files through the channel category already named in the accepted Response, such as an existing business channel or secure data room.

The manifest does not prove that delivery occurred.

## Agent boundary

An Agent may:

- match Passport evidence to authorized categories;
- recompute file digests;
- detect missing categories;
- propose a package manifest.

An Agent may not:

- expand the Response authorization;
- insert evidence from an unapproved category;
- treat a digest match as proof of truth;
- send files without the holder's explicit action;
- claim identity or legal authority.

## Viral value

A copied link or downloaded manifest is not, by itself, a contribution event.

Useful adoption begins when a distinct counterparty uses the authorized package in a real review workflow, produces a responsible response, or creates a new RWP with verifiable lineage.

## Permanent boundaries

An Evidence Package is not:

- proof of absolute real-world truth;
- identity or authority verification;
- proof of delivery;
- legal, customs, insurance, financing or regulatory approval;
- ownership, title or RWA issuance;
- payment, settlement or custody;
- a Token claim, sale, market or liquidity action.
