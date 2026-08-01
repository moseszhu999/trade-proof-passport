# TradeProof

[![Validate Trade Proof Passport](https://github.com/moseszhu999/trade-proof-passport/actions/workflows/validate.yml/badge.svg)](https://github.com/moseszhu999/trade-proof-passport/actions/workflows/validate.yml)

**Proof for trade. Ownership for contributors.**

TradeProof combines a useful portable trade-proof format, a browser-native multi-party response loop, and an onchain integrity layer. A future community token, `$TPROOF`, is planned to reward measurable ecosystem contribution rather than empty traffic.

## Live product

- Project site: `https://moseszhu999.github.io/trade-proof-passport/`
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

## `$TPROOF` direction

`$TPROOF` is **not live**. There is no public sale, price, listing, revenue share or return promise.

The current draft utility direction is:

- contribution receipts;
- standards governance;
- ecosystem and developer incentives;
- access to future network capabilities;
- rewards for accepted integrations, useful cross-organization responses, security findings and repeat adoption.

Token state must never determine whether a Passport or Response is valid, current, revoked or superseded.

Draft allocation displayed on the project site:

```text
45% community contributions
20% ecosystem and developer fund
15% core team with long vesting
10% real adoption incentives
 5% liquidity bootstrapping reserve
 5% security and standards reserve
```

Final supply, rights, distribution and launch remain subject to technical, legal and community review.

## Try the verifier

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
schema/trade-proof-passport.schema.json
schema/trade-proof-response.schema.json
examples/steel-cabinet-passport.json
tools/verify-passport.mjs
docs/index.html
docs/create.html
docs/view.html
docs/respond.html
docs/example.html
```

## Design principles

1. **Useful before the token** — the product performs real work now.
2. **Viral through workflow** — every useful response naturally invites another organization.
3. **Privacy-bounded** — source files, evidence URIs and private party identifiers do not need to be public.
4. **Onchain integrity, not automatic truth** — the Registry proves chronology and exact digest identity.
5. **Contributor ownership** — future incentives reward measurable network value.
6. **Portable and open** — the same objects can move across websites, Agents, ERP systems and wallets.

## Current boundaries

TradeProof does not currently perform:

- token issuance or movement;
- a public token sale;
- payments or settlement;
- financing approval;
- custody or asset tokenization;
- customs, legal, insurance or regulatory approval;
- identity or organizational-authority verification;
- automatic truth or reputation scoring;
- public disclosure of private commercial documents.

## Status

The Passport and Response formats are community draft `v0.1`. The Registry is an experimental, unaudited Base Sepolia deployment. Explorer source verification is still pending.

## License

MIT for the public draft, examples, site and helper tools.
