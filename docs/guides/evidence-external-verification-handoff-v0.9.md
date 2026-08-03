# Evidence External Verification Handoff v0.9

## Purpose

This slice turns holder-confirmed source fields from the v0.8 evidence queue into a bounded external-verification handoff:

```text
confirmed_in_local_file findings
→ holder-local verification task
→ exact export approval
→ digest-and-field-only handoff package
→ holder sends through an external channel
→ external receipt JSON returns
→ digest / task / field reconciliation
→ supported | contradicted | inconclusive candidate assessment
→ holder review
```

It does not connect to a certification body, registry, testing laboratory, inspection provider, email service, or another external runtime.

## Task eligibility

Only v0.8 findings with:

```text
state = confirmed_in_local_file
sourceConfirmed = true
evidenceVerified = false
```

may enter a verification task. `candidate_unconfirmed` findings are rejected.

## Handoff package

The holder must enter the exact phrase:

```text
APPROVE VERIFICATION HANDOFF
```

The exported package contains:

- Case / Request / Supplier / Evidence identifiers;
- evidence SHA-256 digest;
- file name, media type, and size;
- selected field names, claimed values, and bounded source excerpts;
- holder-entered verifier name, type, contact reference, and instructions.

It does not contain the original file or full content. Exporting the package is not an external send.

## Receipt template

The blank receipt binds the verifier response to:

- `taskId`;
- `evidenceId`;
- `contentDigest`;
- every requested finding ID and field.

Allowed field outcomes are:

- `supported`;
- `contradicted`;
- `inconclusive`.

Every receipt remains:

```text
receiptClassification = external_verification_receipt_unverified
verifierIdentityVerified = false
receiptAuthenticityVerified = false
evidenceVerified = false
formalSubmissionPerformed = false
```

## Receipt reconciliation

A receipt is rejected if its task, evidence, digest, finding IDs, or field names do not match the local task. A valid structural match does not prove that the verifier is genuine or authorized.

The local candidate assessment is computed conservatively:

- any contradicted field → `contradicted`;
- all fields supported → `supported`;
- otherwise → `inconclusive`.

The holder must enter:

```text
CONFIRM VERIFICATION RECEIPT REVIEW
```

to record that the receipt was manually reviewed. This still leaves `evidenceVerified=false`.

## Explicit non-capabilities

v0.9 does not:

- call or search an external verifier;
- send a verification request;
- verify the verifier identity, authority, domain, signature, or receipt authenticity;
- include or upload the original evidence file;
- automatically trust a supported result;
- upgrade a supplier to verified, eligible, approved, shortlisted, or awarded;
- score or rank suppliers;
- create an order, payment, financing, insurance, logistics, customs, or settlement action.
