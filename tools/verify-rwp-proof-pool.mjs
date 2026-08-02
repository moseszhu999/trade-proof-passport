import assert from 'node:assert/strict';
import { canonicalizeJson } from '../docs/rwp-card.mjs';
import {
  RWP_CASE_GRAPH_ASSURANCE,
  buildRwpTimelineCard
} from '../docs/rwp-case-graph.mjs';
import { keccakUtf8 } from '../docs/season-allocation.mjs';
import {
  RWP_PROOF_PATTERN_ASSURANCE,
  RWP_TRADE_POOL_ASSURANCE,
  buildRwpProofPattern,
  buildRwpTradePool,
  buildRwpTradePoolUrl,
  decodeRwpTradePool,
  encodeRwpTradePool,
  forkRwpTradePool,
  readRwpTradePoolFromHash,
  validateRwpProofPattern,
  validateRwpTradePool
} from '../docs/rwp-proof-pool.mjs';

const digest = (character) => `0x${character.repeat(64)}`;
const passportDigest = digest('1');
const cardDigest = digest('2');

const nodes = [
  { id: 'passport:1111111111111111', type: 'passport', digest: passportDigest, at: '2026-01-01T00:00:00.000Z', status: 'active', metrics: { claims: 3, evidence: 2, confirmations: 1, provenance: 3 } },
  { id: 'card:2222222222222222', type: 'proof_card', digest: cardDigest, at: '2026-01-01T00:00:00.000Z', status: 'active', metrics: { claims: 3, evidence: 2, confirmations: 1, provenance: 3 } },
  { id: 'rwpr:3333333333333333', type: 'request', digest: digest('3'), at: '2026-01-02T00:00:00.000Z', status: 'request_authorized_evidence', metrics: { requestedEvidenceCategories: 2 } },
  { id: 'rwprr:4444444444444444', type: 'request_response', digest: digest('4'), at: '2026-01-03T00:00:00.000Z', status: 'accept', metrics: { offeredEvidenceCategories: 2 } },
  { id: 'rwpep:5555555555555555', type: 'evidence_package', digest: digest('5'), at: '2026-01-04T00:00:00.000Z', status: 'complete', metrics: { records: 2, allowedCategories: 2, missingCategories: 0 } },
  { id: 'rwper:6666666666666666', type: 'evidence_receipt', digest: digest('6'), at: '2026-01-05T00:00:00.000Z', status: 'received', metrics: { total: 2, matched: 2, mismatch: 0, missing: 0, notChecked: 0, unsupportedAlgorithm: 0 } }
];

const edges = [
  { from: nodes[0].id, to: nodes[1].id, relation: 'projects_to' },
  { from: nodes[1].id, to: nodes[2].id, relation: 'requests_from' },
  { from: nodes[2].id, to: nodes[3].id, relation: 'responds_to' },
  { from: nodes[3].id, to: nodes[4].id, relation: 'packages_for' },
  { from: nodes[4].id, to: nodes[5].id, relation: 'receives' }
];

const graphPayload = {
  format: 'real-world-proof-case-graph',
  version: '0.1',
  domain: 'trade',
  source: { passportDigest, cardDigest },
  nodes,
  edges,
  summary: {
    eventCount: nodes.length,
    edgeCount: edges.length,
    counts: {
      passport: 1,
      proof_card: 1,
      request: 1,
      request_response: 1,
      evidence_package: 1,
      evidence_receipt: 1,
      evidence_resolution: 0,
      evidence_resolution_receipt: 0
    },
    statusCounts: { resolved: 0, mismatch: 0, incomplete: 0, requestMore: 0, disputed: 0 },
    currentState: 'evidence_received',
    firstEventAt: nodes[0].at,
    lastEventAt: nodes.at(-1).at
  },
  projectedAt: nodes.at(-1).at,
  assurance: RWP_CASE_GRAPH_ASSURANCE
};
const graphDigest = keccakUtf8(canonicalizeJson(graphPayload));
const graph = { ...graphPayload, graphId: `rwpgraph:${graphDigest.slice(2, 18)}`, graphDigest };

const requirements = {
  roles: ['inspection', 'buyer', 'exporter'],
  evidenceCategories: ['inspection_report', 'purchase_order'],
  statusGates: ['resolved', 'evidence_received']
};
const pattern = buildRwpProofPattern(graph, requirements);
assert.deepEqual(validateRwpProofPattern(pattern), []);
assert.equal(pattern.assurance, RWP_PROOF_PATTERN_ASSURANCE);
assert.equal(pattern.source.artifactType, 'case_graph');
assert.equal(pattern.derivedWorkflow.relationCoverage, 'explicit_graph');
assert.equal(pattern.derivedWorkflow.steps.length, nodes.length);
assert.equal(pattern.derivedWorkflow.relations.length, edges.length);
assert.equal(pattern.derivedWorkflow.terminalStateObserved, 'evidence_received');
assert.equal(pattern.derivedWorkflow.branchingObserved, false);
assert.deepEqual(pattern.declaredRequirements.roles, ['buyer', 'exporter', 'inspection']);
assert.deepEqual(pattern.declaredRequirements.evidenceCategories, ['inspection_report', 'purchase_order']);
assert.deepEqual(pattern.declaredRequirements.statusGates, ['evidence_received', 'resolved']);
assert.equal(pattern.declaredRequirements.provenance, 'operator_declared');

const deterministicPattern = buildRwpProofPattern(graph, {
  roles: [...requirements.roles].reverse(),
  evidenceCategories: [...requirements.evidenceCategories].reverse(),
  statusGates: [...requirements.statusGates].reverse()
});
assert.equal(deterministicPattern.patternDigest, pattern.patternDigest);
assert.equal(deterministicPattern.patternId, pattern.patternId);

const timeline = buildRwpTimelineCard(graph);
const timelinePattern = buildRwpProofPattern(timeline, requirements);
assert.deepEqual(validateRwpProofPattern(timelinePattern), []);
assert.equal(timelinePattern.source.artifactType, 'timeline_card');
assert.equal(timelinePattern.derivedWorkflow.relationCoverage, 'sequence_only');
assert.deepEqual(timelinePattern.derivedWorkflow.relations, []);
assert.equal(timelinePattern.derivedWorkflow.steps.length, timeline.events.length);

const pool = buildRwpTradePool(pattern, {
  label: 'China–Japan Inspection Proof Pool',
  scope: 'trade_corridor',
  summary: 'Reusable public proof rules for a purchase-order and inspection workflow.',
  createdAt: '2026-01-06T00:00:00.000Z'
});
assert.deepEqual(validateRwpTradePool(pool), []);
assert.equal(pool.assurance, RWP_TRADE_POOL_ASSURANCE);
assert.equal(pool.publicRules.provenance, 'pool_operator_declared');
assert.equal(pool.publicRules.reuseMode, 'independent_rwp_only');
assert.equal(pool.lineage.generation, 0);
assert.equal(pool.lineage.forkedFromPoolDigest, undefined);
assert.equal(pool.proofPattern.patternDigest, pattern.patternDigest);

const encoded = encodeRwpTradePool(pool);
assert.deepEqual(decodeRwpTradePool(encoded), pool);
const url = buildRwpTradePoolUrl(pool, 'https://example.test/path/rwp-graph.html');
assert.match(url, /rwp-pool\.html#pool=/);
assert.deepEqual(readRwpTradePoolFromHash(new URL(url).hash), pool);

const fork = forkRwpTradePool(pool, {
  label: 'Japan Food Import Inspection Pool',
  summary: 'A public fork with the same proof pattern and independently declared adoption rules.',
  evidenceCategories: ['inspection_report', 'packing_list', 'purchase_order'],
  createdAt: '2026-01-07T00:00:00.000Z'
});
assert.deepEqual(validateRwpTradePool(fork), []);
assert.equal(fork.lineage.generation, 1);
assert.equal(fork.lineage.forkedFromPoolDigest, pool.poolDigest);
assert.notEqual(fork.poolDigest, pool.poolDigest);
assert.equal(fork.proofPattern.patternDigest, pool.proofPattern.patternDigest);
assert.deepEqual(fork.publicRules.evidenceCategories, ['inspection_report', 'packing_list', 'purchase_order']);

const tamperedPattern = structuredClone(pattern);
tamperedPattern.declaredRequirements.roles.push('funder');
assert.ok(validateRwpProofPattern(tamperedPattern).some((error) => error.includes('patternDigest')));

const tamperedPool = structuredClone(pool);
tamperedPool.publicRules.statusGates = ['resolved'];
assert.ok(validateRwpTradePool(tamperedPool).some((error) => error.includes('poolDigest')));

const invalidRootLineage = structuredClone(pool);
invalidRootLineage.lineage.forkedFromPoolDigest = digest('a');
assert.ok(validateRwpTradePool(invalidRootLineage).some((error) => error.includes('generation zero')));

const publicJson = canonicalizeJson({ pattern, pool, fork });
for (const forbidden of ['passportId', 'evidenceId', 'fileName', 'displayName', 'goodsDescription', 'computedDigest', 'deliveryEndpoint', 'statement', 'proofValue']) {
  assert.equal(publicJson.includes(forbidden), false, `public Pool objects leaked ${forbidden}`);
}
assert.equal(publicJson.includes('China–Japan Inspection Proof Pool'), true);
assert.equal(publicJson.includes('inspection_report'), true);
assert.equal(publicJson.includes('independent_rwp_only'), true);

console.log('PASS: deterministic RWP Proof Patterns, public Trade Pools, fork lineage and zero source-data copying');
