# Trade Case Intake and Persistence v0.2

## Purpose

Extend the Trade Daily Operations Hub from a disposable browser draft into a holder-controlled, portable Trade Case without introducing a central private-data store.

```text
public Opportunity
→ holder-controlled Trade Case
→ paste official notice text locally
→ deterministic requirement candidates
→ trusted-human confirm or reject
→ paste email/message locally
→ action candidates
→ register file metadata only
→ case queue and daily close
→ export/import tamper-evident JSON
```

## Case persistence

The current implementation uses browser `localStorage` for continuity and JSON export/import for backup and portability.

It does **not** claim:

- server persistence;
- team synchronization;
- account recovery;
- external delivery;
- formal buyer or supplier acknowledgement;
- formal eligibility or award status.

Every case is sealed with a deterministic SHA-256 digest. Import validation rejects a case whose content no longer matches its digest.

## Official notice intake

The holder may paste official notice text or selected paragraphs. A deterministic local parser identifies bounded candidate categories such as:

- deadline and submission;
- eligibility, consortium and subcontracting;
- technical standards;
- quantities and lots;
- delivery and installation;
- certificates and experience;
- commercial terms;
- sample, testing and quality;
- clarification and response actions.

Every extracted item starts as:

```text
status = candidate_unconfirmed
officialRequirement = false
humanConfirmationRequired = true
```

Only an explicit holder-human decision can mark the item `confirmed_in_supplied_source`. That confirmation means only that the requirement appears in the holder-supplied source text. It does not prove the source is complete, current, authentic, translated correctly, or legally applicable.

## Email and message intake

The holder may paste email or message text. Processing remains local. The parser may generate action candidates, but it cannot:

- send or reply to a message;
- disclose contact information;
- infer sender identity;
- treat a request as a contractual commitment;
- create a formal business record outside the local case.

Email or message text may contain personal information. The holder remains responsible for lawful handling and minimization.

## File boundary

The browser records only:

```text
name
MIME type
size
lastModified
contentRead = false
uploaded = false
```

No file content, OCR, archive extraction, document parsing or upload occurs in this slice.

## Agent and action boundary

Agent-derived requirement and action candidates remain review items. The core module performs no network request and no external write. All outputs keep `formalWritePerformed=false`.

## Next owners

1. encrypted holder-controlled workspace storage;
2. authorized team access and audit;
3. real document parsing under explicit holder control;
4. email connector with consent, minimization and case routing;
5. supplier discovery and response comparison;
6. TradeProof evidence and confirmation handoff;
7. formal Daily Log and relationship history.
