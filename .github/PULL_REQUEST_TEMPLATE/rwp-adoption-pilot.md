## RWP External Adoption Pilot contribution

### External origin

- [ ] This pull request originates from my fork, not from a branch in the base repository.
- [ ] I am not submitting project-owner synthetic acceptance output as an external candidate.
- [ ] All changes are inside one new `examples/rwp-adoption-pilots/<slug>/` directory.

### Required files

- [ ] `pilot.json` is the complete validated public Pilot pack.
- [ ] `public-projection.json` exactly matches `pilot.json.publicProjection`.
- [ ] The optional `README.md` states that the material is public or explicitly authorized.
- [ ] This pull request changes no code, workflow, schema, existing contribution, or unrelated file.

### Data authority

- [ ] Every committed field is synthetic, already public, or explicitly authorized for public release.
- [ ] No private commercial evidence, personal data, credentials, bank details, private prices, secure-room links, wallet secrets, seed phrases, private keys, or delivery endpoints are included.

### Independent roots and deterministic validation

- [ ] Source and adopter Passport roots differ.
- [ ] Adopter A and adopter B Passport roots differ.
- [ ] I used two explicitly supplied adopter Passports, not the built-in synthetic default.
- [ ] The builder produced both files:

```bash
node tools/build-rwp-external-adoption-pilot.mjs \
  <source> \
  <adopter-a> \
  <adopter-b> \
  pilot.json \
  public-projection.json
```

- [ ] Both Adoption Receipts use `full_artifact_bundle`.
- [ ] Both are `verified_adoption` and Proof Liquidity eligible.
- [ ] The Snapshot reports two verified units and excludes one duplicate.
- [ ] The Directory contains one non-ranked, non-endorsement Pool entry.
- [ ] Public external-submission CI passes on the exact fork head.

### Boundary confirmation

- [ ] A fork, page view, star, pull request, merge, or GitHub identity counts as zero adoption units.
- [ ] GitHub provenance is transport provenance only, not identity authentication or attestation.
- [ ] This contribution creates no new protocol schema, canonical ID, digest owner, table, RPC, identity authority, attestation, endorsement, score, ranking, payment, Settlement, RWA, Token right, wallet action, or chain write.
