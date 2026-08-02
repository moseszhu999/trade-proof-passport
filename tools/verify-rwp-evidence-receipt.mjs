import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProofCard, canonicalizeJson } from '../docs/rwp-card.mjs';
import { buildRwpRequest } from '../docs/rwp-request.mjs';
import { buildRwpRequestResponse } from '../docs/rwp-request-response.mjs';
import { buildRwpEvidencePackage } from '../docs/rwp-evidence-package.mjs';
import {
  buildRwpEvidenceReceipt,
  validateRwpEvidenceReceipt,
  verifyReceivedEvidenceFileBytes,
  buildRwpEvidenceReceiptCard,
  validateRwpEvidenceReceiptCard,
  encodeRwpEvidenceReceiptCard,
  decodeRwpEvidenceReceiptCard,
  buildRwpEvidenceReceiptCardUrl,
  readRwpEvidenceReceiptCardFromHash
} from '../docs/rwp-evidence-receipt.mjs';

const passport = JSON.parse(await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8'));
const card = buildProofCard(passport, { publicLabel: 'Synthetic export proof' });
const request = buildRwpRequest(card, {
  requestedAction: 'request_authorized_evidence',
  requesterRole: 'buyer',
  evidenceTypes: ['inspection_report', 'purchase_order'],
  note: 'Please provide the authorized records.',
  createdAt: '2026-08-02T02:00:00.000Z'
});
const response = buildRwpRequestResponse(card, request, {
  status: 'accept',
  responderRole: 'exporter',
  mode: 'authorized_off_channel',
  evidenceTypes: ['inspection_report', 'purchase_order'],
  channelHint: 'secure_data_room',
  createdAt: '2026-08-02T02:05:00.000Z'
});
const evidencePackage = buildRwpEvidencePackage(passport, card, request, response, {
  evidenceIds: ['evidence:purchase-order', 'evidence:inspection-summary'],
  createdAt: '2026-08-02T02:10:00.000Z'
});
assert.equal(evidencePackage.coverage.complete, true);

const matchedResults = Object.fromEntries(evidencePackage.evidence.map((item) => [
  item.evidenceId,
  { status: 'matched', algorithm: item.digest.algorithm, computedDigest: item.digest.value }
]));
const received = buildRwpEvidenceReceipt(evidencePackage, {
  receiverRole: 'buyer',
  evidenceResults: matchedResults,
  createdAt: '2026-08-02T02:20:00.000Z'
});
assert.deepEqual(validateRwpEvidenceReceipt(received, evidencePackage), []);
assert.equal(received.outcome.status, 'received');
assert.equal(received.outcome.counts.matched, 2);
assert.match(received.receiptId, /^rwper:[0-9a-f]{16}$/);
assert.match(received.receiptDigest, /^0x[0-9a-f]{64}$/);

const incomplete = buildRwpEvidenceReceipt(evidencePackage, {
  receiverRole: 'buyer',
  evidenceResults: {
    [evidencePackage.evidence[0].evidenceId]: matchedResults[evidencePackage.evidence[0].evidenceId],
    [evidencePackage.evidence[1].evidenceId]: { status: 'missing' }
  },
  createdAt: '2026-08-02T02:21:00.000Z'
});
assert.equal(incomplete.outcome.status, 'incomplete');
assert.equal(incomplete.outcome.counts.missing, 1);
assert.deepEqual(validateRwpEvidenceReceipt(incomplete, evidencePackage), []);

const mismatchItem = evidencePackage.evidence[0];
const mismatch = buildRwpEvidenceReceipt(evidencePackage, {
  receiverRole: 'buyer',
  evidenceResults: {
    [mismatchItem.evidenceId]: { status: 'mismatch', algorithm: mismatchItem.digest.algorithm, computedDigest: 'f'.repeat(64) },
    [evidencePackage.evidence[1].evidenceId]: matchedResults[evidencePackage.evidence[1].evidenceId]
  },
  createdAt: '2026-08-02T02:22:00.000Z'
});
assert.equal(mismatch.outcome.status, 'mismatch');
assert.equal(mismatch.outcome.counts.mismatch, 1);
assert.deepEqual(validateRwpEvidenceReceipt(mismatch, evidencePackage), []);

const requestMore = buildRwpEvidenceReceipt(evidencePackage, {
  receiverRole: 'buyer',
  evidenceResults: matchedResults,
  outcome: 'request_more',
  note: 'Please provide the remaining authorization context through the existing channel.',
  createdAt: '2026-08-02T02:23:00.000Z'
});
assert.equal(requestMore.outcome.status, 'request_more');
assert.equal(requestMore.outcome.deterministicStatus, 'received');
assert.deepEqual(validateRwpEvidenceReceipt(requestMore, evidencePackage), []);
assert.throws(() => buildRwpEvidenceReceipt(evidencePackage, {
  receiverRole: 'buyer', evidenceResults: matchedResults, outcome: 'request_more'
}), /requires a public note/);
assert.throws(() => buildRwpEvidenceReceipt(evidencePackage, {
  receiverRole: 'buyer', evidenceResults: matchedResults, outcome: 'incomplete'
}), /deterministic outcome received/);

const tampered = { ...received, receiver: { role: 'funder' } };
assert.match(validateRwpEvidenceReceipt(tampered, evidencePackage).join(' '), /receiptDigest/);
const wrongPackage = { ...evidencePackage, packageDigest: `0x${'0'.repeat(64)}` };
assert.match(validateRwpEvidenceReceipt(received, wrongPackage).join(' '), /Evidence Package|source/);

const receiptCard = buildRwpEvidenceReceiptCard(received);
assert.deepEqual(validateRwpEvidenceReceiptCard(receiptCard), []);
const encodedCard = encodeRwpEvidenceReceiptCard(receiptCard);
assert.deepEqual(decodeRwpEvidenceReceiptCard(encodedCard), receiptCard);
const receiptUrl = buildRwpEvidenceReceiptCardUrl(receiptCard, 'https://example.test/unsafe/path.html?secret=1#old=1');
const parsedReceiptUrl = new URL(receiptUrl);
assert.equal(parsedReceiptUrl.pathname, '/unsafe/rwp-receive.html');
assert.equal(parsedReceiptUrl.search, '');
assert.deepEqual(readRwpEvidenceReceiptCardFromHash(parsedReceiptUrl.hash), receiptCard);
const publicSerialized = canonicalizeJson(receiptCard);
for (const forbidden of [
  'evidence:purchase-order',
  'evidence:inspection-summary',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '3333333333333333333333333333333333333333333333333333333333333333',
  'Example Exporter Ltd.',
  'party:exporter:example',
  'secure_data_room'
]) {
  assert.equal(publicSerialized.includes(forbidden), false, `public receipt card leaked ${forbidden}`);
}

const abcDigest = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const matchedFile = await verifyReceivedEvidenceFileBytes(
  { digest: { algorithm: 'sha256', value: abcDigest } },
  new TextEncoder().encode('abc')
);
assert.equal(matchedFile.status, 'matched');
const mismatchedFile = await verifyReceivedEvidenceFileBytes(
  { digest: { algorithm: 'sha256', value: abcDigest } },
  new TextEncoder().encode('abd')
);
assert.equal(mismatchedFile.status, 'mismatch');
const unsupported = await verifyReceivedEvidenceFileBytes(
  { digest: { algorithm: 'keccak256', value: 'a'.repeat(64) } },
  new TextEncoder().encode('abc')
);
assert.equal(unsupported.status, 'unsupported_algorithm');

console.log('PASS: Evidence Receipt outcomes, file verification, source binding and privacy-bounded public card');
