#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HANDOFF_CONFIRMATION_TEXT, RECEIPT_REVIEW_CONFIRMATION_TEXT,
  VERIFICATION_RECEIPT_VERSION, approveVerificationHandoff, buildReceiptTemplate,
  buildVerificationHandoffPackage, buildVerificationWorkspaceModel, confirmVerificationReview,
  createVerificationReview, createVerificationTask, createVerificationWorkspace,
  upsertVerificationReceipt, upsertVerificationReview, upsertVerificationTask,
  validateReceiptAgainstTask, validateVerificationReview, validateVerificationTask,
  validateVerificationWorkspace
} from '../docs/evidence-verification-core.mjs';

const html = await readFile(new URL('../docs/evidence-verification.html', import.meta.url), 'utf8');
const ui = await readFile(new URL('../docs/evidence-verification.mjs', import.meta.url), 'utf8');
const core = await readFile(new URL('../docs/evidence-verification-core.mjs', import.meta.url), 'utf8');
const operations = await readFile(new URL('../docs/operations.html', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/evidence-verification.schema.json', import.meta.url), 'utf8'));
assert.equal(schema.title.includes('v0.9'), true);

const digest = `sha256:${'a'.repeat(64)}`;
const evidence = {
  evidenceId: 'supplier-evidence:china-loong:aaaa', caseId: 'case-1', requestId: 'request-1', candidateId: 'supplier-1', contentDigest: digest,
  source: { fileName: 'certificate.txt', mediaType: 'text/plain', size: 200 },
  extractedFindings: [
    { findingId: 'f1', field: 'legal_entity', value: 'China Loong Co., Ltd.', excerpt: 'Legal Entity: China Loong Co., Ltd.', state: 'confirmed_in_local_file', sourceConfirmed: true },
    { findingId: 'f2', field: 'certificate_number', value: 'CE-12345', excerpt: 'Certificate No: CE-12345', state: 'confirmed_in_local_file', sourceConfirmed: true },
    { findingId: 'f3', field: 'issuer', value: 'Example Certification Body', excerpt: 'Issued By: Example Certification Body', state: 'confirmed_in_local_file', sourceConfirmed: true },
    { findingId: 'f4', field: 'product_scope', value: 'Hospital beds', excerpt: 'Product Scope: Hospital beds', state: 'candidate_unconfirmed', sourceConfirmed: false }
  ],
  boundaries: { evidenceVerified: false }
};
const task = createVerificationTask(evidence, ['f1', 'f2', 'f3'], { verifierName: 'Independent Review Lab', verifierType: 'testing_laboratory', contactReference: 'holder supplied' }, '2026-08-03T02:00:00.000Z');
assert.deepEqual(validateVerificationTask(task), []);
assert.equal(task.selectedFindings.length, 3);
assert.throws(() => createVerificationTask(evidence, ['f4'], { verifierName: 'Lab', verifierType: 'other' }), /not confirmed/);
assert.throws(() => approveVerificationHandoff(task, 'approve'), /exact/);
const approved = approveVerificationHandoff(task, HANDOFF_CONFIRMATION_TEXT, '2026-08-03T02:01:00.000Z');
const handoff = buildVerificationHandoffPackage(approved);
assert.equal(handoff.requestedChecks.length, 3);
assert.equal(handoff.boundaries.originalFileIncluded, false);
assert.equal(handoff.boundaries.externalRequestSent, false);
const receipt = buildReceiptTemplate(approved);
assert.equal(receipt.schemaVersion, VERIFICATION_RECEIPT_VERSION);
receipt.receiptId = 'receipt-1';
receipt.reviewedAt = '2026-08-03T03:00:00.000Z';
receipt.fieldResults[0] = { ...receipt.fieldResults[0], outcome: 'supported', observedValue: 'China Loong Co., Ltd.', rationale: 'record shown', sourceReference: 'ref-1' };
receipt.fieldResults[1] = { ...receipt.fieldResults[1], outcome: 'supported', observedValue: 'CE-12345', rationale: 'number matched', sourceReference: 'ref-2' };
receipt.fieldResults[2] = { ...receipt.fieldResults[2], outcome: 'inconclusive', observedValue: null, rationale: 'issuer response pending', sourceReference: null };
assert.deepEqual(validateReceiptAgainstTask(approved, receipt), []);
const review = createVerificationReview(approved, receipt, '2026-08-03T03:01:00.000Z');
assert.equal(review.assessment, 'inconclusive');
assert.throws(() => confirmVerificationReview(review, 'confirm'), /exact/);
const confirmed = confirmVerificationReview(review, RECEIPT_REVIEW_CONFIRMATION_TEXT, '2026-08-03T03:02:00.000Z');
assert.equal(confirmed.humanReviewConfirmed, true);
assert.equal(confirmed.boundaries.evidenceVerified, false);
assert.deepEqual(validateVerificationReview(confirmed), []);
const contradictory = structuredClone(receipt);
contradictory.receiptId = 'receipt-2';
contradictory.fieldResults[1].outcome = 'contradicted';
assert.equal(createVerificationReview(approved, contradictory).assessment, 'contradicted');
const badDigest = structuredClone(receipt);
badDigest.contentDigest = `sha256:${'b'.repeat(64)}`;
assert.equal(validateReceiptAgainstTask(approved, badDigest).some((item) => item.includes('mismatch')), true);

let workspace = createVerificationWorkspace({ caseId: 'case-1' }, { queueId: 'queue-1', caseId: 'case-1' });
workspace = upsertVerificationTask(workspace, approved);
workspace = upsertVerificationReceipt(workspace, approved, receipt);
workspace = upsertVerificationReview(workspace, confirmed);
assert.deepEqual(validateVerificationWorkspace(workspace), []);
const model = buildVerificationWorkspaceModel(workspace);
assert.equal(model.counts.tasks, 1);
assert.equal(model.counts.receipts, 1);
assert.equal(model.counts.inconclusive, 1);
assert.equal(model.counts.verifiedEvidence, 0);
assert.equal(model.counts.supplierEligibilityDecisions, 0);

for (const marker of ['data-evidence-verification-root', 'APPROVE VERIFICATION HANDOFF', 'supported', 'contradicted', 'inconclusive']) assert.equal(html.includes(marker) || ui.includes(marker) || core.includes(marker), true, `surface missing ${marker}`);
assert.equal(operations.includes('./evidence-verification.html'), true);
assert.equal(/fetch\(|XMLHttpRequest|WebSocket/.test(core), false, 'core must not perform network access');
assert.equal(/sendMail|smtp|nodemailer|gmail|outlook|registryLookup/i.test(core), false, 'core must not contain connector runtime');

console.log('PASS: Evidence External Verification Handoff v0.9');
console.log('Verification tasks: 1');
console.log('Selected confirmed findings: 3');
console.log('Receipts: 1');
console.log('Candidate assessment: inconclusive');
console.log('Verified evidence: 0');
console.log('External sends/connectors: 0');
console.log('Supplier eligibility decisions: 0');
