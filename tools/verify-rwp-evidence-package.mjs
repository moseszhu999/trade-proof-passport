import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProofCard, canonicalizeJson } from '../docs/rwp-card.mjs';
import { buildRwpRequest } from '../docs/rwp-request.mjs';
import { buildRwpRequestResponse } from '../docs/rwp-request-response.mjs';
import {
  RWP_EVIDENCE_PACKAGE_ASSURANCE,
  buildRwpEvidencePackage,
  evidenceCategoryForType,
  validateRwpEvidencePackage,
  verifyEvidenceFileBytes
} from '../docs/rwp-evidence-package.mjs';

const passport = JSON.parse(
  await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8')
);
const card = buildProofCard(passport, { publicLabel: 'Synthetic export proof' });
const request = buildRwpRequest(card, {
  requestedAction: 'request_authorized_evidence',
  requesterRole: 'buyer',
  evidenceTypes: ['inspection_report', 'purchase_order'],
  note: 'Please provide the minimum authorized evidence.',
  createdAt: '2026-08-02T02:00:00.000Z'
});
const response = buildRwpRequestResponse(card, request, {
  status: 'accept',
  responderRole: 'exporter',
  mode: 'authorized_off_channel',
  evidenceTypes: ['inspection_report', 'purchase_order'],
  channelHint: 'secure_data_room',
  note: 'The authorized categories can be reviewed through the existing secure workflow.',
  createdAt: '2026-08-02T02:05:00.000Z'
});

assert.equal(evidenceCategoryForType('inspection_summary'), 'inspection_report');
assert.equal(evidenceCategoryForType('logistics_status_record'), 'logistics_event');
assert.equal(evidenceCategoryForType('purchase_order'), 'purchase_order');
assert.equal(evidenceCategoryForType('unknown_internal_record'), 'other');

const complete = buildRwpEvidencePackage(passport, card, request, response, {
  evidenceIds: ['evidence:purchase-order', 'evidence:inspection-summary'],
  createdAt: '2026-08-02T02:10:00.000Z'
});
assert.deepEqual(validateRwpEvidencePackage(complete), []);
assert.match(complete.packageId, /^rwpep:[0-9a-f]{16}$/);
assert.match(complete.packageDigest, /^0x[0-9a-f]{64}$/);
assert.equal(complete.assurance, RWP_EVIDENCE_PACKAGE_ASSURANCE);
assert.equal(complete.coverage.complete, true);
assert.deepEqual(complete.coverage.allowedCategories, ['inspection_report', 'purchase_order']);
assert.deepEqual(complete.coverage.includedCategories, ['inspection_report', 'purchase_order']);
assert.deepEqual(complete.coverage.missingCategories, []);
assert.equal(complete.source.passportDigest, card.sourceDigest);
assert.equal(complete.source.cardDigest, card.cardDigest);
assert.equal(complete.source.requestDigest, request.requestDigest);
assert.equal(complete.source.responseDigest, response.responseDigest);
assert.equal(complete.evidence.every((item) => item.fileVerification.status === 'not_checked'), true);

const partial = buildRwpEvidencePackage(passport, card, request, response, {
  evidenceIds: ['evidence:purchase-order'],
  createdAt: '2026-08-02T02:11:00.000Z'
});
assert.deepEqual(validateRwpEvidencePackage(partial), []);
assert.equal(partial.coverage.complete, false);
assert.deepEqual(partial.coverage.missingCategories, ['inspection_report']);

const serialized = canonicalizeJson(complete);
for (const forbidden of [
  'evidence://private',
  'Example Exporter Ltd.',
  'Example Buyer Inc.',
  'party:exporter:example',
  'goodsDescription',
  'The purchase order covers 240',
  '@example.com',
  'https://example.com'
]) {
  assert.equal(serialized.includes(forbidden), false, `evidence package leaked ${forbidden}`);
}

const abcDigest = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const matched = await verifyEvidenceFileBytes(
  { digest: { algorithm: 'sha256', value: abcDigest } },
  new TextEncoder().encode('abc')
);
assert.deepEqual(matched, { status: 'matched', algorithm: 'sha256', computedDigest: abcDigest });
const mismatch = await verifyEvidenceFileBytes(
  { digest: { algorithm: 'sha256', value: '0'.repeat(64) } },
  new TextEncoder().encode('abc')
);
assert.equal(mismatch.status, 'mismatch');
assert.equal(mismatch.computedDigest, abcDigest);
assert.deepEqual(
  await verifyEvidenceFileBytes(
    { digest: { algorithm: 'keccak256', value: '0'.repeat(64) } },
    new TextEncoder().encode('abc')
  ),
  { status: 'unsupported_algorithm', algorithm: 'keccak256' }
);

assert.throws(
  () => buildRwpEvidencePackage(passport, card, request, response, {
    evidenceIds: ['evidence:specification']
  }),
  /did not authorize/
);
assert.throws(
  () => buildRwpEvidencePackage({ ...passport, updatedAt: '2026-08-02T03:00:00.000Z' }, card, request, response, {
    evidenceIds: ['evidence:purchase-order']
  }),
  /Passport digest does not match/
);

const declined = buildRwpRequestResponse(card, request, {
  status: 'decline',
  responderRole: 'exporter',
  mode: 'none',
  evidenceTypes: [],
  note: 'The disclosure is not authorized.',
  createdAt: '2026-08-02T02:12:00.000Z'
});
assert.throws(
  () => buildRwpEvidencePackage(passport, card, request, declined, {
    evidenceIds: ['evidence:purchase-order']
  }),
  /accepted or partially accepted/
);

const tampered = structuredClone(complete);
tampered.coverage.complete = false;
assert.match(validateRwpEvidencePackage(tampered).join(' '), /coverage.complete|packageDigest/);

const falseMatch = structuredClone(complete);
falseMatch.evidence[0].fileVerification = {
  status: 'matched',
  algorithm: falseMatch.evidence[0].digest.algorithm,
  computedDigest: '0'.repeat(64)
};
assert.match(validateRwpEvidencePackage(falseMatch).join(' '), /packageDigest|fileVerification/);

console.log('PASS: authorized RWP Evidence Package source binding, category limits, local digest checks and tamper resistance');
