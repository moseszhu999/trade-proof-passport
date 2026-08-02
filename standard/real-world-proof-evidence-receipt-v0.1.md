# Real-World Proof Evidence Receipt v0.1

## Purpose

An Evidence Receipt records what a recipient says it received and checked after an authorized RWP Evidence Package was transferred through an existing business channel.

It is not a delivery service, identity proof, legal acceptance, document-content certification, payment confirmation, financing approval or RWA issuance event.

## Source chain

```text
Trade RWP Passport
→ Viral Proof Card
→ RWP Request
→ Holder Response
→ Authorized Evidence Package
→ Evidence Receipt
```

A Receipt binds to the exact Package and its complete upstream digest chain:

```text
packageId + packageDigest
passportDigest + cardDigest
requestId + requestDigest
responseId + responseDigest
```

## Recipient-side checks

For every Package evidence record, the recipient records one status:

```text
matched
mismatch
missing
not_checked
unsupported_algorithm
```

`matched` means the locally selected file bytes reproduced the digest already carried by the Package. It does not prove authorship, authority, legal validity or truthful content.

## Receipt outcomes

### received

Allowed only when:

- Package coverage is complete;
- every Package evidence record is present;
- every locally checked digest matches.

### incomplete

Used when there is no digest mismatch, but:

- Package coverage is incomplete; or
- one or more Package evidence records are missing, unchecked or use an unsupported algorithm.

### mismatch

Required when at least one locally computed file digest differs from the Package evidence digest.

### request_more

A deliberate recipient action asking for more evidence or clarification. It requires a public note of at most 280 characters. The deterministic check result remains separately recorded.

## Private Receipt JSON

The complete Receipt may include:

```text
evidenceId
category
verification status
digest algorithm
locally computed digest
```

It is transferred only through the existing authorized business channel.

The complete Receipt MUST NOT be encoded into a public URL.

## Public Receipt Card

A privacy-bounded public card may contain only:

```text
packageDigest
receiptId + receiptDigest
receiver role category
outcome and deterministic outcome
aggregate counts
Package coverage flag
createdAt
cardId + cardDigest
```

It MUST NOT contain:

- evidence IDs;
- file names;
- computed file digests;
- source-document bytes;
- evidence URIs;
- organization or personal names;
- delivery endpoints;
- prices, accounts or confidential trade facts.

## Deterministic identifiers

The canonical UTF-8 JSON payload is hashed with Keccak-256.

```text
receiptId = rwper:<first 16 hex characters of receiptDigest>
cardId    = rwperc:<first 16 hex characters of cardDigest>
```

Any payload change invalidates its digest and derived ID.

## Viral boundary

The useful viral event is not copying a Receipt Card. It is a real recipient checking an authorized Package and returning a bounded result that the holder can independently verify.

```text
copied link != delivery
Receipt Card != identity
matched digest != truthful content
DAO vote != receipt validity
Token balance != evidence validity
```

## Permanent boundaries

Evidence Receipts do not:

- authenticate the recipient;
- prove that a legal delivery occurred;
- grant evidence access;
- certify document content;
- alter the source Passport or Evidence Package;
- create payment, settlement, financing, custody or RWA rights;
- activate Token claims, markets, liquidity or mainnet operations.
