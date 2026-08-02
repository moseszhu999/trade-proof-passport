import assert from 'node:assert/strict';
import { canonicalizeJson } from '../docs/rwp-card.mjs';
import {
  RWP_POOL_ADOPTION_CARD_ASSURANCE,
  validateRwpPoolAdoptionCard
} from '../docs/rwp-pool-adoption.mjs';
import {
  RWP_PROOF_LIQUIDITY_CARD_ASSURANCE,
  RWP_PROOF_LIQUIDITY_SNAPSHOT_ASSURANCE,
  buildRwpProofLiquidityCard,
  buildRwpProofLiquidityCardUrl,
  buildRwpProofLiquiditySnapshot,
  decodeRwpProofLiquidityCard,
  encodeRwpProofLiquidityCard,
  readRwpProofLiquidityCardFromHash,
  validateRwpProofLiquidityCard,
  validateRwpProofLiquiditySnapshot
} from '../docs/rwp-proof-liquidity.mjs';
import { keccakUtf8 } from '../docs/season-allocation.mjs';

const digest = (character) => `0x${character.repeat(64)}`;
const poolId = 'rwppool:1111111111111111';
const poolDigest = digest('1');

const makeCard = ({
  seed,
  passportSeed,
  graphSeed,
  receiptSeed,
  status = 'verified_adoption',
  observability = 'full_artifact_bundle',
  createdAt
}) => {
  const eligible = status === 'verified_adoption';
  const payload = {
    format: 'real-world-proof-pool-adoption-card',
    version: '0.1',
    domain: 'trade',
    source: {
      receiptId: `rwpadopt:${receiptSeed.repeat(16)}`,
      receiptDigest: digest(receiptSeed),
      poolId,
      poolDigest,
      graphId: `rwpgraph:${graphSeed.repeat(16)}`,
      graphDigest: digest(graphSeed),
      passportDigest: digest(passportSeed)
    },
    pool: {
      label: 'Open Inspection Proof Pool',
      scope: 'trade_corridor',
      generation: 2
    },
    adoptionStatus: status,
    proofLiquidityEligible: eligible,
    observability,
    currentState: status === 'not_adopted' ? 'action_required' : 'resolved',
    checks: status === 'verified_adoption'
      ? { total: 8, satisfied: 8, notSatisfied: 0, notObservable: 0 }
      : status === 'partial_adoption'
        ? { total: 8, satisfied: 6, notSatisfied: 0, notObservable: 2 }
        : { total: 8, satisfied: 5, notSatisfied: 3, notObservable: 0 },
    createdAt,
    assurance: RWP_POOL_ADOPTION_CARD_ASSURANCE
  };
  const cardDigest = keccakUtf8(canonicalizeJson(payload));
  const card = { ...payload, cardId: `rwpadoptcard:${cardDigest.slice(2, 18)}`, cardDigest };
  assert.deepEqual(validateRwpPoolAdoptionCard(card), []);
  return card;
};

const cardA = makeCard({ seed: 'a', passportSeed: 'a', graphSeed: 'b', receiptSeed: 'c', createdAt: '2026-08-02T01:00:00.000Z' });
const cardB = makeCard({ seed: 'd', passportSeed: 'd', graphSeed: 'e', receiptSeed: 'f', createdAt: '2026-08-02T02:00:00.000Z' });
const duplicatePassportB = makeCard({ seed: '6', passportSeed: 'd', graphSeed: '6', receiptSeed: '7', createdAt: '2026-08-02T02:30:00.000Z' });
const partialC = makeCard({ seed: '8', passportSeed: '8', graphSeed: '9', receiptSeed: 'a', status: 'partial_adoption', observability: 'graph_only', createdAt: '2026-08-02T03:00:00.000Z' });
const notAdoptedD = makeCard({ seed: 'b', passportSeed: 'b', graphSeed: 'c', receiptSeed: 'd', status: 'not_adopted', createdAt: '2026-08-02T04:00:00.000Z' });

const cards = [notAdoptedD, duplicatePassportB, cardB, partialC, cardA];
const snapshot = buildRwpProofLiquiditySnapshot(cards);
assert.deepEqual(validateRwpProofLiquiditySnapshot(snapshot), []);
assert.equal(snapshot.assurance, RWP_PROOF_LIQUIDITY_SNAPSHOT_ASSURANCE);
assert.match(snapshot.snapshotId, /^rwppls:[0-9a-f]{16}$/);
assert.equal(snapshot.summary.submittedCards, 5);
assert.equal(snapshot.summary.uniqueCards, 4);
assert.equal(snapshot.summary.verifiedAdoptionUnits, 2);
assert.equal(snapshot.summary.partialAdoptions, 1);
assert.equal(snapshot.summary.notAdopted, 1);
assert.equal(snapshot.summary.excludedDuplicates, 1);
assert.equal(snapshot.summary.fullArtifactVerified, 2);
assert.equal(snapshot.excluded[0].reason, 'duplicate_submission');
assert.deepEqual(snapshot.excluded[0].duplicateOf, ['passport']);
assert.equal(snapshot.projectedAt, '2026-08-02T04:00:00.000Z');

const reordered = buildRwpProofLiquiditySnapshot([...cards].reverse());
assert.equal(reordered.snapshotDigest, snapshot.snapshotDigest);
assert.deepEqual(reordered, snapshot);

const sameCardTwice = buildRwpProofLiquiditySnapshot([cardA, cardA]);
assert.equal(sameCardTwice.summary.verifiedAdoptionUnits, 1);
assert.equal(sameCardTwice.summary.excludedDuplicates, 1);
assert.deepEqual(sameCardTwice.excluded[0].duplicateOf, ['card', 'receipt', 'graph', 'passport']);

const mixedPool = structuredClone(cardB);
mixedPool.source.poolId = 'rwppool:9999999999999999';
const { cardId: _oldId, cardDigest: _oldDigest, ...mixedPayload } = mixedPool;
const mixedDigest = keccakUtf8(canonicalizeJson(mixedPayload));
mixedPool.cardDigest = mixedDigest;
mixedPool.cardId = `rwpadoptcard:${mixedDigest.slice(2, 18)}`;
assert.deepEqual(validateRwpPoolAdoptionCard(mixedPool), []);
assert.throws(() => buildRwpProofLiquiditySnapshot([cardA, mixedPool]), /same Trade Pool/);

const tamperedSnapshot = structuredClone(snapshot);
tamperedSnapshot.summary.verifiedAdoptionUnits = 99;
assert.ok(validateRwpProofLiquiditySnapshot(tamperedSnapshot).some((error) => error.includes('deterministic reconstruction')));

const card = buildRwpProofLiquidityCard(snapshot);
assert.deepEqual(validateRwpProofLiquidityCard(card), []);
assert.equal(card.assurance, RWP_PROOF_LIQUIDITY_CARD_ASSURANCE);
assert.equal(card.units.verifiedAdoptionUnits, 2);
assert.equal(card.units.excludedDuplicates, 1);
const publicJson = canonicalizeJson(card);
for (const forbidden of [
  cardA.source.passportDigest,
  cardA.source.graphDigest,
  cardA.source.receiptDigest,
  cardA.cardDigest,
  'passportId',
  'evidenceId',
  'fileName',
  'displayName',
  'computedDigest',
  'deliveryEndpoint'
]) assert.equal(publicJson.includes(forbidden), false, `public liquidity card leaked ${forbidden}`);

const encoded = encodeRwpProofLiquidityCard(card);
assert.deepEqual(decodeRwpProofLiquidityCard(encoded), card);
const url = buildRwpProofLiquidityCardUrl(card, 'https://example.test/unsafe/rwp-adopt.html?secret=1#old=1');
const parsed = new URL(url);
assert.equal(parsed.pathname, '/unsafe/rwp-liquidity.html');
assert.equal(parsed.search, '');
assert.deepEqual(readRwpProofLiquidityCardFromHash(parsed.hash), card);

const tamperedCard = structuredClone(card);
tamperedCard.units.verifiedAdoptionUnits = 50;
assert.ok(validateRwpProofLiquidityCard(tamperedCard).some((error) => error.includes('cardDigest')));

console.log('PASS: deterministic Proof Liquidity units, duplicate resistance, Snapshot recomputation and privacy-bounded public Card');
