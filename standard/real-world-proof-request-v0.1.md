# Real-World Proof Request v0.1

Status: community draft

## Purpose

A Real-World Proof Request turns a privacy-bounded Proof Card into a real recipient action without requiring the source holder to publish commercial secrets.

The request may ask for:

- authorized evidence;
- confirmation from a responsible role;
- a change or clarification.

It references the source Passport digest and Proof Card digest. It does not contain the complete Passport or grant access to evidence.

## Object

```json
{
  "format": "real-world-proof-request",
  "version": "0.1",
  "domain": "trade",
  "source": {
    "artifactType": "RealWorldProofCard",
    "passportDigest": "0x...",
    "cardDigest": "0x..."
  },
  "requestedAction": "request_authorized_evidence",
  "requester": {
    "role": "buyer"
  },
  "evidenceTypes": ["inspection_report", "packing_list"],
  "note": "Please provide the authorized inspection summary.",
  "createdAt": "2026-08-02T00:00:00.000Z",
  "assurance": "...",
  "requestId": "rwpr:...",
  "requestDigest": "0x..."
}
```

## Requested actions

- `request_authorized_evidence`
- `request_responsible_confirmation`
- `request_change`

## Evidence categories

The bounded draft recognizes:

- `purchase_order`
- `commercial_invoice`
- `packing_list`
- `inspection_report`
- `bill_of_lading`
- `warehouse_receipt`
- `logistics_event`
- `customs_record`
- `insurance_record`
- `other`

A requested category is not evidence and does not imply that the holder possesses, controls or must disclose it.

## Digest and identifier

`requestDigest` is Keccak-256 over canonical JSON containing all request fields except `requestId` and `requestDigest`.

`requestId` is:

```text
rwpr:<first 16 lowercase hexadecimal characters of requestDigest without 0x>
```

The digest protects request-link integrity. It does not authenticate the requester.

## Privacy boundary

A request link may include:

- source Passport digest;
- source Proof Card digest;
- requester role category;
- requested action;
- requested evidence categories;
- a short public note.

It must not include:

- complete Passport JSON;
- organization or personal names;
- party identifiers;
- source-document contents;
- evidence URIs or evidence digests;
- private fact statements;
- bank details, prices or confidential confirmation notes.

The requester is responsible for keeping the optional note non-confidential.

## Authority boundary

Every v0.1 request is `unsigned_self_declared` in effect.

It does not:

- verify requester identity or organizational authority;
- compel disclosure;
- grant access to any document;
- confirm a trade fact;
- alter the source Passport or Proof Card;
- authorize payment, financing, settlement, custody or RWA issuance.

The holder decides whether and how to respond through an authorized channel.

## Viral lineage

A recipient may create a distinct follow-up Passport that records:

```json
{
  "relation": "reuses_pattern_from",
  "sourceArtifactType": "RealWorldProofCard",
  "sourceDigest": "0x...",
  "sourceCardDigest": "0x...",
  "recordedAt": "2026-08-02T00:00:00.000Z"
}
```

This lineage records workflow reuse. It does not prove that the two trade cases involve the same goods, parties, rights or transaction.

Copied links, page views, wallet connections, empty social posts and self-generated loops are not valuable contribution events merely because lineage exists.
