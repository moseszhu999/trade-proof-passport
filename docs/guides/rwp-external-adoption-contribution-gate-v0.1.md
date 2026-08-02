# RWP External Adoption Contribution Gate v0.1

Status: non-normative repository contribution gate

## Purpose

The External Adoption Pilot Kit can generate a complete, independently rooted Pilot pack. This contribution gate adds the missing repository boundary: it distinguishes a public, externally submitted adoption candidate from the project owner's own synthetic tests.

The gate does not create a protocol object, identity authority, attestation, endorsement, ranking, score, payment, Settlement, RWA, Token right, wallet action, or chain write. It validates repository transport provenance and the existing RWP protocol objects contained in one complete public Pilot pack.

## What qualifies as an external candidate

A contribution is accepted by the gate only when all of the following are true:

1. the pull request originates from a GitHub fork whose repository differs from the base repository;
2. the pull-request author differs from the base repository owner;
3. the pull request adds one new directory under `examples/rwp-adoption-pilots/<slug>/`;
4. the pull request changes only the two required JSON files and an optional README;
5. `pilot.json` is a complete public-safe Pilot pack that passes the existing deterministic Pilot validator;
6. `public-projection.json` exactly equals the validated pack's `publicProjection`;
7. the Pilot uses two explicitly supplied adopter Passports rather than the built-in synthetic default;
8. both Adoption Receipts are `verified_adoption`, use `full_artifact_bundle`, and remain Proof Liquidity eligible;
9. the Snapshot contains exactly two verified units and rejects exactly one duplicate;
10. the Directory remains non-ranked and non-endorsement;
11. the PR, fork, page views, and stars count as zero adoption units.

GitHub fork and commit metadata are transport provenance only. They do not authenticate a legal identity or prove that a company, shipment, document, or statement is genuine.

## Required contribution directory

```text
examples/rwp-adoption-pilots/<slug>/
├── pilot.json
├── public-projection.json
└── README.md                 # optional
```

The slug must contain lowercase letters, digits, or hyphens and must be between 3 and 63 characters.

### `pilot.json`

A complete output from:

```bash
node tools/build-rwp-external-adoption-pilot.mjs \
  source-passport.json \
  adopter-one-passport.json \
  adopter-two-passport.json \
  pilot.json \
  public-projection.json
```

The complete pack is independently recomputed by trusted code from the base branch. Do not submit a confidential pack. Every field must be synthetic, already public, or explicitly authorized for public release.

### `public-projection.json`

The exact `publicProjection` emitted by the same validated Pilot pack. A hand-edited or mismatched projection fails closed.

### `README.md`

Optional human context. It must state that the material is public or explicitly authorized. It may explain the synthetic or public source, but it must not claim identity authentication, attestation, endorsement, ranking, legal approval, financing approval, or Token entitlement.

## Safe CI design

The external submission workflow uses `pull_request_target`, but it never checks out or executes code from the contributor's fork.

It:

1. checks out the exact trusted base revision;
2. reads the PR file list through the GitHub API;
3. rejects any code, workflow, schema, or unrelated path change;
4. fetches only the allowed JSON/Markdown files from the exact fork head SHA;
5. parses those files as data using trusted base-branch validators;
6. reports the validated protocol-adoption count and fixed boundaries.

The workflow has read-only repository and pull-request permissions. It performs no write-back and has no deployment, wallet, Registry, payment, or chain capability.

## Append-only rule

A contribution must add a new slug. Existing accepted contribution directories cannot be modified through this gate. Corrections require a new slug and new digests, preserving the prior public record.

This is repository append-only behavior, not a new protocol lineage or canonical Pilot identifier.

## Privacy and public-data boundary

Do not submit:

- private commercial documents or source files;
- personal data;
- bank accounts, routing numbers, IBANs, payment details, or private prices;
- credentials, API tokens, bearer tokens, passwords, wallet secrets, seed phrases, or private keys;
- secure data-room links or private delivery endpoints;
- materials that the contributor is not authorized to publish.

Confidential real-world adoption cannot be independently accepted through v0.1 because the complete source bundle remains private. The current gate does not claim selective disclosure, witness signatures, or zero-knowledge verification.

## Interpretation of a PASS

A PASS means:

- an external fork submitted one complete public Pilot pack;
- trusted base-branch code rebuilt and validated the existing RWP objects;
- the pack contains two unique verified protocol-adoption units;
- one duplicate was excluded;
- the public projection exactly matches the validated pack.

A PASS does not mean:

- the contributor's real-world identity is authenticated;
- the underlying trade facts are absolutely true;
- a company endorses the project;
- legal, customs, inspection, insurance, credit, or financing approval exists;
- the Pool or contributor has a reputation score or rank;
- any payment, Settlement, RWA issuance, Token entitlement, wallet action, or chain write occurred.

## Current status

The repository contains the gate and contribution format, but it must not claim that an external candidate exists until a qualifying fork-originated PR passes the gate and is reviewed. Project-owner synthetic tests remain internal acceptance evidence and count as zero external candidates.
