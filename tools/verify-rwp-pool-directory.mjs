import assert from 'node:assert/strict';
import { canonicalizeJson } from '../docs/rwp-card.mjs';
import { RWP_CASE_GRAPH_ASSURANCE } from '../docs/rwp-case-graph.mjs';
import { buildRwpProofPattern, buildRwpTradePool } from '../docs/rwp-proof-pool.mjs';
import { RWP_PROOF_LIQUIDITY_CARD_ASSURANCE } from '../docs/rwp-proof-liquidity.mjs';
import {
  RWP_POOL_DIRECTORY_ASSURANCE,
  RWP_POOL_DIRECTORY_CARD_ASSURANCE,
  buildRwpPoolDirectory,
  buildRwpPoolDirectoryCard,
  buildRwpPoolDirectoryCardUrl,
  decodeRwpPoolDirectoryCard,
  encodeRwpPoolDirectoryCard,
  forkRwpPoolDirectory,
  readRwpPoolDirectoryCardFromHash,
  validateRwpPoolDirectory,
  validateRwpPoolDirectoryCard
} from '../docs/rwp-pool-directory.mjs';
import { keccakUtf8 } from '../docs/season-allocation.mjs';

const digest = (character) => `0x${character.repeat(64)}`;
const sourcePassportDigest = digest('1');
const sourceCardDigest = digest('2');
const nodes = [
  {
    id: 'passport:1111111111111111',
    type: 'passport',
    digest: sourcePassportDigest,
    at: '2026-01-01T00:00:00.000Z',
    status: 'active',
    metrics: { claims: 1, evidence: 1, confirmations: 1, provenance: 1 }
  },
  {
    id: 'card:2222222222222222',
    type: 'proof_card',
    digest: sourceCardDigest,
    at: '2026-01-01T00:00:00.000Z',
    status: 'active',
    metrics: { claims: 1, evidence: 1, confirmations: 1, provenance: 1 }
  }
];
const edges = [{ from: nodes[0].id, to: nodes[1].id, relation: 'projects_to' }];
const graphPayload = {
  format: 'real-world-proof-case-graph',
  version: '0.1',
  domain: 'trade',
  source: { passportDigest: sourcePassportDigest, cardDigest: sourceCardDigest },
  nodes,
  edges,
  summary: {
    eventCount: 2,
    edgeCount: 1,
    counts: {
      passport: 1,
      proof_card: 1,
      request: 0,
      request_response: 0,
      evidence_package: 0,
      evidence_receipt: 0,
      evidence_resolution: 0,
      evidence_resolution_receipt: 0
    },
    statusCounts: { resolved: 0, mismatch: 0, incomplete: 0, requestMore: 0, disputed: 0 },
    currentState: 'proof_available',
    firstEventAt: nodes[0].at,
    lastEventAt: nodes[1].at
  },
  projectedAt: nodes[1].at,
  assurance: RWP_CASE_GRAPH_ASSURANCE
};
const graphDigest = keccakUtf8(canonicalizeJson(graphPayload));
const graph = { ...graphPayload, graphId: `rwpgraph:${graphDigest.slice(2, 18)}`, graphDigest };
const pattern = buildRwpProofPattern(graph, {
  roles: [],
  evidenceCategories: [],
  statusGates: ['proof_available']
});

const poolA = buildRwpTradePool(pattern, {
  label: 'Asia Inspection Proof Pool',
  scope: 'trade_corridor',
  summary: 'Reusable inspection proof rules for a trade corridor.',
  createdAt: '2026-01-02T00:00:00.000Z'
});
const poolB = buildRwpTradePool(pattern, {
  label: 'Warehouse Evidence Pool',
  scope: 'industry',
  summary: 'Open warehouse evidence workflow rules.',
  createdAt: '2026-01-03T00:00:00.000Z'
});
const poolC = buildRwpTradePool(pattern, {
  label: 'Shipment Confirmation Pool',
  scope: 'workflow',
  summary: 'A new public workflow Pool without a Liquidity Card yet.',
  createdAt: '2026-01-04T00:00:00.000Z'
});

const buildLiquidityCard = (pool, character, units, firstAdoptionAt, lastAdoptionAt) => {
  const payload = {
    format: 'real-world-proof-liquidity-snapshot-card',
    version: '0.1',
    domain: 'trade',
    source: {
      snapshotId: `rwppls:${character.repeat(16)}`,
      snapshotDigest: digest(character),
      poolId: pool.poolId,
      poolDigest: pool.poolDigest
    },
    pool: {
      label: pool.label,
      scope: pool.scope,
      generation: pool.lineage.generation
    },
    units,
    firstAdoptionAt,
    lastAdoptionAt,
    assurance: RWP_PROOF_LIQUIDITY_CARD_ASSURANCE
  };
  const cardDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, cardId: `rwpplcard:${cardDigest.slice(2, 18)}`, cardDigest };
};

const liquidityA = buildLiquidityCard(
  poolA,
  '3',
  { verifiedAdoptionUnits: 5, uniqueCards: 8, excludedDuplicates: 1, partialAdoptions: 2, notAdopted: 0 },
  '2026-01-05T00:00:00.000Z',
  '2026-01-09T00:00:00.000Z'
);
const liquidityB = buildLiquidityCard(
  poolB,
  '4',
  { verifiedAdoptionUnits: 2, uniqueCards: 4, excludedDuplicates: 0, partialAdoptions: 1, notAdopted: 1 },
  '2026-01-06T00:00:00.000Z',
  '2026-01-08T00:00:00.000Z'
);

const entries = [
  { pool: poolC, curatorNote: 'New Pool; no verified adoption Snapshot has been attached.' },
  { pool: poolA, liquidityCard: liquidityA, curatorNote: 'Trade-corridor proof workflow.' },
  { pool: poolB, liquidityCard: liquidityB }
];
const directory = buildRwpPoolDirectory(entries, {
  label: 'Open Trade Proof Directory',
  scope: 'community',
  summary: 'A self-declared open list of reusable Trade Pools.',
  generation: 0
});
assert.deepEqual(validateRwpPoolDirectory(directory), []);
assert.equal(directory.assurance, RWP_POOL_DIRECTORY_ASSURANCE);
assert.match(directory.directoryId, /^rwpdir:[0-9a-f]{16}$/);
assert.match(directory.directoryDigest, /^0x[0-9a-f]{64}$/);
assert.equal(directory.entries.length, 3);
assert.deepEqual(
  directory.entries.map((entry) => entry.pool.poolDigest),
  [...directory.entries.map((entry) => entry.pool.poolDigest)].sort()
);
assert.equal(directory.summary.entryCount, 3);
assert.equal(directory.summary.poolsWithLiquidity, 2);
assert.equal(directory.summary.poolsWithoutLiquidity, 1);
assert.equal(directory.summary.verifiedAdoptionUnits, 7);
assert.equal(directory.summary.uniqueAdoptionCards, 12);
assert.equal(directory.summary.excludedDuplicates, 1);
assert.equal(directory.summary.partialAdoptions, 3);
assert.equal(directory.summary.notAdopted, 1);
assert.deepEqual(directory.summary.scopes, {
  trade_corridor: 1,
  industry: 1,
  workflow: 1,
  other: 0
});
assert.equal(directory.summary.firstPoolCreatedAt, '2026-01-02T00:00:00.000Z');
assert.equal(directory.summary.lastObservedAt, '2026-01-09T00:00:00.000Z');
assert.equal(directory.projectedAt, directory.summary.lastObservedAt);

const reordered = buildRwpPoolDirectory([...entries].reverse(), {
  label: directory.label,
  scope: directory.scope,
  summary: directory.description,
  generation: 0
});
assert.equal(reordered.directoryDigest, directory.directoryDigest);
assert.deepEqual(reordered.entries, directory.entries);

const card = buildRwpPoolDirectoryCard(directory);
assert.deepEqual(validateRwpPoolDirectoryCard(card), []);
assert.equal(card.assurance, RWP_POOL_DIRECTORY_CARD_ASSURANCE);
assert.equal(card.entries.length, 3);
assert.equal(card.summary.verifiedAdoptionUnits, 7);
assert.equal(card.entries.filter((entry) => entry.liquidity).length, 2);
assert.equal(card.entries.some((entry) => entry.curatorNote?.includes('Trade-corridor')), true);
assert.equal('proofPattern' in card.entries[0], false);
assert.equal('liquidityCard' in card.entries[0], false);

const encoded = encodeRwpPoolDirectoryCard(card);
assert.deepEqual(decodeRwpPoolDirectoryCard(encoded), card);
const url = buildRwpPoolDirectoryCardUrl(card, 'https://example.test/path/rwp-pool.html?secret=1#old=1');
const parsed = new URL(url);
assert.equal(parsed.pathname, '/path/rwp-directory.html');
assert.equal(parsed.search, '');
assert.deepEqual(readRwpPoolDirectoryCardFromHash(parsed.hash), card);

const fork = forkRwpPoolDirectory(directory, {
  label: 'Focused Corridor Directory',
  summary: 'A fork containing only the trade-corridor and warehouse Pools.',
  entries: directory.entries.filter((entry) => entry.pool.poolDigest !== poolC.poolDigest)
});
assert.deepEqual(validateRwpPoolDirectory(fork), []);
assert.equal(fork.lineage.generation, 1);
assert.equal(fork.lineage.forkedFromDirectoryDigest, directory.directoryDigest);
assert.equal(fork.entries.length, 2);
assert.notEqual(fork.directoryDigest, directory.directoryDigest);

assert.throws(
  () => buildRwpPoolDirectory([{ pool: poolA }, { pool: structuredClone(poolA) }]),
  /Duplicate Pool ID|Duplicate Pool digest/
);
assert.throws(
  () => buildRwpPoolDirectory([{ pool: poolB, liquidityCard: liquidityA }]),
  /does not reference|does not match/
);

const tamperedDirectory = structuredClone(directory);
tamperedDirectory.summary.verifiedAdoptionUnits = 700;
assert.match(validateRwpPoolDirectory(tamperedDirectory).join(' '), /deterministic reconstruction|directoryDigest|summary/);
const tamperedCard = structuredClone(card);
tamperedCard.entries[0].label = 'Tampered Pool Label';
assert.match(validateRwpPoolDirectoryCard(tamperedCard).join(' '), /cardDigest/);

const publicJson = canonicalizeJson(card);
for (const forbidden of [
  'passportId',
  'evidenceId',
  'fileName',
  'displayName',
  'goodsDescription',
  'computedDigest',
  'deliveryEndpoint',
  'statement',
  'proofValue',
  'proofPattern',
  'liquidityCard'
]) assert.equal(publicJson.includes(forbidden), false, `Directory Card leaked ${forbidden}`);
assert.equal(publicJson.includes('Open Trade Proof Directory'), true);
assert.equal(publicJson.includes('verifiedAdoptionUnits'), true);
assert.equal(publicJson.includes(directory.directoryDigest), true);

console.log('PASS: deterministic open Pool Directories, matching Liquidity Cards, Fork lineage and privacy-bounded discovery cards');
