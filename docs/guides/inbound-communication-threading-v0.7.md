# Inbound Communication Threading v0.7

## Purpose

This slice brings supplier-returned email back into the same holder-controlled Trade Case:

```text
holder imports local .eml
→ local MIME/header parsing
→ candidate Case / Request / Supplier association
→ inbound_email_unverified timeline event
→ attachment metadata only
→ action candidates and structured-response signal
→ human review
```

It does not connect to an inbox, download remote content, verify the sender, read attachments, automatically import a supplier response, send a reply, or create a formal submission.

## Event contract

```text
schemaVersion = tradeproof.inbound-communication-event.v0.7
state = holder_imported_unverified
evidenceClassification = inbound_email_unverified
senderIdentityVerified = false
supplierIdentityVerified = false
attachmentContentRead = false
attachmentDownloaded = false
externalNetworkAccessPerformed = false
automaticReplyPerformed = false
formalSubmissionPerformed = false
```

## Association states

- `header_bound_unverified`: matching TradeProof Case, Request and Candidate headers are present;
- `request_reference_match_unverified`: a Case or Request reference appears in headers, subject or body;
- `contact_address_match_unverified`: sender address matches a holder-entered local contact;
- `unmatched_needs_review`: no bounded association signal is available.

All states require human review. Address matching is not identity verification.

## MIME boundary

The local parser supports bounded RFC 822/MIME handling for:

- unfolded headers;
- encoded subject/display-name words;
- text/plain and text/html body candidates;
- simple base64 and quoted-printable text parts;
- multipart boundaries;
- attachment metadata.

For attachments it records only:

- file name;
- media type;
- content-transfer encoding;
- observed encoded byte count.

It does not decode, retain, upload, open, OCR, execute, or externally download attachment content.

## Structured response signal

The model may expose:

- `body_contains_structured_response_candidate` when the body contains the v0.5 schema marker;
- `attachment_metadata_suggests_structured_response` when an attachment filename suggests a response JSON;
- `no_structured_response_signal` otherwise.

A signal does not import the response and is not a formal supplier submission.

## Local timeline

```text
schemaVersion = tradeproof.inbound-communication-timeline.v0.7
state = holder_local_private
serverPersistencePerformed = false
externalNetworkAccessPerformed = false
automaticReplyPerformed = false
formalWritePerformed = false
```

Duplicate Message-ID or deterministic event ID values are not appended twice.

## Page

`docs/inbound-communications.html`

The page reads the browser-local Trade Case, supplier review, Supplier Response Request and holder contact book. It stores only the local v0.7 timeline.

## Explicit non-capabilities

v0.7 does not:

- connect to Gmail, Outlook, IMAP, SMTP, WhatsApp, WeChat or another inbox;
- fetch remote images or links from an email;
- verify a sender, domain or supplier identity;
- decode or save attachment bodies;
- automatically import a response JSON attachment;
- interpret an email as a verified quotation, formal submission, acceptance or contract commitment;
- generate or send an automatic reply;
- produce delivery/read receipts;
- rank suppliers or decide eligibility;
- create an award, order, payment, financing, insurance, logistics or customs action.
