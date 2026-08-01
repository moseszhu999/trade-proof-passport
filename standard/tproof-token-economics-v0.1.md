# TPROOF Token Economics v0.1

Status: **public draft — token not live**  
Canonical machine-readable parameters: `tokenomics/tproof-tokenomics-v0.1.json`

## 1. Economic thesis

TradeProof is not designed to reward attention for its own sake. It is designed to turn useful cross-organization trade-proof work into measurable contribution, and measurable contribution into long-term community ownership.

```text
Useful trade-proof action
→ independent counterparty response
→ verified contribution receipt
→ seasonal Proof Points
→ seasonal TPROOF allocation
→ governance and sponsored public goods
→ more integrations, adoption and useful trade-proof actions
```

The viral unit is not a page view, referral code, wallet connection, or social post. The viral unit is a completed cross-wallet workflow that creates reusable network value.

## 2. Three economic assets

### 2.1 Proof Points

Proof Points are non-transferable seasonal accounting units.

They:

- measure verified useful actions;
- have no market price;
- cannot be transferred or purchased;
- reset after each season is finalized;
- determine eligibility and relative seasonal reward share;
- remain subject to anti-Sybil review and appeals.

Proof Points prevent every product action from becoming an immediately tradable farming reward.

### 2.2 Contribution Receipts

Contribution Receipts are future non-transferable onchain records produced by `TradeProofContribution`.

A receipt may record:

- contributor wallet;
- contribution class;
- referenced Passport, Response, integration, pull request, finding, or adoption evidence;
- season;
- provisional or final status;
- reviewer or governed decision;
- points;
- revocation or anti-Sybil outcome.

A receipt records contribution history. It does not certify organizational identity or the truth of a real-world trade claim.

### 2.3 TPROOF

`TPROOF` is the planned transferable community utility and governance token.

It is not live. No sale, claim, price, exchange listing, revenue share, yield, redemption right, or return promise is active.

TPROOF is intended to coordinate:

- standards governance;
- treasury and grant allocation;
- proposal and challenge bonds;
- sponsored contribution pools;
- public-goods matching;
- long-term contributor ownership.

Holding TPROOF never makes a Passport, Response, evidence record, or real-world assertion valid.

## 3. Fixed supply and allocation

Draft maximum supply:

```text
1,000,000,000 TPROOF
18 decimals
fixed at genesis
no post-genesis minting
```

| Allocation | Share | Tokens | Purpose |
|---|---:|---:|---|
| Community contributions | 45% | 450,000,000 | Seasonal verified contribution rewards |
| Ecosystem and developer fund | 20% | 200,000,000 | Integrations, infrastructure and open public goods |
| Core team | 15% | 150,000,000 | Long-term protocol and product stewardship |
| Real adoption incentives | 10% | 100,000,000 | Milestone-based repeat adoption and connectors |
| Liquidity bootstrapping reserve | 5% | 50,000,000 | Potential post-launch liquidity under published controls |
| Security and standards reserve | 5% | 50,000,000 | Audits, bounties, standards and emergency public goods |

The allocation must sum to 100%. The machine-readable verifier rejects any drift.

## 4. Community emissions

The 45% community allocation is emitted over eight years through 90-day seasons.

Each season includes:

1. action and contribution recording;
2. a 30-day anti-Sybil and review delay;
3. a 14-day appeal window within the review process;
4. final verified Proof Points;
5. reward calculation;
6. delayed claim activation.

The draft reward curve is:

```text
wallet reward
=
season pool
× sqrt(wallet verified points)
÷ sum(sqrt(all eligible wallets' verified points))
```

The square-root curve preserves the incentive to contribute while reducing the ability of one high-volume actor to absorb the season.

Proof Points are eligibility signals, not an unconditional promise of tokens. Spam, duplicates, deception, self-response loops and suspicious Sybil clusters may be excluded under published rules.

## 5. Season 0: Genesis Proof

Draft Genesis pool:

```text
1% of total supply
10,000,000 TPROOF
sourced from the 45% community allocation
not currently claimable
```

Season 0 is intended to recognize early verified network creation:

- real Passport and independent Response loops;
- responders who become creators of new Passports;
- accepted standards improvements;
- production-quality Agent, ERP, logistics, inspection, wallet or indexing integrations;
- security findings and fixes;
- repeat adoption with reviewable evidence;
- high-quality documentation, translation and education.

Season 0 does **not** reward:

- page views;
- wallet connections;
- raw social impressions;
- creating many empty wallets;
- self-responses;
- duplicate Passport digests;
- wash activity between the same wallet pair;
- unreviewed claims of organizational adoption.

The core marketing statement is therefore:

> Do useful work. Create proof. Bring a real counterparty. Earn verified ownership eligibility.

## 6. Automatic usage track

Draft automatic points:

| Verified event | Points |
|---|---:|
| Anchor a unique Passport | Creator +5 |
| Independent external Response | Passport issuer +10; responder +20 |
| Reach a third distinct responder role | Passport issuer +30 |
| A responder creates a distinct Passport within 30 days | inviter +50; new creator +25 |
| Participate in a second distinct lineage with an external Response | actor +20 |

Important boundaries:

- roles remain self-declared until organizational attestations exist;
- a distinct wallet is not automatically a distinct legal organization;
- identical artifacts and self-responses score zero;
- automatic points are capped per wallet, day and wallet pair;
- final settlement remains subject to anti-Sybil review.

## 7. Reviewed public-goods track

Some contributions cannot be judged safely by transaction count alone.

Draft reviewed ranges:

| Contribution | Draft range |
|---|---:|
| Accepted standards change | 500–3,000 points |
| Production connector or Agent integration | 1,500–10,000 points |
| Security finding or fix | 500–15,000 points |
| Verified repeat-adoption case | 1,000–10,000 points |
| Documentation, translation or education | 100–2,000 points |

High-value awards require reviewable evidence, conflict disclosure, duplicate checks and a published decision.

## 8. Anti-Sybil design

Airdrops attract actors who create many addresses and optimize for eligibility rather than network value. TradeProof therefore delays claims and measures relationship quality, reuse and public goods instead of raw transaction counts.

Minimum controls:

- no rewards for wallet creation, connection, page views or social posts alone;
- no points for self-responses or duplicate artifacts;
- caps on repeated wallet-pair activity;
- review delay before finalization;
- transaction timing, funding-source and graph-cluster analysis;
- human or governed review for large awards;
- revocable Contribution Receipts for proven spam, duplication or deception;
- public appeal rules;
- published seasonal allocation data.

Anti-Sybil decisions must not erase valid Registry history. They affect contribution rewards only.

## 9. Token utility

### Standards governance

Token holders may govern supported schemas, canonicalization profiles and protocol standards.

Governance cannot declare a real-world trade fact true and cannot rewrite historical Registry records.

### Treasury and grant governance

Token holders may direct ecosystem, integration, security and standards funding.

### Proposal bonds

Draft future bond:

```text
1,000 TPROOF
```

A formal standards or treasury proposal may require a refundable bond. A bond may be forfeited only under published spam or abuse rules.

### Challenge bonds

Draft future bond:

```text
250 TPROOF
```

A challenge to a Contribution Receipt or allocation may require a bond. The bond is returned when the challenge is upheld.

### Sponsored contribution pools

Organizations or community members may lock TPROOF into transparent pools that reward predefined outcomes such as:

- a logistics connector;
- an inspection integration;
- a language localization;
- a trade-corridor adoption campaign;
- an open-source verification tool.

### Public-goods matching

Token holders may signal or allocate matching budgets toward open-source ecosystem work.

## 10. Vesting and treasury controls

### Core team

```text
12-month cliff
48-month linear vesting
no transfer before cliff
```

### Ecosystem and developer fund

- minimum 48-month budget horizon;
- multisig before governance maturity;
- timelocked governance after maturity;
- public grant and wallet reporting.

### Adoption incentives

- milestone-based distribution;
- minimum 24-month vesting for large partner allocations;
- no fully liquid upfront partnership grants.

### Liquidity reserve

- unusable before launch approval;
- transparent wallet;
- published strategy;
- minimum 12-month initial lock;
- no secret market-making commitments.

### Security and standards reserve

- independently reviewable bounty evidence;
- public reporting;
- no discretionary hidden minting.

## 11. Permanent constitutional boundaries

1. TPROOF never determines Passport or Response validity.
2. Basic Passport creation, local verification and public Registry reading remain available without TPROOF.
3. TPROOF represents no ownership of goods, invoices, receivables, payments or other real-world assets.
4. TPROOF provides no dividend, revenue share, guaranteed yield, guaranteed redemption or guaranteed price support.
5. Source documents remain offchain unless a user intentionally publishes them elsewhere.
6. Governance cannot rewrite historical Registry records.
7. Fixed supply and allocation cannot be silently changed.
8. Marketing must remain consistent with the canonical public token-economics and disclosure documents.

## 12. Launch gates

No public offer, trading admission, token claim, or liquidity action should begin until all gates pass:

- `TradeProofContribution` implemented and independently reviewed;
- `TradeProofToken` and vesting contracts implemented with no hidden mint path;
- source-verified testnet deployments;
- external security review;
- one canonical public token-economics and disclosure source;
- legal review for target jurisdictions;
- published Genesis anti-Sybil, review and appeal rules;
- published treasury multisig, signer and timelock policy;
- community approval of final parameters.

## 13. North-star metrics

The economic system optimizes for:

- weekly verified cross-wallet Responses;
- responder-to-new-Passport conversion;
- Passports with three or more distinct responder wallets;
- repeat trade usage;
- accepted integrations and public goods;
- contributor retention at 30 and 90 days;
- low reward concentration;
- low Sybil leakage.

It does not optimize for raw wallet count, page views, social impressions or short-term token turnover.

## 14. Marketing position

The economic narrative is:

```text
Proof creates contribution.
Contribution earns ownership eligibility.
Ownership funds more proof infrastructure.
Every useful counterparty action expands the network.
```

This is a product-led token economy, not a token searching for a product.

## 15. Regulatory and disclosure boundary

Before any public offer or admission to trading, marketing and public disclosure must be reviewed for every target jurisdiction. No website copy should imply profit expectation, asset ownership, guaranteed liquidity, redemption, yield or revenue participation unless such rights legally exist and are fully disclosed.

This draft is a product and protocol design document, not legal, tax or investment advice.
