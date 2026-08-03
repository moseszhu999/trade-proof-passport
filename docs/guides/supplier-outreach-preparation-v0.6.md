# Supplier Outreach Preparation v0.6

## Purpose

This slice adds a bounded contact-release and outreach-preparation layer after the supplier response request is ready:

```text
holder-selected supplier candidate
+ holder-supplied contact
+ exact local disclosure approval
+ unified supplier response request
→ holder-local outreach draft
→ holder-local .eml export
→ user reviews and sends in their own mail client
```

It does not scrape contact details, look up contacts, verify an email address, connect to Gmail or Outlook, send a message, create a formal RFQ, or create a formal supplier shortlist.

## Contact source boundary

Contact records use:

```text
schemaVersion = tradeproof.supplier-contact-book.v0.6
state = holder_local_private
sourcePolicy = holder_supplied_only
contactVerified = false
scrapingPerformed = false
externalLookupPerformed = false
serverPersistencePerformed = false
formalWritePerformed = false
```

The UI stores the contact in browser localStorage. Before approval, only a masked address is shown. This is a product disclosure control, not cryptographic secrecy: a person with access to the browser storage can inspect local data.

## Disclosure approval

The holder must enter the exact phrase:

```text
APPROVE CONTACT DISCLOSURE
```

The resulting approval is limited to:

```text
scope = prepare_outreach_draft_only
contactDisclosureApproved = true
draftGenerationApproved = true
externalSendApproved = false
externalSendPerformed = false
formalSubmissionPerformed = false
```

The approval permits the current browser to reveal the contact and prepare a draft. It is not permission to send.

## Outreach draft

The generated draft uses:

```text
schemaVersion = tradeproof.supplier-outreach-draft.v0.6
state = holder_local_approved_draft
recipientDisclosurePerformed = true
externalSendApproved = false
externalSendPerformed = false
formalSubmissionPerformed = false
attachmentUploadPerformed = false
responseTemplateAttachmentRequired = true
rankingGenerated = false
supplierEligibilityDecided = false
```

The body explains that the message is an information request, not an award, purchase order, contract, eligibility decision, or transaction commitment.

## EML export

The page can generate a local RFC 822 `.eml` file containing:

- recipient address;
- optional Reply-To;
- subject;
- plain-text body;
- `X-TradeProof-State: holder-local-draft`;
- `X-TradeProof-External-Send-Performed: false`.

Creating or downloading this file is not a send action. The holder must open it in their own email client, inspect it, attach the supplier response template manually, and choose whether to send.

## Page

`docs/supplier-outreach.html`

It reads:

- `tradeproof.trade.case.v0.2`;
- `tradeproof.supplier.review.v0.4`;
- `tradeproof.supplier.response.request.v0.5`;
- the bounded public supplier candidate collection.

It stores:

- `tradeproof.supplier.contact.book.v0.6`;
- `tradeproof.contact.disclosure.approvals.v0.6`;
- `tradeproof.supplier.outreach.drafts.v0.6`.

## Explicit non-capabilities

v0.6 does not:

- scrape or purchase contact lists;
- search company websites for email addresses;
- verify that an address belongs to the supplier;
- disclose contacts before exact holder approval;
- connect to Gmail, Outlook, SMTP, WhatsApp, WeChat, or platform messaging;
- automatically send or schedule outreach;
- attach or upload files;
- record a message as delivered or received;
- create a formal RFQ, offer, quotation, shortlist, award, contract, order, payment, financing, insurance, logistics, or customs action;
- score, rank, or decide supplier eligibility.
