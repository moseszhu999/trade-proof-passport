#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MAX_EVIDENCE_FILE_BYTES, MAX_TEXT_PARSE_BYTES,
  SUPPLIER_EVIDENCE_ITEM_VERSION, SUPPLIER_EVIDENCE_QUEUE_VERSION, SUPPLIER_EVIDENCE_WORKSPACE_VERSION,
  buildSupplierEvidenceWorkspaceModel, createSupplierEvidenceQueue, decideEvidenceFinding,
  intakeSupplierEvidenceFile, upsertSupplierEvidenceItem, validateSupplierEvidenceItem, validateSupplierEvidenceQueue
} from '../docs/supplier-evidence-core.mjs';

const html = await readFile(new URL('../docs/supplier-evidence.html', import.meta.url), 'utf8');
const ui = await readFile(new URL('../docs/supplier-evidence.mjs', import.meta.url), 'utf8');
const core = await readFile(new URL('../docs/supplier-evidence-core.mjs', import.meta.url), 'utf8');
const css = await readFile(new URL('../docs/supplier-evidence.css', import.meta.url), 'utf8');
const operations = await readFile(new URL('../docs/operations.html', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/supplier-evidence.schema.json', import.meta.url), 'utf8'));

assert.equal(SUPPLIER_EVIDENCE_ITEM_VERSION, 'tradeproof.supplier-evidence-item.v0.8');
assert.equal(SUPPLIER_EVIDENCE_QUEUE_VERSION, 'tradeproof.supplier-evidence-queue.v0.8');
assert.equal(SUPPLIER_EVIDENCE_WORKSPACE_VERSION, 'tradeproof.supplier-evidence-workspace.v0.8');
assert.equal(MAX_EVIDENCE_FILE_BYTES, 8388608);
assert.equal(MAX_TEXT_PARSE_BYTES, 2097152);
assert.equal(schema.title.includes('v0.8'), true);

function fileLike(name, type, content, lastModified = 1) {
  const bytes = new TextEncoder().encode(content);
  return { name, type, size: bytes.byteLength, lastModified, arrayBuffer: async () => bytes.buffer.slice(0) };
}
function binaryFileLike(name, type, bytes) {
  const data = Uint8Array.from(bytes);
  return { name, type, size: data.byteLength, lastModified: 2, arrayBuffer: async () => data.buffer.slice(0) };
}

const caseRecord = { caseId: 'trade-case:ted-search-api:519243-2026' };
const request = { requestId: 'supplier-request:519243-2026' };
const selectedCandidateIds = ['supplier-candidate:china-loong'];
const binding = {
  caseId: caseRecord.caseId,
  requestId: request.requestId,
  candidateId: selectedCandidateIds[0],
  selectedCandidateIds,
  questionId: 'base-certifications',
  sourceAttachment: {
    eventId: 'inbound-event:reply-001',
    attachmentIndex: 0,
    fileName: 'iso-certificate.txt',
    mediaType: 'text/plain'
  }
};
const certText = `Legal Entity: China Loong Medical Equipment Co., Ltd.\nCertificate No: CE-12345\nIssued By: Example Certification Body\nApplicable Products: Electric hospital beds model CL-01\nValid Until: 2027-12-31\n`;
const textItem = await intakeSupplierEvidenceFile(fileLike('iso-certificate.txt', 'text/plain', certText), binding, '2026-08-03T01:30:00.000Z');
assert.deepEqual(validateSupplierEvidenceItem(textItem), []);
assert.equal(textItem.documentContentParsed, true);
assert.equal(textItem.fileBytesHashedLocally, true);
assert.equal(textItem.fullContentStored, false);
assert.equal(textItem.originalFileStored, false);
assert.equal(textItem.extractedFindings.length, 5);
assert.equal(textItem.extractedFindings.every((finding) => finding.state === 'candidate_unconfirmed'), true);
assert.equal(textItem.extractedFindings.every((finding) => finding.evidenceVerified === false), true);
assert.equal(textItem.sourceAttachmentRef.fileNameMatch, true);
assert.equal(textItem.documentTypeCandidate, 'certificate_candidate');

const certFinding = textItem.extractedFindings.find((finding) => finding.field === 'certificate_number');
const reviewedTextItem = decideEvidenceFinding(textItem, certFinding.findingId, 'confirmed_in_local_file', '2026-08-03T01:31:00.000Z');
const reviewedFinding = reviewedTextItem.extractedFindings.find((finding) => finding.findingId === certFinding.findingId);
assert.equal(reviewedFinding.sourceConfirmed, true);
assert.equal(reviewedFinding.evidenceVerified, false);
assert.equal(reviewedFinding.externalVerificationPerformed, false);

let pdfTextCalls = 0;
const pdf = {
  ...binaryFileLike('certificate.pdf', 'application/pdf', [37, 80, 68, 70, 45, 49, 46, 55]),
  text: async () => { pdfTextCalls += 1; throw new Error('must not decode PDF'); }
};
const pdfItem = await intakeSupplierEvidenceFile(pdf, { ...binding, sourceAttachment: { ...binding.sourceAttachment, fileName: 'different-name.pdf' } }, '2026-08-03T01:32:00.000Z');
assert.equal(pdfTextCalls, 0);
assert.equal(pdfItem.fileBytesHashedLocally, true);
assert.equal(pdfItem.documentContentParsed, false);
assert.equal(pdfItem.extractedFindings.length, 0);
assert.equal(pdfItem.sourceAttachmentRef.fileNameMatch, false);
assert.equal(pdfItem.reviewTasks.some((task) => task.taskType === 'manual_document_review_required'), true);
assert.equal(pdfItem.reviewTasks.some((task) => task.taskType === 'review_attachment_name_mismatch'), true);

await assert.rejects(() => intakeSupplierEvidenceFile(fileLike('x.txt', 'text/plain', 'hello'), { ...binding, candidateId: 'supplier-candidate:unselected' }), /selected locally/);
const oversized = { name: 'huge.pdf', type: 'application/pdf', size: MAX_EVIDENCE_FILE_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) };
await assert.rejects(() => intakeSupplierEvidenceFile(oversized, binding), /size limit/);

let queue = createSupplierEvidenceQueue(caseRecord, request, selectedCandidateIds, '2026-08-03T01:29:00.000Z');
queue = upsertSupplierEvidenceItem(queue, reviewedTextItem, '2026-08-03T01:33:00.000Z');
queue = upsertSupplierEvidenceItem(queue, pdfItem, '2026-08-03T01:34:00.000Z');
queue = upsertSupplierEvidenceItem(queue, reviewedTextItem, '2026-08-03T01:35:00.000Z');
assert.equal(queue.items.length, 2, 'same evidenceId must upsert idempotently');
assert.deepEqual(validateSupplierEvidenceQueue(queue), []);

const timeline = { events: [{ eventId: 'inbound-event:reply-001', association: { candidateId: selectedCandidateIds[0] }, attachments: [{ fileName: 'iso-certificate.txt', mediaType: 'text/plain' }] }] };
const model = buildSupplierEvidenceWorkspaceModel({ caseRecord, request, review: { selectedCandidateIds }, queue, timeline });
assert.equal(model.counts.evidenceItems, 2);
assert.equal(model.counts.textParsedItems, 1);
assert.equal(model.counts.metadataOnlyItems, 1);
assert.equal(model.counts.verifiedEvidence, 0);
assert.equal(model.counts.externalVerificationChecks, 0);
assert.equal(model.boundaries.originalFileStored, false);
assert.equal(model.boundaries.fileUploaded, false);
assert.equal(model.boundaries.evidenceVerified, false);
assert.equal(model.boundaries.rankingGenerated, false);
assert.equal(model.boundaries.supplierEligibilityDecided, false);

for (const marker of ['data-supplier-evidence-root', 'supplier-evidence.mjs', '选择本地证据文件', '已验证证据 0']) assert.equal(html.includes(marker) || ui.includes(marker), true, `surface missing ${marker}`);
for (const marker of ['holder_selected_local_file_unverified', 'fileBytesHashedLocally', 'certificateValidityVerified: false', 'externalRegistryLookupPerformed: false']) assert.equal(core.includes(marker), true, `core missing ${marker}`);
assert.equal(operations.includes('./supplier-evidence.html'), true, 'Daily operations must link evidence queue.');
assert.equal(css.includes('@media(max-width:760px)'), true);
assert.equal(/fetch\(|XMLHttpRequest|WebSocket/.test(core), false, 'Evidence core must not perform network access.');
assert.equal(/score|rankSupplier|eligibilityDecision/i.test(core), false, 'Evidence core must not rank or decide eligibility.');

console.log('PASS: Supplier Evidence Intake & Verification Queue v0.8');
console.log(`Evidence items: ${model.counts.evidenceItems}`);
console.log(`Text parsed locally: ${model.counts.textParsedItems}`);
console.log(`Binary metadata-only: ${model.counts.metadataOnlyItems}`);
console.log(`Extracted candidates: ${reviewedTextItem.extractedFindings.length}`);
console.log('Verified evidence: 0');
console.log('External verification checks: 0');
console.log('Uploads / server writes: 0');
console.log('Ranking / eligibility decisions: 0');
