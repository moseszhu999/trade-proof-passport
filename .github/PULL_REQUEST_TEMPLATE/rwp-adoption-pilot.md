## RWP External Adoption Pilot contribution

### Data authority

- [ ] Every committed field is synthetic, already public, or explicitly authorized for public release.
- [ ] No private commercial evidence, personal data, credentials, bank details, prices, secure-room links, wallet secrets, or delivery endpoints are included.

### Independent roots

- [ ] Source and adopter Passport roots differ.
- [ ] Adopter A and adopter B Passport roots differ.

### Deterministic validation

- [ ] `node tools/build-rwp-external-adoption-pilot.mjs <source> <adopter-a> <adopter-b> <output>` passes locally.
- [ ] Both Adoption Receipts use `full_artifact_bundle`.
- [ ] Both Adoption Receipts are `verified_adoption` and Proof Liquidity eligible.
- [ ] The Snapshot reports two verified units and excludes one duplicate.
- [ ] The Directory contains one non-ranked, non-endorsement Pool entry.
- [ ] Public CI passes on the exact PR head.

### Boundary confirmation

- [ ] This contribution creates no new protocol schema, canonical ID, digest owner, table, RPC, identity authority, attestation, score, ranking, payment, settlement, RWA, Token, wallet action, or chain write.
- [ ] A fork, page view, star, pull request, or merged pull request is not counted as an adoption unit.

### Public projection

Paste the public projection digest summary or link to a committed public-safe projection:

```json
{}
```
