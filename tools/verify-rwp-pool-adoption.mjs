import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProofCard, canonicalizeJson } from '../docs/rwp-card.mjs';
import { buildRwpRequest } from '../docs/rwp-request.mjs';
import { buildRwpRequestResponse } from '../docs/rwp-request-response.mjs';
import { buildRwpEvidencePackage } from '../docs/rwp-evidence-package.mjs';
import { buildRwpEvidenceReceipt } from '../docs/rwp-evidence-receipt.mjs';
import { buildRwpCaseGraph } from '../docs/rwp-case-graph.mjs';
import { buildRwpProofPattern, buildRwpTradePool } from '../docs/rwp-proof-pool.mjs';
import {
  RWP_POOL_ADOPTION_CARD_ASSURANCE,
  RWP_POOL_ADOPTION_RECEIPT_ASSURANCE,
  buildRwpPoolAdoptionCard,
  buildRwpPoolAdoptionCardUrl,
  buildRwpPoolAdoptionReceipt,
  decodeRwpPoolAdoptionCard,
  encodeRwpPoolAdoptionCard,
  readRwpPoolAdoptionCardFromHash,
  validateRwpPoolAdoptionCard,
  validateRwpPoolAdoptionReceipt
} from '../docs/rwp-pool-adoption.mjs';

const basePassport = JSON.parse(await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8'));

const buildChain = (passport, label, times) => {
  const card = buildProofCard(passport, { publicLabel: label });
  const request = buildRwpRequest(card, {
    requestedAction: 'request_authorized_evidence',
    requesterRole: 'buyer',
    evidenceTypes: ['inspection_report', 'purchase_order'],
    note: 'Please provide the minimum authorized evidence.',
    createdAt: times.request
  });
  const response = buildRwpRequestResponse(card, request, {
    status: 'accept',
    responderRole: 'exporter',
    mode: 'authorized_off_channel',
    evidenceTypes: ['inspection_report', 'purchase_order'],
    channelHint: 'secure_data_room',
    createdAt: times.response
  });
  const evidencePackage = buildRwpEvidencePackage(passport, card, request, response, {
    evidenceIds: ['evidence:purchase-order', 'evidence:inspection-summary'],
    createdAt: times.package
  });
  const evidenceResults = Object.fromEntries(evidencePackage.evidence.map((item) => [
    item.evidenceId,
    { status: 'matched', algorithm: item.digest.algorithm, computedDigest: item.digest.value }
  ]));
  const receipt = buildRwpEvidenceReceipt(evidencePackage, {
    receiverRole: 'buyer',
    evidenceResults,
    createdAt: times.receipt
  });
  const artifacts = [passport, card, request, response, evidencePackage, receipt];
  const graph = buildRwpCaseGraph(artifacts);
  return { passport, card, request, response, evidencePackage, receipt, artifacts, graph };
};

const source = buildChain(basePassport, 'Source Pool workflow', {
  request: '2026-08-01T00:00:00.000Z',
  response: '2026-08-01T00:05:00.000Z',
  package: '2026-08-01T00:10:00.000Z',
  receipt: '2026-08-01T00:20:00.000Z'
});
const pattern = buildRwpProofPattern(source.graph, {
  roles: ['buyer', 'exporter'],
  evidenceCategories: ['inspection_report', 'purchase_order'],
  statusGates: ['evidence_received']
});
const pool = buildRwpTradePool(pattern, {
  label: 'Independent Shipment Evidence Pool',
  scope: 'workflow',
  summary: 'A public workflow requiring matched purchase-order and inspection evidence.',
  createdAt: '2026-08-01T00:30:00.000Z'
});

const adopterPassport = structuredClone(basePassport);
adopterPassport.passportId = 'tpp:adopter:steel-cabinet:002';
adopterPassport.tradeCase.caseReference = 'SC-ADOPTER-002';
adopterPassport.createdAt = '2026-08-02T00:00:00.000Z';
adopterPassport.updatedAt = '2026-08-02T00:30:00.000Z';
const adopter = buildChain(adopterPassport, 'Independent adopter workflow', {
  request: '2026-08-02T01:00:00.000Z',
  response: '2026-08-02T01:05:00.000Z',
  package: '2026-08-02T01:10:00.000Z',
  receipt: '2026-08-02T01:20:00.000Z'
});
assert.notEqual(adopter.graph.source.passportDigest, source.graph.source.passportDigest);

const verified = buildRwpPoolAdoptionReceipt(pool, adopter.graph, {
  artifacts: adopter.artifacts,
  createdAt: '2026-08-02T01:30:00.000Z'
});
assert.deepEqual(validateRwpPoolAdoptionReceipt(verified, pool, adopter.graph), []);
assert.equal(verified.assurance, RWP_POOL_ADOPTION_RECEIPT_ASSURANCE);
assert.equal(verified.basis.observability, 'full_artifact_bundle');
assert.equal(verified.basis.artifactCount, adopter.artifacts.length);
assert.deepEqual(verified.basis.observedRoles.includes('buyer'), true);
assert.deepEqual(verified.basis.observedRoles.includes('exporter'), true);
assert.deepEqual(verified.basis.observedEvidenceCategories, ['inspection_report', 'purchase_order']);
assert.equal(verified.evaluation.adoptionStatus, 'verified_adoption');
assert.equal(verified.evaluation.proofLiquidityEligible, true);
assert.equal(verified.evaluation.checks.notSatisfied, 0);
assert.equal(verified.evaluation.checks.notObservable, 0);

const graphOnly = buildRwpPoolAdoptionReceipt(pool, adopter.graph, {
  createdAt: '2026-08-02T01:31:00.000Z'
});
assert.deepEqual(validateRwpPoolAdoptionReceipt(graphOnly, pool, adopter.graph), []);
assert.equal(graphOnly.basis.observability, 'graph_only');
assert.equal(graphOnly.evaluation.adoptionStatus, 'partial_adoption');
assert.equal(graphOnly.evaluation.proofLiquidityEligible, false);
assert.equal(graphOnly.evaluation.roles.every((item) => item.status === 'not_observable'), true);
assert.equal(graphOnly.evaluation.evidenceCategories.every((item) => item.status === 'not_observable'), true);

const wrongGatePool = buildRwpTradePool(pattern, {
  label: 'Resolved-only Pool',
  scope: 'workflow',
  roles: ['buyer', 'exporter'],
  evidenceCategories: ['inspection_report', 'purchase_order'],
  statusGates: ['resolved'],
  createdAt: '2026-08-01T00:31:00.000Z'
});
const rejected = buildRwpPoolAdoptionReceipt(wrongGatePool, adopter.graph, {
  artifacts: adopter.artifacts,
  createdAt: '2026-08-02T01:32:00.000Z'
});
assert.equal(rejected.evaluation.statusGate.status, 'not_satisfied');
assert.equal(rejected.evaluation.adoptionStatus, 'not_adopted');
assert.equal(rejected.evaluation.proofLiquidityEligible, false);

assert.throws(
  () => buildRwpPoolAdoptionReceipt(pool, source.graph, { artifacts: source.artifacts }),
  /independent RWP root/
);
assert.throws(
  () => buildRwpPoolAdoptionReceipt(pool, adopter.graph, { artifacts: source.artifacts }),
  /do not reproduce/
);

const card = buildRwpPoolAdoptionCard(verified, pool, adopter.graph);
assert.deepEqual(validateRwpPoolAdoptionCard(card), []);
assert.equal(card.assurance, RWP_POOL_ADOPTION_CARD_ASSURANCE);
assert.equal(card.adoptionStatus, 'verified_adoption');
assert.equal(card.proofLiquidityEligible, true);
const encoded = encodeRwpPoolAdoptionCard(card);
assert.deepEqual(decodeRwpPoolAdoptionCard(encoded), card);
const url = buildRwpPoolAdoptionCardUrl(card, 'https://example.test/unsafe/path.html?secret=1#old=1');
const parsed = new URL(url);
assert.equal(parsed.pathname, '/unsafe/rwp-adopt.html');
assert.equal(parsed.search, '');
assert.deepEqual(readRwpPoolAdoptionCardFromHash(parsed.hash), card);

const tamperedReceipt = structuredClone(verified);
tamperedReceipt.evaluation.proofLiquidityEligible = false;
assert.ok(validateRwpPoolAdoptionReceipt(tamperedReceipt, pool, adopter.graph).some((error) => /evaluation|receiptDigest/.test(error)));
const tamperedCard = structuredClone(card);
tamperedCard.proofLiquidityEligible = false;
assert.ok(validateRwpPoolAdoptionCard(tamperedCard).some((error) => /proofLiquidityEligible|cardDigest/.test(error)));

const publicJson = canonicalizeJson(card);
for (const forbidden of [
  'tpp:adopter:steel-cabinet:002',
  'evidence:purchase-order',
  'evidence:inspection-summary',
  'Example Exporter Ltd.',
  'party:exporter:example',
  'secure_data_room',
  'goodsDescription',
  'computedDigest'
]) {
  assert.equal(publicJson.includes(forbidden), false, `public Adoption Card leaked ${forbidden}`);
}
assert.equal(publicJson.includes(pool.poolDigest), true);
assert.equal(publicJson.includes(adopter.graph.graphDigest), true);
assert.equal(publicJson.includes('verified_adoption'), true);

console.log('PASS: independent Pool Adoption Receipts, full-bundle Proof Liquidity eligibility and privacy-bounded public cards');
