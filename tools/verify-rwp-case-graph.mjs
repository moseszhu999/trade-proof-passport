import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildProofCard
} from '../docs/rwp-card.mjs';
import {
  buildRwpRequest
} from '../docs/rwp-request.mjs';
import {
  buildRwpRequestResponse
} from '../docs/rwp-request-response.mjs';
import {
  buildRwpEvidencePackage
} from '../docs/rwp-evidence-package.mjs';
import {
  buildRwpEvidenceReceipt
} from '../docs/rwp-evidence-receipt.mjs';
import {
  buildRwpEvidenceResolution,
  buildRwpEvidenceResolutionReceipt
} from '../docs/rwp-evidence-resolution.mjs';
import {
  buildRwpCaseGraph,
  validateRwpCaseGraph,
  buildRwpTimelineCard,
  validateRwpTimelineCard,
  encodeRwpTimelineCard,
  decodeRwpTimelineCard,
  buildRwpTimelineCardUrl,
  readRwpTimelineCardFromHash
} from '../docs/rwp-case-graph.mjs';

const passport = JSON.parse(await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8'));
const card = buildProofCard(passport, { publicLabel: 'Steel cabinet trade proof' });

const evidenceRequest = buildRwpRequest(card, {
  requestedAction: 'request_authorized_evidence',
  requesterRole: 'buyer',
  evidenceTypes: ['purchase_order', 'inspection_report'],
  createdAt: '2026-07-31T16:00:00Z'
});
const changeRequest = buildRwpRequest(card, {
  requestedAction: 'request_change',
  requesterRole: 'legal',
  createdAt: '2026-07-31T16:05:00Z',
  note: 'Please clarify the current proof state.'
});

const evidenceResponse = buildRwpRequestResponse(card, evidenceRequest, {
  status: 'accept',
  responderRole: 'exporter',
  mode: 'authorized_off_channel',
  evidenceTypes: ['purchase_order', 'inspection_report'],
  channelHint: 'existing_business_channel',
  createdAt: '2026-07-31T16:10:00Z'
});
const declineResponse = buildRwpRequestResponse(card, changeRequest, {
  status: 'decline',
  responderRole: 'exporter',
  createdAt: '2026-07-31T16:15:00Z',
  note: 'No public change is accepted.'
});

const evidencePackage = buildRwpEvidencePackage(passport, card, evidenceRequest, evidenceResponse, {
  evidenceIds: ['evidence:purchase-order'],
  fileVerifications: {
    'evidence:purchase-order': {
      status: 'matched',
      algorithm: 'sha256',
      computedDigest: '1111111111111111111111111111111111111111111111111111111111111111'
    }
  },
  createdAt: '2026-07-31T16:20:00Z'
});
assert.equal(evidencePackage.coverage.complete, false);
assert.deepEqual(evidencePackage.coverage.missingCategories, ['inspection_report']);

const evidenceReceipt = buildRwpEvidenceReceipt(evidencePackage, {
  receiverRole: 'buyer',
  outcome: 'mismatch',
  evidenceResults: {
    'evidence:purchase-order': {
      status: 'mismatch',
      algorithm: 'sha256',
      computedDigest: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    }
  },
  createdAt: '2026-07-31T16:30:00Z'
});
assert.equal(evidenceReceipt.outcome.status, 'mismatch');

const resolution = buildRwpEvidenceResolution(evidencePackage, evidenceReceipt, passport, {
  evidenceIds: ['evidence:purchase-order', 'evidence:inspection-summary'],
  fileVerifications: {
    'evidence:purchase-order': {
      status: 'matched',
      algorithm: 'sha256',
      computedDigest: '1111111111111111111111111111111111111111111111111111111111111111'
    },
    'evidence:inspection-summary': {
      status: 'matched',
      algorithm: 'sha256',
      computedDigest: '3333333333333333333333333333333333333333333333333333333333333333'
    }
  },
  createdAt: '2026-07-31T16:40:00Z'
});
assert.equal(resolution.resolution.mode, 'combined');
assert.equal(resolution.resolution.complete, true);

const resolutionReceipt = buildRwpEvidenceResolutionReceipt(resolution, {
  receiverRole: 'buyer',
  outcome: 'resolved',
  evidenceResults: {
    'evidence:purchase-order': {
      status: 'matched',
      algorithm: 'sha256',
      computedDigest: '1111111111111111111111111111111111111111111111111111111111111111'
    },
    'evidence:inspection-summary': {
      status: 'matched',
      algorithm: 'sha256',
      computedDigest: '3333333333333333333333333333333333333333333333333333333333333333'
    }
  },
  createdAt: '2026-07-31T16:50:00Z'
});
assert.equal(resolutionReceipt.outcome.status, 'resolved');

const artifacts = [
  resolutionReceipt,
  declineResponse,
  passport,
  evidenceReceipt,
  card,
  evidenceRequest,
  resolution,
  changeRequest,
  evidencePackage,
  evidenceResponse
];
const graph = buildRwpCaseGraph(artifacts);
assert.deepEqual(validateRwpCaseGraph(graph), []);
assert.equal(graph.nodes.length, 10);
assert.equal(graph.edges.length, 10);
assert.equal(graph.summary.counts.request, 2);
assert.equal(graph.summary.counts.request_response, 2);
assert.equal(graph.summary.counts.evidence_package, 1);
assert.equal(graph.summary.counts.evidence_receipt, 1);
assert.equal(graph.summary.counts.evidence_resolution, 1);
assert.equal(graph.summary.counts.evidence_resolution_receipt, 1);
assert.equal(graph.summary.statusCounts.mismatch, 1);
assert.equal(graph.summary.statusCounts.resolved, 1);
assert.equal(graph.summary.currentState, 'resolved');
assert.equal(graph.projectedAt, '2026-07-31T16:50:00.000Z');
assert.equal(graph.nodes.some((node) => node.status === 'decline'), true);
assert.equal(graph.nodes.some((node) => node.status === 'mismatch'), true);
assert.equal(graph.nodes.at(-1).status, 'resolved');
assert.equal(buildRwpCaseGraph([...artifacts].reverse()).graphDigest, graph.graphDigest);

const expectedRelations = new Set([
  'projects_to',
  'requests_from',
  'responds_to',
  'packages_for',
  'receives',
  'resolves_package',
  'resolves_receipt',
  'verifies_resolution'
]);
for (const relation of expectedRelations) assert.equal(graph.edges.some((edge) => edge.relation === relation), true);

const timeline = buildRwpTimelineCard(graph);
assert.deepEqual(validateRwpTimelineCard(timeline), []);
assert.equal(timeline.currentState, 'resolved');
assert.equal(timeline.events.length, 10);
assert.equal(timeline.counts.events, 10);
assert.equal(timeline.counts.edges, 10);
assert.equal(timeline.counts.requests, 2);
assert.equal(timeline.counts.resolved, 1);
assert.equal(timeline.counts.mismatch, 1);
assert.equal(timeline.events.some((event) => event.status === 'decline'), true);
assert.equal(timeline.events.some((event) => event.status === 'mismatch'), true);
assert.equal(timeline.events.at(-1).status, 'resolved');

const encoded = encodeRwpTimelineCard(timeline);
assert.deepEqual(decodeRwpTimelineCard(encoded), timeline);
const url = buildRwpTimelineCardUrl(timeline, 'https://moseszhu999.github.io/trade-proof-passport/rwp.html');
assert.match(url, /rwp-graph\.html#timeline=/);
assert.deepEqual(readRwpTimelineCardFromHash(new URL(url).hash), timeline);

const publicText = JSON.stringify(timeline);
for (const forbidden of [
  'evidence:purchase-order',
  'evidence:inspection-summary',
  'Example Exporter',
  'Example Buyer',
  'goodsDescription',
  'computedDigest',
  'evidence://',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '3333333333333333333333333333333333333333333333333333333333333333'
]) assert.equal(publicText.includes(forbidden), false, `public timeline leaked ${forbidden}`);

const tamperedGraph = structuredClone(graph);
tamperedGraph.summary.currentState = 'proof_available';
assert.match(validateRwpCaseGraph(tamperedGraph).join(' '), /graphDigest does not match/);
const tamperedTimeline = structuredClone(timeline);
tamperedTimeline.events[0].status = 'forged';
assert.match(validateRwpTimelineCard(tamperedTimeline).join(' '), /timelineDigest does not match/);

assert.throws(
  () => buildRwpCaseGraph([passport, card, buildRwpRequest(card, {
    requesterRole: 'buyer',
    requestedAction: 'request_change',
    createdAt: '2026-07-31T14:00:00Z'
  })]),
  /chronology violation/
);
assert.throws(() => buildRwpCaseGraph([passport, card, card]), /exactly one Proof Card|Duplicate/);

console.log('PASS: deterministic branched RWP Case Graph, append-only timeline and privacy-bounded public card');
