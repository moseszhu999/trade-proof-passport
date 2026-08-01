# TradeProof

[![Validate Trade Proof Passport](https://github.com/moseszhu999/trade-proof-passport/actions/workflows/validate.yml/badge.svg)](https://github.com/moseszhu999/trade-proof-passport/actions/workflows/validate.yml)

**Proof for trade. Ownership for contributors.**

## Before Real-World Assets, there must be Real-World Proof

**TradeProof is the open, agent-native Real-World Proof protocol, starting with global trade.**

RWA represents value. RWP records how a real-world claim was formed, what evidence supports it, where the claim came from, which responsible roles confirmed or disputed it, which version is current, and what may be disclosed.

```text
Trade creates value.
RWP makes it credible.
Agents make it scalable.
DAO makes the protocol ownable.
```

Trade Proof Passport is the first trade-domain carrier of RWP Core:

```text
Claim
+ Evidence
+ Provenance
+ Confirmation
+ State
+ Disclosure
+ Digest
+ History
```

RWP does not claim absolute truth. It makes claims, sources, responsibility and history independently inspectable.

## Live product

- Project site: `https://moseszhu999.github.io/trade-proof-passport/`
- RWP Core + Viral Proof Cards: `https://moseszhu999.github.io/trade-proof-passport/rwp.html`
- Create a Passport: `https://moseszhu999.github.io/trade-proof-passport/create.html`
- Import and share: `https://moseszhu999.github.io/trade-proof-passport/view.html`
- Respond: `https://moseszhu999.github.io/trade-proof-passport/respond.html`
- Anchor and verify: `https://moseszhu999.github.io/trade-proof-passport/onchain.html`
- Token economics: `https://moseszhu999.github.io/trade-proof-passport/tokenomics.html`
- Genesis Proof simulator: `https://moseszhu999.github.io/trade-proof-passport/genesis.html`
- Synthetic example: `https://moseszhu999.github.io/trade-proof-passport/example.html`

No account or wallet is required to create a Passport, generate a bounded Proof Card or verify local JSON.

## Product loop

```text
Create a local Trade RWP Passport
→ attach evidence references and field-level provenance
→ create a privacy-bounded share link
→ counterparty confirms, rejects or requests a change
→ generate a standard Response object
→ optionally anchor the exact canonical digest on Base Sepolia
→ generate a Viral Proof Card containing no source secrets
→ recipient inspects, requests authorized evidence or creates another RWP
```

The useful viral event is not a page view or social impression. It is a distinct recipient entering another real workflow and producing a new proof object or responsible response.

## Your data stays with you

TradeProof is not a central trade-data platform.

```text
local files / ERP / logistics events
→ local or holder-controlled Agent
→ candidate claims and provenance
→ responsible-role review
→ portable Passport
→ bounded disclosure
→ public digest and state
```

A Viral Proof Card excludes:

- organization and personal names;
- party identifiers;
- private fact statements;
- source-document contents;
- evidence URIs and evidence digests;
- commercial prices and bank details;
- private confirmation notes.

The public promise is:

> **Your trade data stays with you. Share proofs, not secrets.**

## RWP Provenance v0.1

The optional `provenance[]` collection connects a fact to an evidence record and a field-level locator:

```text
provenanceId
factId
evidenceId
locator: page / field / cell / JSON Pointer / event ID
extraction: manual / document parser / system event / agent assisted
review: responsible reviewer + time
```

Agents may extract, reconcile and propose candidate mappings. They may not invent evidence, silently resolve conflicts or become an authorized real-world party merely by generating text.

The canonical draft is:

```text
standard/real-world-proof-core-v0.1.md
```

## RWP, RWA, Agent and DAO

```text
real-world event
→ RWP claim, evidence, provenance and confirmation
→ established asset or right candidate
→ optional RWA projection
→ optional finance, insurance or capital workflow
```

The DAO may govern schemas, canonicalization profiles, Trade Pools, Hooks, connectors, grants and Treasury policy.

It cannot vote a shipment, inspection, warehouse event, invoice, acceptance or legal right into existence.

```text
DAO governance != real-world truth
Token balance != evidence validity
```

## Canonical Base Sepolia Registry

```text
TradeProofRegistry: 0xad1c714140ceb8ed7c5234d939a06926f5edaba2
Chain ID: 84532
Registry block: 44891502
```

The Registry records canonical Passport and Response digests, issuer wallet, block timestamp, schema/profile hashes, supersession links and revocation state. It stores no source document and does not prove identity, authority, legal effect or objective truth.

## TPROOF economic constitution

### Deployed economic stack

```text
TPROOF:            0xd0a60427482C2cBE1C6566772DC5838AA06DED80
Contribution:      0xcb33eA69dDa48f2A345Fc1F2A3B85f329a5eb1E0
Season Allocation: 0x0bFd6CEab5dB51d7B53789484ECD147B10D7fC65
Team Vesting:      0x65Ab9CE997975f18b6a06957D75AA5a00b3dc467
```

Canonical Solidity source and deployment evidence live in:

```text
https://github.com/moseszhu999/chaintrace-contracts
```

`$TPROOF` is **not live** as a public claim, sale, market or liquidity product.

```text
Maximum supply: 1,000,000,000 TPROOF
Post-genesis mint: disabled
Community allocation: 45% over eight years
Genesis Proof pool: 1% / 10,000,000 TPROOF
Core-team vesting: 12-month cliff + 48-month linear vesting
Public claim: false
Public sale: false
Liquidity pool: false
Mainnet authorization: false
```

**Economics as code** means supply, allocations, anti-Sybil zeros, seasonal rules and launch boundaries remain machine-verifiable rather than editable marketing claims.

TPROOF is not evidence and cannot make a Passport valid. It is designed for contribution economics, protocol governance, public-goods grants, proposal/challenge bonds and sponsored proof infrastructure.

**Token state must never determine whether a Passport or Response is valid**, current, revoked or superseded.

## Contribution before liquidity

The planned economic loop is:

```text
useful proof action
→ independent counterparty response or reusable public infrastructure
→ verified Contribution Receipt
→ seasonal Proof Points
→ reviewed seasonal TPROOF allocation
→ DAO-funded standards, connectors and public goods
→ more useful RWP adoption
```

No points are awarded for:

- page views;
- wallet connections;
- empty social posts;
- copied Proof Cards;
- self-responses;
- duplicate artifacts;
- repeated wash activity between the same wallet pair.

The scarce resource is not closed code. It is verified participation: real counterparty confirmations, accepted proof patterns, durable provenance history, reliable connectors and active trade corridors.

### Public allocation data, not a private eligibility database

The browser and Node compiler deterministically transform public closed-season Points into square-root allocations, Solidity-compatible leaves, Merkle proofs, a Merkle root and a canonical dataset digest.

```bash
node tools/compile-season-allocation.mjs examples/genesis-proof-allocation-input.json
```

The shared browser implementation is:

```text
docs/season-allocation.mjs
```

The compiler does not create eligibility, fund a Season or activate a claim.

## Verify locally

```bash
git clone https://github.com/moseszhu999/trade-proof-passport.git
cd trade-proof-passport
node tools/verify-passport.mjs examples/steel-cabinet-passport.json
node tools/verify-rwp-core.mjs
node tools/validate-rwp-page.mjs
node tools/verify-registry-client.mjs
node tools/verify-tokenomics.mjs
node tools/verify-season-allocation.mjs
node tools/compile-season-allocation.mjs examples/genesis-proof-allocation-input.json
```

Expected Passport output includes:

```text
PASS: tpp:example:steel-cabinet:001
Facts: 3
Evidence records: 4
Provenance records: 4
Confirmations: 3
```

## Repository structure

```text
standard/real-world-proof-core-v0.1.md
standard/trade-proof-passport-v0.1.md
standard/trade-proof-response-v0.1.md
standard/tproof-token-economics-v0.1.md
schema/trade-proof-passport.schema.json
schema/trade-proof-response.schema.json
tokenomics/tproof-tokenomics-v0.1.json
examples/steel-cabinet-passport.json
tools/verify-passport.mjs
tools/verify-rwp-core.mjs
tools/validate-rwp-page.mjs
docs/rwp-card.mjs
docs/rwp.html
docs/season-allocation.mjs
docs/create.html
docs/view.html
docs/respond.html
docs/onchain.html
docs/tokenomics.html
docs/genesis.html
```

## Design principles

1. **RWP is the core** — claims, evidence, provenance, responsibility and history come before RWA.
2. **Useful before the Token** — Passport creation, Proof Cards and verification work without TPROOF.
3. **Holder-controlled** — source data remains with its holder or chosen infrastructure.
4. **Viral through workflow** — sharing invites a responsible response or another useful RWP, not empty impressions.
5. **Agent-scaled, protocol-constrained** — Agents compile candidates; deterministic rules and accountable reviewers establish state.
6. **DAO-owned, truth-independent** — governance owns infrastructure but cannot manufacture facts.
7. **Onchain integrity, not automatic truth** — the Registry proves chronology and digest identity.
8. **Portable and open** — anyone may fork the frontend, reproduce a digest or build another client.
9. **Contribution before liquidity** — verified network value precedes Token distribution.
10. **Trade first, not trade only** — global trade is the first domain for the general RWP category.

## Permanent boundaries

TradeProof does not currently provide:

- a public Token claim, sale, market or liquidity pool;
- payment, settlement, lending or disbursement;
- custody or asset tokenization;
- customs, legal, insurance, financing or regulatory approval;
- identity or organizational-authority verification;
- automatic truth or reputation scoring;
- public disclosure of private commercial documents;
- a guarantee that an RWP forms a legally valid RWA.

TPROOF provides no ownership of trade goods, invoices, receivables or payments, and no revenue share, dividend, guaranteed yield, redemption promise or guaranteed price support.

## License

MIT for the public drafts, examples, site and helper tools.
