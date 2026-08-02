# Real-World Proof Evidence Resolution v0.1

## Status

Open draft for deterministic local tooling. This draft does not create identity, legal authority, payment, settlement, financing, custody, asset issuance, Token distribution, liquidity or mainnet execution.

## Purpose

An Evidence Resolution appends a bounded correction workflow after a recipient has issued an Evidence Receipt with one of these outcomes:

```text
incomplete
mismatch
request_more
```

It never edits or deletes the prior Evidence Package or Receipt.

```text
Evidence Package
→ Evidence Receipt records the problem
→ Evidence Resolution Package references both
→ recipient rechecks delivered files
→ Resolution Receipt records resolved / unresolved / request_more
```

## Resolution modes

### `redelivery`

Re-delivers a record that already existed in the prior Evidence Package but was recorded as:

```text
mismatch
missing
not_checked
unsupported_algorithm
```

The evidence identifier and digest remain the same. The holder must locally verify the new file bytes against the Passport digest before generating the Resolution Package.

### `supplemental`

Adds a Passport evidence record that was not in the prior Evidence Package but belongs to an evidence category already authorized by the original Holder Response.

A supplement cannot introduce a new category or expand the original authorization.

### `combined`

Contains both redelivered and supplemental evidence records.

## Source chain

Every Resolution Package binds to:

```text
prior Package ID and digest
prior Receipt ID and digest
Passport digest
Proof Card digest
Request ID and digest
Holder Response ID and digest
Resolution ID and digest
```

Every Resolution Receipt additionally binds to:

```text
Resolution ID and digest
Resolution Receipt ID and digest
```

## Historical invariants

1. The prior Package remains valid as a historical object.
2. The prior Receipt remains valid as the recipient's historical observation.
3. A Resolution Package does not replace either object.
4. New evidence cannot erase an earlier mismatch.
5. A later resolved receipt means the appended resolution was accepted, not that the earlier mismatch never occurred.
6. Digest lineage is append-only.

## Holder-side requirements

Before a Resolution Package can be generated:

1. the prior Package must pass canonical validation;
2. the prior Receipt must match that Package;
3. the complete Passport must reproduce the prior Package `passportDigest`;
4. the prior Receipt must not already be deterministically `received` without a further request;
5. every selected evidence category must remain inside the original Response authorization;
6. every selected local file must be recomputed and match its Passport evidence digest;
7. every selected record must address a recorded issue.

## Issue model

Evidence-record issues use:

```text
evidence:<evidenceId>
```

Missing-category issues use:

```text
category:<authorizedCategory>
```

A `request_more` receipt with no deterministic file issue uses:

```text
request:additional
```

The private Resolution Package records addressed and unresolved issue keys. These keys never enter the public Resolution Card.

## Package completeness

```text
resolution.complete = true
```

means the holder selected locally matched evidence addressing every issue recorded from the prior Receipt and Package coverage.

It does not mean the recipient received the files.

## Recipient re-verification

The recipient imports the Resolution Package and independently checks received files locally.

Item states are:

```text
matched
mismatch
missing
not_checked
unsupported_algorithm
```

The deterministic Resolution Receipt status is:

```text
resolved
```

only when:

1. `resolution.complete` is true;
2. every Resolution evidence record is present;
3. every local file digest matches.

Otherwise it is:

```text
unresolved
```

A recipient may issue `request_more`, but the receipt preserves the deterministic `resolved` or `unresolved` status separately.

## Private and public objects

### Private Resolution Package

May contain:

```text
evidence identifiers
categories and types
digests
redelivery / supplemental relation
holder-side local file verification
addressed and unresolved issue keys
full source lineage
```

It moves only through an independently authorized business channel.

### Private Resolution Receipt

May contain per-record received-file results and computed digests. It is downloaded locally and is never encoded in a public URL.

### Public Resolution Card

Contains only:

```text
Resolution digest
prior Receipt digest
Resolution Receipt ID and digest
receiver role category
resolved / unresolved / request_more
aggregate result counts
whether prior issues were fully addressed
card ID and digest
```

It must exclude:

```text
evidence identifiers
file names
source-document bytes
evidence or computed file digests
organization or personal names
party identifiers
delivery endpoints
commercial details
```

## Agent boundary

Agents may:

- identify prior issue categories;
- propose eligible redelivery and supplemental records;
- recompute local digests;
- detect coverage gaps;
- compile deterministic objects.

Agents may not:

- silently erase a mismatch;
- invent an evidence record;
- expand authorization;
- mark a Resolution Receipt resolved without matching files;
- become an authorized real-world party by generating text.

## DAO and Token boundary

```text
DAO vote != evidence resolution
Token balance != file validity
```

No governance vote or TPROOF holding can change a digest mismatch into a match.

## Assurance

A Resolution object proves only the integrity and lineage of the recorded statements. It does not prove identity, authority, legal delivery, document authenticity, ownership, title, RWA validity or objective real-world truth.
