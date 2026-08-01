# Real-World Proof Request Response v0.1

Status: community draft

## Purpose

A Real-World Proof Request Response lets the holder of a workflow answer a bounded RWP Request without publishing source evidence or contact endpoints in the public link.

It can record:

- acceptance;
- partial acceptance;
- a request for clarification;
- decline.

The response is bound to the source Passport digest, Proof Card digest, Request ID and Request digest.

## Decisions

- `accept`
- `partially_accept`
- `request_clarification`
- `decline`

## Fulfillment modes

- `authorized_off_channel`
- `public_note_only`
- `none`

`authorized_off_channel` means the holder indicates willingness to continue through an already authorized channel. It does not prove delivery and the public response contains no address, account, URL, email or source document.

Allowed channel hints are category labels only:

- `existing_business_channel`
- `secure_data_room`
- `encrypted_email`
- `other`

## Object

```json
{
  "format": "real-world-proof-request-response",
  "version": "0.1",
  "domain": "trade",
  "source": {
    "artifactType": "RealWorldProofRequest",
    "passportDigest": "0x...",
    "cardDigest": "0x...",
    "requestId": "rwpr:...",
    "requestDigest": "0x..."
  },
  "decision": {
    "status": "partially_accept"
  },
  "responder": {
    "role": "exporter"
  },
  "fulfillment": {
    "mode": "authorized_off_channel",
    "evidenceTypes": ["inspection_report"],
    "channelHint": "existing_business_channel"
  },
  "note": "Inspection summary can be reviewed through the existing business channel.",
  "createdAt": "2026-08-02T00:00:00.000Z",
  "assurance": "...",
  "responseId": "rwprr:...",
  "responseDigest": "0x..."
}
```

## Deterministic integrity

`responseDigest` is Keccak-256 over canonical JSON containing all fields except `responseId` and `responseDigest`.

`responseId` is:

```text
rwprr:<first 16 lowercase hexadecimal characters of responseDigest without 0x>
```

The response link includes the source Proof Card, Request and Response so each layer can be independently validated and cross-checked.

## Evidence boundary

`fulfillment.evidenceTypes` contains categories only. Every offered category must be a subset of the categories in the source Request.

The response never contains:

- source-document bytes or excerpts;
- evidence URIs or evidence digests;
- organization or person names;
- party identifiers;
- email addresses, URLs, wallet destinations or account details;
- private trade facts, prices or bank details.

## Decision invariants

### Accept

- fulfillment mode cannot be `none`;
- no claim is made that off-channel delivery has occurred.

### Partially accept

When the Request names evidence categories, the response must offer a non-empty proper subset.

### Request clarification

- mode is `public_note_only`;
- a public note is required;
- no evidence category or channel hint is offered.

### Decline

- mode is `none`;
- no evidence category or channel hint is offered.

## Authority boundary

Every v0.1 response is unsigned and self-declared.

It does not:

- verify responder identity or organizational authority;
- prove that a document exists or was delivered;
- grant access to any system;
- create a legal obligation;
- confirm the underlying trade fact;
- authorize payment, financing, settlement, custody or RWA issuance.

The counterparties must use an independently authorized business channel for any confidential exchange.

## Contribution boundary

Generating or copying a Response is not automatically a contribution event. Meaningful contribution requires a responsible cross-party outcome, authorized evidence exchange, a distinct follow-up workflow or reusable public infrastructure under published anti-wash rules.
