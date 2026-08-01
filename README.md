# TradeProof

[![Validate Trade Proof Passport](https://github.com/moseszhu999/trade-proof-passport/actions/workflows/validate.yml/badge.svg)](https://github.com/moseszhu999/trade-proof-passport/actions/workflows/validate.yml)

**Proof for trade. Ownership for contributors.**

TradeProof combines a useful portable trade-proof format, a browser-native multi-party response loop, an onchain integrity layer, and a machine-verifiable economic model for future contributor ownership.

## Live product

- Project site: `https://moseszhu999.github.io/trade-proof-passport/`
- Token economics: `https://moseszhu999.github.io/trade-proof-passport/tokenomics.html`
- Create a Passport: `https://moseszhu999.github.io/trade-proof-passport/create.html`
- Import and share: `https://moseszhu999.github.io/trade-proof-passport/view.html`
- Respond: `https://moseszhu999.github.io/trade-proof-passport/respond.html`
- Synthetic example: `https://moseszhu999.github.io/trade-proof-passport/example.html`

Current browser flow:

```text
Create Passport
→ create a privacy-bounded share link
→ counterparty confirms, rejects, or requests a change
→ send a standard Response object back
→ optionally anchor the exact canonical digest onchain
```

No account or wallet is required to create the initial Passport.

## Canonical testnet Registry

`TradeProofRegistry` is deployed on Base Sepolia:

```text
Address: 0xad1c714140ceb8ed7c5234d939a06926f5edaba2
Chain ID: 84532
Block: 44891502
Transaction: 0x6ffcae50367e9087c736ff5c7edd7d30483aedb0e8082488a0d8a8784cbdd31c
```

Canonical Solidity source and deployment evidence live in:

```text
https://github.com/moseszhu999/chaintrace-contracts
```

The Registry records canonical Passport and Response digests, issuer wallet, block timestamp, schema/profile hashes, supersession links and revocation state. It does not store source documents or prove that a real-world assertion is true.

## TPROOF economic constitution

`$TPROOF` is **not live**. There is no public sale, claim, price, listing, revenue share, yield, redemption promise or guaranteed return.

The economic model is now published in two synchronized forms:

```text
standard/tproof-token-economics-v0.1.md
tokenomics/tproof-tokenomics-v0.1.json
```

Verify it locally:

```bash
node tools/verify-tokenomics.mjs
```

The model separates three assets:

```text
Proof Points
  non-transferable seasonal contribution accounting

Contribution Receipts
  future non-transferable onchain contribution history

TPROOF
  future transferable utility and governance token
```

The economic loop is:

```text
useful trade-proof action
→ independent counterparty response
→ verified contribution receipt
→ seasonal Proof Points
→ seasonal TPROOF allocation
→ governance and sponsored public goods
→ more integrations, adoption and useful actions
```

Draft parameters:

```text
Maximum supply: 1,000,000,000 TPROOF
Supply policy: fixed at genesis
Post-genesis minting: disabled
Community emissions: 45% over eight years
Season length: 90 days
Genesis Proof pool: 1% / 10,000,000 TPROOF
Genesis status: reserved in draft, not claimable
Core-team vesting: 12-month cliff + 48-month linear vesting
```

Draft seasonal reward curve:

```text
wallet reward
=
season pool
× sqrt(wallet verified points)
÷ sum(sqrt(all eligible wallets' verified points))
```

The square-root curve reduces reward concentration while retaining an incentive to contribute.

No points are awarded for:

- page views;
- wallet connections;
- empty social posts;
- self-responses;
- duplicate artifacts;
- repeated wash activity between the same wallet pair.

The highest-value economic event is viral reuse: a recipient responds to a Passport and later becomes the creator of a distinct Passport for another workflow.

## Draft allocation

```text
45% community contributions             450,000,000
20% ecosystem and developer fund        200,000,000
15% core team with long vesting         150,000,000
10% real adoption incentives            100,000,000
 5% liquidity bootstrapping reserve      50,000,000
 5% security and standards reserve       50,000,000
                                        -----------
                                      1,000,000,000
```

The machine-readable verifier rejects allocation drift, a hidden post-genesis mint path, an active-sale claim, rights over trade assets, or Token control over Passport validity.

## Planned TPROOF utility

- standards and canonicalization-profile governance;
- ecosystem, integration, security and public-goods grants;
- refundable proposal bonds;
- challenge bonds under published rules;
- sponsored contribution pools;
- public-goods matching.

Token state must never determine whether a Passport or Response is valid, current, revoked or superseded. Basic Passport creation, local verification and public Registry reading remain available without TPROOF.

## Launch gates

No public offer, claim, liquidity action or admission to trading should begin until the published gates pass, including:

- reviewed `TradeProofContribution` contract;
- fixed-supply Token and vesting contracts with no hidden mint;
- source-verified testnet deployments;
- external security review;
- canonical public disclosure;
- target-jurisdiction legal review;
- published anti-Sybil and appeal rules;
- treasury multisig and timelock policy;
- community approval of final launch parameters.

## Try the Passport verifier

```bash
git clone https://github.com/moseszhu999/trade-proof-passport.git
cd trade-proof-passport
node tools/verify-passport.mjs examples/steel-cabinet-passport.json
```

Expected result:

```text
PASS: tpp:example:steel-cabinet:001
Facts: 3
Evidence records: 4
Confirmations: 3
```

## Why this exists

Trade evidence is fragmented across email, chat, PDFs, spreadsheets, logistics systems, inspection reports and multiple organizations. A receiver often has to reconstruct:

- what the trade is about;
- which facts are being asserted;
- what evidence supports each fact;
- who confirmed, rejected, or requested a change;
- which version is current;
- whether an earlier object was superseded or revoked.

TradeProof packages those relationships into portable JSON objects that can be rendered by a web page, processed by an Agent, referenced by an ERP or anchored onchain.

## Repository structure

```text
standard/trade-proof-passport-v0.1.md
standard/trade-proof-response-v0.1.md
standard/tproof-token-economics-v0.1.md
schema/trade-proof-passport.schema.json
schema/trade-proof-response.schema.json
tokenomics/tproof-tokenomics-v0.1.json
examples/steel-cabinet-passport.json
tools/verify-passport.mjs
tools/verify-tokenomics.mjs
docs/index.html
docs/tokenomics.html
docs/create.html
docs/view.html
docs/respond.html
docs/example.html
```

## Design principles

1. **Useful before the token** — the product performs real work now.
2. **Viral through workflow** — every useful response naturally invites another organization.
3. **Economics as code** — supply, allocations, scoring boundaries and launch gates are machine-verifiable.
4. **Contribution before liquidity** — non-transferable Proof Points and receipts precede Token distribution.
5. **Privacy-bounded** — source files, evidence URIs and private party identifiers do not need to be public.
6. **Onchain integrity, not automatic truth** — the Registry proves chronology and exact digest identity.
7. **Contributor ownership** — future incentives reward measurable network value.
8. **Portable and open** — the same objects can move across websites, Agents, ERP systems and wallets.

## Permanent boundaries

TradeProof does not currently perform:

- token issuance or movement;
- a public token sale or claim;
- payments or settlement;
- financing approval;
- custody or asset tokenization;
- customs, legal, insurance or regulatory approval;
- identity or organizational-authority verification;
- automatic truth or reputation scoring;
- public disclosure of private commercial documents.

TPROOF provides no ownership of trade goods, invoices, receivables or payments, and no revenue share, dividend, guaranteed yield, redemption promise or guaranteed price support.

## Status

The Passport, Response and Token Economics documents are community draft `v0.1`. The Registry is an experimental, unaudited Base Sepolia deployment. Explorer source verification is still pending. TPROOF is not live.

## License

MIT for the public drafts, examples, site and helper tools.
