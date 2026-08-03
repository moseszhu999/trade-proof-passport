# Supplier Evidence Intake & Verification Queue v0.8

## Purpose

This slice brings holder-selected local evidence files into the same Trade Case and Supplier Response workflow:

```text
inbound attachment metadata or supplier response question
+ holder-selected local file
+ selected supplier candidate
→ local SHA-256 digest
→ bounded text extraction or binary metadata-only record
→ source-field confirmation queue
→ evidence gaps and manual-review tasks
```

It does not upload the original file, verify a certificate, query an issuer or registry, verify supplier identity, create a formal submission, rank suppliers, or decide eligibility.

## Byte hashing versus document parsing

Every accepted file is read locally as bytes so the browser can calculate SHA-256:

```text
fileBytesHashedLocally = true
contentDigest = sha256:...
fileUploaded = false
originalFileStored = false
fullContentStored = false
```

This is different from parsing document content.

Text decoding is limited to files no larger than 2 MiB with a supported text extension or media type:

- TXT
- Markdown
- CSV
- JSON
- XML
- EML

PDF, Word, Excel, images, archives and other binary files may be accepted up to 8 MiB for local hashing and metadata registration, but remain:

```text
documentContentParsed = false
state = metadata_only_pending_manual_review
```

## Evidence item contract

```text
schemaVersion = tradeproof.supplier-evidence-item.v0.8
state = text_candidates_pending_review | metadata_only_pending_manual_review | source_fields_reviewed_unverified
evidenceClassification = holder_selected_local_file_unverified
```

The item is bound to:

- Trade Case;
- Supplier Response Request;
- locally selected supplier candidate;
- optional response question;
- optional inbound email event and attachment metadata.

If the local filename differs from the observed email attachment filename, the model adds a review task. It does not silently treat the files as identical.

## Bounded candidate extraction

For supported text files, v0.8 can extract candidate values explicitly labelled as:

- legal entity;
- certificate number;
- issuer or certification body;
- product scope;
- valid-until or expiry date.

Every extracted value starts as:

```text
state = candidate_unconfirmed
sourceConfirmed = false
evidenceVerified = false
externalVerificationPerformed = false
```

The holder may confirm only that a value appears in the selected local file:

```text
state = confirmed_in_local_file
sourceConfirmed = true
evidenceVerified = false
```

Source confirmation is not authenticity, issuer, validity, scope or supplier-identity verification.

## Local evidence queue

```text
schemaVersion = tradeproof.supplier-evidence-queue.v0.8
state = holder_local_private
serverPersistencePerformed = false
externalVerificationPerformed = false
formalSubmissionPerformed = false
rankingGenerated = false
supplierEligibilityDecided = false
```

Duplicate evidence IDs based on candidate and digest are upserted rather than appended repeatedly.

## Page

`docs/supplier-evidence.html`

The page reads the same local objects used by earlier slices:

- `tradeproof.trade.case.v0.2`
- `tradeproof.supplier.review.v0.4`
- `tradeproof.supplier.response.request.v0.5`
- `tradeproof.inbound.communication.timeline.v0.7`

It stores:

- `tradeproof.supplier.evidence.queue.v0.8`

The queue JSON export contains metadata, digest, excerpts, decisions and tasks. It does not contain the original file or full decoded content.

## Explicit non-capabilities

v0.8 does not:

- upload evidence files or persist them on a server;
- save the original file or full decoded text;
- parse PDF, Word, Excel, image or archive content;
- run OCR, macros, scripts or embedded content;
- query certification bodies, company registries, product databases or external websites;
- verify a certificate number, issuer, product scope, expiry or supplier identity;
- convert filename matching into evidence identity;
- create a verified supplier response or formal submission;
- score or rank suppliers;
- decide tender or supplier eligibility;
- create an award, order, payment, financing, insurance, logistics or customs action.
