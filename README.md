# Trade Proof Passport

A portable, machine-readable proof package for real-world trade.

Trade Proof Passport is an early community draft for packaging selected trade facts, evidence references, confirmations, versions, and lifecycle status into one portable JSON object.

The goal is practical:

> Send one reviewable proof package instead of repeatedly forwarding disconnected files and explanations.

## Why this exists

Trade evidence is usually fragmented across email, chat, PDFs, spreadsheets, logistics systems, inspection reports, and multiple organizations. A receiver often has to reconstruct:

- what the trade is about;
- which facts are being asserted;
- what evidence supports each fact;
- who confirmed or rejected it;
- which version is current;
- whether an earlier fact was superseded or revoked.

This repository explores a small open format for carrying that information together.

## Current status

`v0.1` is a **community draft for experimentation**. It is not an official international standard, legal document, compliance approval, financing approval, title instrument, payment instrument, token, or settlement system.

The first example is a synthetic steel-cabinet shipment passport.

## Repository structure

```text
standard/trade-proof-passport-v0.1.md
schema/trade-proof-passport.schema.json
examples/steel-cabinet-passport.json
tools/verify-passport.mjs
```

## Quick start

```bash
node tools/verify-passport.mjs examples/steel-cabinet-passport.json
```

The verifier performs a small set of structural and reference-integrity checks. It does not verify legal validity, issuer authority, identity, digital signatures, or the truth of a trade fact.

## Design principles

1. **Useful without blockchain** — the core object is ordinary JSON.
2. **Cryptography-ready** — evidence digests and optional proof envelopes can be added without changing the basic trade facts.
3. **Privacy-preserving by default** — sensitive source documents do not need to be public or placed on-chain.
4. **Versioned and reversible** — facts can be superseded, disputed, expired, or revoked.
5. **Multi-party** — confirmations identify the party, role, decision, time, and fact version being addressed.
6. **Portable** — the same package can be rendered as a web page, shared by link, processed by an agent, or wrapped as a verifiable credential.

## Standards direction

This draft is designed to learn from, not replace:

- UN/CEFACT Verifiable Trade Documents;
- UN Transparency Protocol Digital Product Passport work;
- W3C Verifiable Credentials Data Model 2.0;
- JSON Schema.

Future versions should map fields to established trade vocabularies rather than invent unnecessary synonyms.

## Boundaries

This project does not perform:

- payments or settlement;
- token issuance or movement;
- financing approval;
- customs, legal, insurance, or regulatory approval;
- automatic trust or reputation scoring;
- public disclosure of private commercial documents.

## License

MIT for the public draft, examples, and helper tools.
