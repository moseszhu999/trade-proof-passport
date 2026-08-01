import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { buildProofCard, canonicalizeJson } from '../docs/rwp-card.mjs';
import {
  RWP_REQUEST_ASSURANCE,
  buildFollowUpLineage,
  buildRwpRequest,
  buildRwpRequestUrl,
  decodeRwpRequest,
  encodeRwpRequest,
  readRwpRequestFromHash,
  validateRwpRequest
} from '../docs/rwp-request.mjs';

const passport = JSON.parse(
  await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8')
);
const card = buildProofCard(passport, { publicLabel: 'Synthetic export proof' });
const createdAt = '2026-08-02T00:00:00.000Z';

const request = buildRwpRequest(card, {
  requestedAction: 'request_authorized_evidence',
  requesterRole: 'buyer',
  evidenceTypes: ['packing_list', 'inspection_report', 'packing_list'],
  note: 'Please provide the authorized inspection summary.',
  createdAt
});

assert.deepEqual(validateRwpRequest(request), []);
assert.match(request.requestId, /^rwpr:[0-9a-f]{16}$/);
assert.match(request.requestDigest, /^0x[0-9a-f]{64}$/);
assert.deepEqual(request.evidenceTypes, ['inspection_report', 'packing_list']);
assert.equal(request.source.passportDigest, card.sourceDigest);
assert.equal(request.source.cardDigest, card.cardDigest);
assert.equal(request.requester.role, 'buyer');
assert.equal(request.assurance, RWP_REQUEST_ASSURANCE);

const encoded = encodeRwpRequest(request);
assert.deepEqual(decodeRwpRequest(encoded), request);
const url = buildRwpRequestUrl(request, card, 'https://example.test/rwp.html?unsafe=removed#old=1');
const parsedUrl = new URL(url);
assert.equal(parsedUrl.search, '');
assert.ok(new URLSearchParams(parsedUrl.hash.slice(1)).get('card'));
assert.deepEqual(readRwpRequestFromHash(parsedUrl.hash), request);

const serialized = canonicalizeJson(request);
for (const forbidden of [
  'Example Exporter Ltd.',
  'Example Buyer Inc.',
  'party:exporter:example',
  'evidence://private',
  '1111111111111111111111111111111111111111111111111111111111111111',
  'The purchase order covers 240',
  'Synthetic confirmation for demonstration only.'
]) {
  assert.equal(serialized.includes(forbidden), false, `request leaked ${forbidden}`);
}

const tampered = { ...request, note: 'Changed after digest' };
assert.match(validateRwpRequest(tampered).join(' '), /requestDigest/);
assert.throws(() => buildRwpRequest(card, { requesterRole: 'anonymous-role' }), /Unsupported requester role/);
assert.throws(() => buildRwpRequest(card, { note: 'x'.repeat(281) }), /280/);
assert.throws(() => buildRwpRequestUrl({ ...request, source: { ...request.source, cardDigest: `0x${'0'.repeat(64)}` } }, card, 'https://example.test/rwp.html'), /requestDigest|source/);

const lineage = buildFollowUpLineage(card, {
  requestDigest: request.requestDigest,
  recordedAt: '2026-08-02T00:05:00.000Z'
});
assert.deepEqual(lineage, {
  relation: 'reuses_pattern_from',
  sourceArtifactType: 'RealWorldProofCard',
  sourceDigest: card.sourceDigest,
  sourceCardDigest: card.cardDigest,
  sourceRequestDigest: request.requestDigest,
  recordedAt: '2026-08-02T00:05:00.000Z'
});

const followUpPassport = {
  schemaVersion: '0.1',
  passportId: 'tpp:follow-up:test:001',
  createdAt: '2026-08-02T00:06:00.000Z',
  updatedAt: '2026-08-02T00:06:00.000Z',
  tradeCase: {
    caseReference: 'FOLLOW-UP-001',
    goodsDescription: 'Distinct follow-up trade workflow',
    quantity: 1,
    unit: 'workflow'
  },
  parties: [
    { partyId: 'party:buyer:follow-up', role: 'buyer', displayName: 'Follow-up creator' }
  ],
  facts: [
    {
      factId: 'fact:initial:v1',
      type: 'initial_trade_assertion',
      statement: 'A distinct follow-up workflow was created from a public RWP pattern.',
      status: 'asserted',
      version: 1,
      assertedBy: 'party:buyer:follow-up',
      assertedAt: '2026-08-02T00:06:00.000Z',
      evidenceRefs: [],
      provenanceRefs: []
    }
  ],
  evidence: [],
  provenance: [],
  confirmations: [],
  lineage: [lineage],
  lifecycle: { status: 'draft' },
  disclosure: { profile: 'private', permittedAudience: [] }
};

await writeFile('/tmp/rwp-follow-up-passport.json', `${JSON.stringify(followUpPassport, null, 2)}\n`);
console.log('PASS: privacy-bounded RWP Request digest, link integrity and viral lineage');
