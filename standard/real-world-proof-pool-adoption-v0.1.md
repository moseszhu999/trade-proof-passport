# Real-World Proof Pool Adoption Receipt v0.1

Status: Community Draft

## 1. Purpose

A Pool Adoption Receipt compares one independently produced RWP Case Graph with one public Trade Pool.

It distinguishes verified workflow adoption from page views, copied links and empty Pool forks.

```text
Trade Pool
→ independent RWP Case Graph
→ deterministic rule evaluation
→ Pool Adoption Receipt
→ privacy-bounded Adoption Card
→ Proof Liquidity eligibility
```

The Receipt does not create a central registry, score, ranking, financial market or Token entitlement.

## 2. Independent-root invariant

The adopting Case Graph must use a different Passport root from the Case Graph or Timeline that originally produced the Pool Pattern.

```text
adoption.graph.passportDigest != pool.proofPattern.source.passportDigest
```

A source trade cannot adopt its own Pool and count itself as independent Proof Liquidity.

Forking a Pool also does not count as adoption.

## 3. Two observability modes

### 3.1 `graph_only`

The verifier imports:

- one complete public Trade Pool;
- one independent Case Graph.

The verifier can deterministically check:

- required RWP node types;
- required graph relation triples;
- required ordered object/status sequence;
- required branching shape;
- the Pool status gate against the Graph current state.

The Case Graph intentionally does not expose participant roles or evidence categories. Those checks are therefore marked:

```text
not_observable
```

A graph-only evaluation cannot claim full Proof Liquidity when the Pool declares role or evidence-category requirements.

### 3.2 `full_artifact_bundle`

The verifier additionally imports the local RWP artifacts that produced the Case Graph.

The browser rebuilds the Case Graph from those artifacts and requires the rebuilt `graphDigest` to equal the supplied Graph digest.

Only after that equality check may the Receipt derive:

- observed public role categories;
- evidence categories whose recipient-side result was `matched`;
- the same workflow and status checks available in graph-only mode.

The artifacts stay local and are not encoded into the Adoption Card URL.

## 4. Requirement provenance

Pool requirements remain separated from observed adoption facts.

```text
Pool publicRules
= pool_operator_declared

Adoption evaluation
= deterministically compared against imported canonical objects
```

The Pool operator can declare roles, evidence categories and status gates. The Adoption Receipt does not turn those declarations into universal legal or industry requirements.

## 5. Check statuses

Every bounded requirement receives one of three statuses.

```text
satisfied
not_satisfied
not_observable
```

### `satisfied`

The imported canonical objects expose enough information and meet the requirement.

### `not_satisfied`

The requirement is observable but the imported RWP does not meet it.

### `not_observable`

The requirement exists, but the imported projection does not expose enough information to evaluate it.

`not_observable` must never be silently converted to `satisfied`.

## 6. Workflow checks

### Required node types

Every `proofPattern.derivedWorkflow.requiredNodeTypes` value must appear in the adopting Graph.

### Required relations

Every explicit Pattern relation triple must appear in the adopting Graph:

```text
fromType + relation + toType
```

A `sequence_only` Pattern has no invented relation requirements.

### Ordered step sequence

The Pattern step sequence must appear as an ordered subsequence of the adopting Graph events.

The adopter may add later correction or resolution events. It may not reorder the required source sequence.

### Branching

When the source Pattern observed branching, the adopting Graph must also contain multiple Requests or Responses.

A non-branching source Pattern does not forbid an adopter from adding a legitimate branch.

### Status gate

The adopting Graph `summary.currentState` must be one of the Pool `publicRules.statusGates`.

Status gates are alternatives, not a requirement to reach every listed state.

## 7. Role checks

Role requirements are evaluated only from a full artifact bundle whose rebuilt Graph digest matches the submitted Case Graph.

Observed role categories may come from:

- Passport parties;
- Proof Card confirmed or responded roles;
- Request requester role;
- Request Response responder role;
- Evidence Package or Resolution issuer role;
- Evidence Receipt or Resolution Receipt receiver role.

A role category is structural metadata. It does not authenticate the organization or prove authority.

## 8. Evidence-category checks

An evidence category is counted as satisfied only when a recipient-side Evidence Receipt or Resolution Receipt records a matching evidence result with:

```text
status = matched
```

Requested, offered or packaged evidence alone does not satisfy the evidence-category rule.

This prevents a holder from claiming Proof Liquidity merely because a category was mentioned in a Request or Response.

## 9. Adoption outcomes

### `verified_adoption`

All workflow, relation, sequence, branching, status-gate, role and evidence-category checks are `satisfied`.

The Receipt sets:

```text
proofLiquidityEligible = true
```

### `partial_adoption`

Core workflow and status-gate checks are satisfied, but at least one declared role or evidence-category check is `not_satisfied` or `not_observable`.

The Receipt sets:

```text
proofLiquidityEligible = false
```

### `not_adopted`

At least one core workflow, relation, sequence, branching or status-gate check is not satisfied.

The Receipt sets:

```text
proofLiquidityEligible = false
```

## 10. Proof Liquidity

Version 0.1 defines one scarce public unit:

```text
one verified independent RWP adoption
```

A Proof Liquidity unit requires:

- one valid public Pool;
- one independent Passport root;
- one valid Case Graph;
- a full local artifact bundle reproducing that Graph digest when role or evidence rules exist;
- all Pool requirements satisfied;
- one valid Adoption Receipt and public Adoption Card.

The following do not create Proof Liquidity:

```text
page view
wallet connection
Pool-link copy
social post
empty Fork
self-adoption by the source Passport
unverified role declaration
requested but unmatched evidence
partial_adoption
not_adopted
```

Proof Liquidity is not asset liquidity, financing capacity, credit quality, market depth or Token value.

## 11. Receipt object

Canonical format:

```text
real-world-proof-pool-adoption-receipt
```

Receipt ID:

```text
rwpadopt:<16 lowercase hexadecimal characters>
```

The Receipt binds:

- Pool ID and digest;
- Pattern ID and digest;
- independent Graph ID and digest;
- adopting Passport and Proof Card digests;
- observability mode;
- observed public categories;
- deterministic checks and result;
- canonical Receipt digest.

The full Receipt is a local download and is not encoded into a public URL.

## 12. Public Adoption Card

Canonical format:

```text
real-world-proof-pool-adoption-card
```

Card ID:

```text
rwpadoptcard:<16 lowercase hexadecimal characters>
```

The public Card contains:

- Pool label, scope and generation;
- Pool, Graph, Passport and Receipt digests;
- adoption outcome;
- Proof Liquidity eligibility;
- observability mode;
- current Graph state;
- aggregate check counts;
- timestamp and assurance boundary.

It does not contain:

- Passport ID;
- Party ID or organization name;
- Evidence ID;
- file name or source bytes;
- evidence or computed file digest;
- trade statement, goods description, price or bank data;
- delivery endpoint or credential.

## 13. Viral loop

```text
Share Pool
→ independent adopter creates RWP
→ adopter verifies locally
→ publish Adoption Card
→ others can verify Pool + Graph + Receipt digests
→ only verified_adoption is eligible for Proof Liquidity
```

The viral unit is a completed independent proof workflow, not an impression.

## 14. Governance and truth boundaries

```text
DAO vote != verified adoption
Token balance != Pool satisfaction
Fork count != Proof Liquidity
Proof Liquidity != financial liquidity
Pool adoption != legal compliance
Adoption Card != authenticated organization identity
```

A DAO may govern public schemas, vocabulary, discovery and grants. It cannot vote a failed requirement into a satisfied state.

## 15. Non-goals

Version 0.1 does not provide:

- central Pool registry, leaderboard or ranking;
- automatic organization or wallet identity verification;
- server-side file storage;
- remote evidence retrieval;
- payments, settlement, financing or custody;
- RWA issuance;
- Token distribution or liquidity;
- mainnet execution.

## 16. Open implementation

The Receipt, Card, schema, browser verifier and tests are open source. Any party may host the verifier, recompute the same canonical digests and evaluate the same imported objects without using an official server.
