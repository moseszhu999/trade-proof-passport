# RWP External Adoption Pilot Kit v0.1

Status: non-normative public pilot tooling

## Purpose

This kit tests one specific question: can two independently rooted Trade Proof Passports adopt the same public Trade Pool and produce deterministic, duplicate-resistant Proof Liquidity without a central database, ranking system, identity authority, payment rail, Token claim, or chain write?

The pilot reuses the existing canonical objects only:

- Trade Proof Passport;
- RWP Card;
- RWP Request and Request Response;
- RWP Evidence Package and Evidence Receipt;
- RWP Case Graph;
- Proof Pattern and Trade Pool;
- Pool Adoption Receipt and Adoption Card;
- Proof Liquidity Snapshot and Card;
- Pool Directory and Directory Card.

The pilot pack itself is not a new protocol object. It has no schema, protocol identifier, canonical digest, registry owner, database table, RPC, or authority semantics.

## Acceptance flow

```text
source Passport
→ source full-artifact Case Graph
→ Proof Pattern
→ public Trade Pool

adopter Passport A
→ independent full-artifact Case Graph A
→ verified Pool Adoption Receipt A
→ privacy-bounded Adoption Card A

adopter Passport B
→ independent full-artifact Case Graph B
→ verified Pool Adoption Receipt B
→ privacy-bounded Adoption Card B

Card A + Card B + duplicate Card B
→ duplicate-resistant Proof Liquidity Snapshot
→ two verified adoption units
→ one rejected duplicate
→ one non-ranked open Directory entry
```

## Fixed acceptance conditions

A valid v0.1 pilot must prove all of the following:

1. the two adopter Passport roots differ from the Pool source Passport root;
2. the two adopter Passport roots differ from each other;
3. both submitted artifact bundles rebuild their exact Case Graph digests;
4. both Adoption Receipts use `full_artifact_bundle` observability;
5. both Adoption Receipts resolve to `verified_adoption`;
6. both Adoption Receipts remain `proofLiquidityEligible=true`;
7. both Adoption Receipts contain zero `notSatisfied` and zero `notObservable` checks;
8. three submitted Adoption Cards yield exactly two unique Cards;
9. the duplicate is excluded across Card, Receipt, Graph, and Passport dimensions;
10. the Proof Liquidity Snapshot reports exactly two verified adoption units;
11. the open Directory contains one Pool entry reporting those two units;
12. Directory entries are not endorsements and no ranking is provided;
13. page views, empty forks, stars, and pull requests count as zero.

## Local CLI

Prepare three complete Passport JSON files:

```text
source-passport.json
adopter-one-passport.json
adopter-two-passport.json
```

The adopter Passports must represent independently rooted cases. Then run:

```bash
node tools/build-rwp-external-adoption-pilot.mjs \
  source-passport.json \
  adopter-one-passport.json \
  adopter-two-passport.json \
  /tmp/rwp-external-adoption-pilot.json
```

The command builds the existing workflow objects, validates the complete pilot, and writes a local full-artifact pack. Validation fails closed if roots are reused, graph reconstruction changes, Pool rules are not fully observable, either adoption is not verified, or aggregate counts do not match.

## Browser workflow

Open `/rwp-pilot.html` and select the same three Passport files. Processing stays in the browser. The page provides two downloads:

- complete local pilot pack — includes full artifacts and must not be published unless every field is safe and authorized for public release;
- public projection — contains only protocol IDs, digests, aggregate counts, assurance language, and fixed boundaries.

The browser also includes a synthetic demo using the repository's public steel-cabinet fixture.

## Public contribution workflow

A contributor may fork the repository and submit only public-safe material. The recommended pull request evidence is:

```text
- exact source/adopter input provenance;
- statement that every submitted field is synthetic, already public, or explicitly authorized;
- local CLI PASS output;
- public CI exact-head PASS;
- public projection digest summary;
- confirmation that no private commercial evidence was committed.
```

A merged pull request is not itself an adoption unit. Adoption units are counted only from unique, validated, Proof-Liquidity-eligible Adoption Cards.

## Privacy boundary

Do not commit or publish:

- private company or personal identifiers;
- real bank accounts, prices, unit prices, margins, or payment details;
- secure data-room links or delivery endpoints;
- raw invoices, purchase orders, inspection files, customs files, or logistics documents unless explicitly authorized for public release;
- credentials, wallet secrets, signatures, private keys, API tokens, or authentication material.

For real confidential workflows, keep the complete pilot local. The current public projection does not prove the private source bundle to an uninvolved third party. Selective disclosure, multi-party witnesses, signatures, or zero-knowledge mechanisms remain future work and are not claimed by v0.1.

## Fixed boundaries

The pilot provides:

- local file processing only;
- public or explicitly authorized data only;
- deterministic reconstruction of existing objects;
- duplicate-resistant protocol-adoption counts;
- a non-ranked open Directory projection.

The pilot does not provide:

- a central adoption database;
- identity authentication;
- attestation authority;
- legal, customs, inspection, insurance, credit, or financing approval;
- reputation, ranking, or scoring;
- payment, settlement, collateral, or asset transfer;
- RWA issuance or Token entitlement;
- wallet operation or chain write;
- proof of absolute real-world truth.
