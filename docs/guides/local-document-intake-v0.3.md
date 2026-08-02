# Controlled Local Document Intake v0.3

## Purpose

Allow a Trade Case holder to bring selected local documents into the daily workspace without uploading them to TradeProof or pretending that unsupported binary files have been parsed.

```text
holder selects local file
→ classify before reading
→ allowlisted text format: read in current browser
→ normalize and digest source text
→ create bounded requirement or action candidates
→ register file metadata and adapter state
→ save back to holder-controlled Trade Case
→ human reviews every candidate
```

## Supported local text formats

The adapter may read only files within the 2 MiB limit whose extension or MIME type is allowlisted:

- TXT;
- Markdown;
- CSV;
- JSON;
- EML;
- XML.

JSON must parse as valid JSON. EML processing is deliberately shallow: selected headers and the message body are represented as local text. The adapter does not fetch linked content or attachments.

## Metadata-only formats

PDF, Word, Excel, images, archives and other unsupported files remain metadata-only.

For these files the adapter records:

- file name;
- MIME type;
- size;
- modified time;
- adapter state and reason.

It does not call the file text reader, OCR the file, execute macros, extract archives or upload the content.

## Source digest and storage

For an allowlisted text file the adapter computes SHA-256 over the complete normalized source text. The Trade Case may retain at most 120,000 characters of text. If the source is longer:

- `sourceContentDigest` still identifies the complete normalized source text;
- `truncated=true` is visible;
- only the bounded prefix is stored in the local case.

The case remains protected by its existing deterministic `caseDigest`.

## Requirement and action boundary

Files classified as official notice, specification or requirement text use the existing deterministic requirement-candidate parser.

Files classified as EML or explicitly selected as email/message use the existing action-candidate parser.

All extracted items remain:

```text
candidate_unconfirmed
humanConfirmationRequired = true
formalWritePerformed = false
```

No extraction result is automatically treated as an authentic, complete, current or legally applicable requirement.

## Privacy and execution boundary

- processing occurs in the holder's current browser;
- no network request is made by the local intake core or its UI;
- no document is uploaded;
- no external message is sent;
- no contact is disclosed;
- no supplier eligibility decision is made;
- no RFQ, quotation, contract, payment, settlement, financing, insurance or customs action is executed;
- personal data in EML or other text remains the holder's responsibility to minimize and handle lawfully.

## Field semantics

The existing v0.2 `fileReferences.contentRead=false` field continues to describe the metadata-only behavior of the original Trade Case file-reference owner. v0.3 adds explicit adapter fields:

```text
adapterContentReadLocally = true | false
binaryDocumentParsingPerformed = false
uploaded = false
```

This prevents a text adapter read from being confused with PDF/Office parsing or cloud upload.

## Page

```text
docs/document-intake.html
```

The page reads and writes the same holder-controlled localStorage case used by `docs/operations.html` and supports digest-validated Trade Case import/export.

## Deferred work

- PDF text extraction;
- DOCX and XLSX parsing;
- OCR;
- encrypted workspace storage;
- team access and audit;
- authorized email connector;
- malware scanning;
- supplier discovery and response comparison.
