# Trade Proof Response v0.1

Status: community draft.

A Trade Proof Response is a portable reply to a Trade Proof Passport public summary. It records one bounded decision:

- `confirm`
- `reject`
- `request_change`

## Purpose

The response object lets a receiving party return a machine-readable reply instead of sending an unstructured message. It references the Passport and case, identifies the responder only by role, and carries an optional public comment.

## Minimum object

```json
{
  "schemaVersion": "0.1",
  "responseId": "tpr:example:001",
  "passportReference": {
    "passportId": "tpp:example:steel-cabinet:001",
    "caseReference": "SC-EXPORT-001",
    "sourceSummaryVersion": "0.1"
  },
  "decision": {
    "status": "request_change",
    "scope": "public_summary",
    "comment": "Please clarify the pickup date."
  },
  "responder": {
    "role": "buyer"
  },
  "createdAt": "2026-08-01T00:00:00.000Z",
  "assurance": {
    "type": "unsigned_self_declared",
    "statement": "This browser-generated response does not verify the responder's identity, authority, or signature."
  },
  "disclosure": {
    "profile": "public_response"
  }
}
```

## Privacy boundary

The public response format does not include:

- organization names;
- personal names;
- party identifiers;
- evidence URIs or digests;
- source documents;
- wallet addresses or signatures.

The optional comment is public to anyone who receives the response link.

## Assurance boundary

A v0.1 browser response is unsigned and self-declared. It does not prove:

- responder identity;
- organizational authority;
- legal acceptance;
- contract amendment;
- customs, insurance, financing, payment, settlement, ownership, or title status;
- truth of the Passport facts.

A future signed profile may attach a verifiable proof without changing these v0.1 decision semantics.
