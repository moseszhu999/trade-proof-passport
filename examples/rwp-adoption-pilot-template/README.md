# External Adoption Pilot input template

This directory is a contributor aid, not a protocol schema.

Prepare three complete Trade Proof Passport JSON files outside the repository unless they are safe and authorized for public release:

```text
source-passport.json
adopter-one-passport.json
adopter-two-passport.json
```

Requirements:

- adopter roots must differ from the source root;
- adopter roots must differ from each other;
- all three Passports must pass the existing Passport verifier;
- use only synthetic, already-public, or explicitly authorized data;
- do not commit private commercial evidence, personal data, credentials, wallet secrets, prices, bank details, secure-room links, or delivery endpoints.

Build and validate locally:

```bash
node tools/build-rwp-external-adoption-pilot.mjs \
  source-passport.json \
  adopter-one-passport.json \
  adopter-two-passport.json \
  /tmp/rwp-external-adoption-pilot.json
```

The output is a non-normative acceptance pack composed entirely of existing RWP objects. It is not a new Pilot schema, identifier, digest owner, registry record, database table, RPC, attestation, ranking, payment, settlement, RWA, Token, wallet, or chain object.
