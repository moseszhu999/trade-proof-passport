import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProofCard, canonicalizeJson } from '../docs/rwp-card.mjs';
import { buildRwpRequest } from '../docs/rwp-request.mjs';
import { buildRwpRequestResponse } from '../docs/rwp-request-response.mjs';
import { buildRwpEvidencePackage } from '../docs/rwp-evidence-package.mjs';
import { buildRwpEvidenceReceipt } from '../docs/rwp-evidence-receipt.mjs';
import {
  buildRwpEvidenceResolution,
  buildRwpEvidenceResolutionCard,
  buildRwpEvidenceResolutionCardUrl,
  buildRwpEvidenceResolutionReceipt,
  decodeRwpEvidenceResolutionCard,
  encodeRwpEvidenceResolutionCard,
  readRwpEvidenceResolutionCardFromHash,
  validateRwpEvidenceResolution,
  validateRwpEvidenceResolutionCard,
  validateRwpEvidenceResolutionReceipt,
  verifyResolutionEvidenceFileBytes
} from '../docs/rwp-evidence-resolution.mjs';

const passport = JSON.parse(
  await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8')
);
const card = buildProofCard(passport, { publicLabel: 'Synthetic resolution proof' });
const request = buildRwpRequest(card, {
  requestedAction: 'request_authorized_evidence',
  requesterRole: 'buyer',
  evidenceTypes: ['inspection_report', 'purchase_order'],
  note: 'Please provide the authorized order and inspection records.',
  createdAt: '2026-08-02T02:00:00.000Z'
});
const response = buildRwpRequestResponse(card, request, {
  status: 'accept',
  responderRole: 'exporter',
  mode: 'authorized_off_channel',
  evidenceTypes: ['inspection_report', 'purchase_order'],
  channelHint: 'existing_business_channel',
  createdAt: '2026-08-02T02:05:00.000Z'
});

const purchaseOrder = passport.evidence.find((item) => item.evidenceId === 'evidence:purchase-order');
const inspection = passport.evidence.find((item) => item.evidenceId === 'evidence:inspection-summary');
assert.ok(purchaseOrder);
assert.ok(inspection);

const originalPackage = buildRwpEvidencePackage(passport, card, request, response, {
  evidenceIds: [purchaseOrder.evidenceId],
  fileVerifications: {
    [purchaseOrder.evidenceId]: {
      status: 'matched',
      algorithm: purchaseOrder.digest.algorithm,
      computedDigest: purchaseOrder.digest.value
    }
  },
  createdAt: '2026-08-02T02:10:00.000Z'
});
assert.equal(originalPackage.coverage.complete, false);
assert.deepEqual(originalPackage.coverage.missingCategories, ['inspection_report']);

const mismatchDigest = `9${purchaseOrder.digest.value.slice(1)}`;
const priorReceipt = buildRwpEvidenceReceipt(originalPackage, {
  receiverRole: 'buyer',
  evidenceResults: {
    [purchaseOrder.evidenceId]: {
      status: 'mismatch',
      algorithm: purchaseOrder.digest.algorithm,
      computedDigest: mismatchDigest
    }
  },
  createdAt: '2026-08-02T02:15:00.000Z'
});
assert.equal(priorReceipt.outcome.status, 'mismatch');
assert.equal(priorReceipt.outcome.deterministicStatus, 'mismatch');

const resolution = buildRwpEvidenceResolution(originalPackage, priorReceipt, passport, {
  evidenceIds: [purchaseOrder.evidenceId, inspection.evidenceId],
  fileVerifications: {
    [purchaseOrder.evidenceId]: {
      status: 'matched',
      algorithm: purchaseOrder.digest.algorithm,
      computedDigest: purchaseOrder.digest.value
    },
    [inspection.evidenceId]: {
      status: 'matched',
      algorithm: inspection.digest.algorithm,
      computedDigest: inspection.digest.value
    }
  },
  note: 'Redelivered the order file and added the authorized inspection record.',
  createdAt: '2026-08-02T02:20:00.000Z'
});

assert.deepEqual(validateRwpEvidenceResolution(resolution), []);
assert.equal(resolution.resolution.mode, 'combined');
assert.equal(resolution.resolution.complete, true);
assert.equal(resolution.resolution.issueCount, 2);
assert.deepEqual(resolution.resolution.addressedIssueKeys, [
  'category:inspection_report',
  'evidence:evidence:purchase-order'
]);
assert.deepEqual(resolution.resolution.unresolvedIssueKeys, []);
assert.deepEqual(
  resolution.evidence.map((item) => [item.evidenceId, item.relation]),
  [
    ['evidence:inspection-summary', 'supplemental'],
    ['evidence:purchase-order', 'redelivery']
  ]
);

const resolvedReceipt = buildRwpEvidenceResolutionReceipt(resolution, {
  receiverRole: 'buyer',
  evidenceResults: {
    [purchaseOrder.evidenceId]: {
      status: 'matched',
      algorithm: purchaseOrder.digest.algorithm,
      computedDigest: purchaseOrder.digest.value
    },
    [inspection.evidenceId]: {
      status: 'matched',
      algorithm: inspection.digest.algorithm,
      computedDigest: inspection.digest.value
    }
  },
  createdAt: '2026-08-02T02:25:00.000Z'
});
assert.deepEqual(validateRwpEvidenceResolutionReceipt(resolvedReceipt, resolution), []);
assert.equal(resolvedReceipt.outcome.status, 'resolved');
assert.equal(resolvedReceipt.outcome.deterministicStatus, 'resolved');
assert.equal(resolvedReceipt.outcome.priorIssuesFullyAddressed, true);

const unresolvedReceipt = buildRwpEvidenceResolutionReceipt(resolution, {
  receiverRole: 'buyer',
  evidenceResults: {
    [purchaseOrder.evidenceId]: {
      status: 'matched',
      algorithm: purchaseOrder.digest.algorithm,
      computedDigest: purchaseOrder.digest.value
    },
    [inspection.evidenceId]: {
      status: 'missing',
      algorithm: inspection.digest.algorithm
    }
  },
  createdAt: '2026-08-02T02:26:00.000Z'
});
assert.equal(unresolvedReceipt.outcome.status, 'unresolved');
assert.equal(unresolvedReceipt.outcome.deterministicStatus, 'unresolved');

const requestMoreReceipt = buildRwpEvidenceResolutionReceipt(resolution, {
  receiverRole: 'buyer',
  outcome: 'request_more',
  evidenceResults: {
    [purchaseOrder.evidenceId]: {
      status: 'matched',
      algorithm: purchaseOrder.digest.algorithm,
      computedDigest: purchaseOrder.digest.value
    },
    [inspection.evidenceId]: {
      status: 'missing',
      algorithm: inspection.digest.algorithm
    }
  },
  note: 'Please deliver the inspection record through the authorized channel.',
  createdAt: '2026-08-02T02:27:00.000Z'
});
assert.equal(requestMoreReceipt.outcome.status, 'request_more');
assert.equal(requestMoreReceipt.outcome.deterministicStatus, 'unresolved');
assert.deepEqual(validateRwpEvidenceResolutionReceipt(requestMoreReceipt, resolution), []);

const publicCard = buildRwpEvidenceResolutionCard(resolvedReceipt);
assert.deepEqual(validateRwpEvidenceResolutionCard(publicCard), []);
const encoded = encodeRwpEvidenceResolutionCard(publicCard);
assert.deepEqual(decodeRwpEvidenceResolutionCard(encoded), publicCard);
const cardUrl = buildRwpEvidenceResolutionCardUrl(publicCard, 'https://example.test/rwp-resolve.html?unsafe=removed#old=1');
const parsedCardUrl = new URL(cardUrl);
assert.equal(parsedCardUrl.pathname, '/rwp-resolve.html');
assert.equal(parsedCardUrl.search, '');
assert.deepEqual(readRwpEvidenceResolutionCardFromHash(parsedCardUrl.hash), publicCard);

const publicSerialized = canonicalizeJson(publicCard);
for (const forbidden of [
  'evidence:purchase-order',
  'evidence:inspection-summary',
  purchaseOrder.digest.value,
  inspection.digest.value,
  'Example Exporter Ltd.',
  'party:exporter:example',
  'evidence://private'
]) {
  assert.equal(publicSerialized.includes(forbidden), false, `Resolution Card leaked ${forbidden}`);
}

assert.match(validateRwpEvidenceResolution({ ...resolution, note: 'changed after digest' }).join(' '), /resolutionDigest/);
assert.match(validateRwpEvidenceResolutionReceipt({ ...resolvedReceipt, note: 'changed after digest' }, resolution).join(' '), /receiptDigest/);
assert.throws(
  () => buildRwpEvidenceResolution(originalPackage, priorReceipt, passport, {
    evidenceIds: ['evidence:logistics-status'],
    fileVerifications: {
      'evidence:logistics-status': {
        status: 'matched',
        algorithm: 'sha256',
        computedDigest: passport.evidence.find((item) => item.evidenceId === 'evidence:logistics-status').digest.value
      }
    }
  }),
  /did not authorize/
);

const fullyReceivedPackage = buildRwpEvidencePackage(passport, card, request, response, {
  evidenceIds: [purchaseOrder.evidenceId, inspection.evidenceId],
  fileVerifications: {
    [purchaseOrder.evidenceId]: { status: 'matched', algorithm: 'sha256', computedDigest: purchaseOrder.digest.value },
    [inspection.evidenceId]: { status: 'matched', algorithm: 'sha256', computedDigest: inspection.digest.value }
  },
  createdAt: '2026-08-02T02:30:00.000Z'
});
const fullyReceivedReceipt = buildRwpEvidenceReceipt(fullyReceivedPackage, {
  receiverRole: 'buyer',
  evidenceResults: {
    [purchaseOrder.evidenceId]: { status: 'matched', algorithm: 'sha256', computedDigest: purchaseOrder.digest.value },
    [inspection.evidenceId]: { status: 'matched', algorithm: 'sha256', computedDigest: inspection.digest.value }
  },
  createdAt: '2026-08-02T02:31:00.000Z'
});
assert.equal(fullyReceivedReceipt.outcome.status, 'received');
assert.throws(
  () => buildRwpEvidenceResolution(fullyReceivedPackage, fullyReceivedReceipt, passport, {
    evidenceIds: [purchaseOrder.evidenceId],
    fileVerifications: {
      [purchaseOrder.evidenceId]: { status: 'matched', algorithm: 'sha256', computedDigest: purchaseOrder.digest.value }
    }
  }),
  /no unresolved issue/
);

const bytes = new TextEncoder().encode('resolution-file-bytes');
const digest = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
const localResult = await verifyResolutionEvidenceFileBytes({ digest: { algorithm: 'sha256', value: digest } }, bytes);
assert.equal(localResult.status, 'matched');

console.log('PASS: append-only RWP Evidence Resolution, re-verification and privacy-bounded resolution cards');
