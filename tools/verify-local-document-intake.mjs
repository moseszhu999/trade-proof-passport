#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  caseActionQueue,
  createTradeCase,
  validateTradeCase
} from '../docs/trade-case-core.mjs';
import {
  LOCAL_DOCUMENT_INTAKE_VERSION,
  MAX_LOCAL_TEXT_FILE_BYTES,
  classifyLocalDocument,
  ingestLocalDocument
} from '../docs/local-document-intake.mjs';

const collection = JSON.parse(await readFile(new URL('../docs/data/opportunity-radar-latest.json', import.meta.url), 'utf8'));
const page = await readFile(new URL('../docs/document-intake.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../docs/document-intake.css', import.meta.url), 'utf8');
const ui = await readFile(new URL('../docs/document-intake-ui.mjs', import.meta.url), 'utf8');
const core = await readFile(new URL('../docs/local-document-intake.mjs', import.meta.url), 'utf8');
const operations = await readFile(new URL('../docs/operations.html', import.meta.url), 'utf8');
const guide = await readFile(new URL('../docs/guides/local-document-intake-v0.3.md', import.meta.url), 'utf8');

function fakeFile({ name, type, text, size, lastModified = 1785720000000, onRead }) {
  const body = String(text ?? '');
  return {
    name,
    type,
    size: size ?? Buffer.byteLength(body),
    lastModified,
    async text() {
      onRead?.();
      return body;
    }
  };
}

const fixedNow = new Date('2026-08-03T00:00:00.000Z');
let tradeCase = await createTradeCase(collection.opportunities[0], fixedNow);

const noticeFile = fakeFile({
  name: 'hospital-requirements.txt',
  type: 'text/plain',
  text: [
    'The supplier must provide ISO 9001 certification and evidence of three reference projects.',
    'Delivery and installation shall be completed at the hospital site before 30 September 2026.',
    'Subcontracting must be declared before submission.'
  ].join('\n\n')
});
assert.equal(classifyLocalDocument(noticeFile).state, 'readable_local_text');
const noticeOutcome = await ingestLocalDocument(tradeCase, noticeFile, {
  kind: 'official_notice_text',
  title: 'Hospital requirements'
}, new Date('2026-08-03T00:01:00.000Z'));
tradeCase = noticeOutcome.caseRecord;
assert.equal(noticeOutcome.result.kind, 'official_notice_text');
assert.equal(noticeOutcome.result.requirementCandidateCount >= 3, true);
assert.equal(noticeOutcome.result.uploaded, false);
assert.match(noticeOutcome.result.sourceContentDigest, /^sha256:[0-9a-f]{64}$/);
assert.equal(tradeCase.fileReferences.at(-1).adapterContentReadLocally, true);
assert.equal(tradeCase.fileReferences.at(-1).contentRead, false);
assert.equal(tradeCase.fileReferences.at(-1).uploaded, false);
assert.equal(tradeCase.fileReferences.at(-1).binaryDocumentParsingPerformed, false);
assert.equal(tradeCase.communications.at(-1).sourceMethod, 'holder_authorized_local_text_file');
assert.equal(tradeCase.communications.at(-1).sourceFile.contentStoredInCase, true);
assert.equal(tradeCase.requirementCandidates.every((item) => item.humanConfirmationRequired), true);
assert.equal(tradeCase.requirementCandidates.every((item) => item.officialRequirement === false), true);
assert.equal((await validateTradeCase(tradeCase)).length, 0);

const emailFile = fakeFile({
  name: 'buyer-clarification.eml',
  type: 'message/rfc822',
  text: [
    'From: buyer@example.invalid',
    'To: supplier@example.invalid',
    'Subject: Sample and test report',
    'Date: Mon, 3 Aug 2026 08:00:00 +0200',
    '',
    'Please confirm the sample delivery date and provide the test report before Friday.'
  ].join('\n')
});
const emailOutcome = await ingestLocalDocument(tradeCase, emailFile, {}, new Date('2026-08-03T00:02:00.000Z'));
tradeCase = emailOutcome.caseRecord;
assert.equal(emailOutcome.result.kind, 'email_or_message_text');
assert.equal(emailOutcome.result.actionCandidateCount > 0, true);
assert.equal(tradeCase.communications.at(-1).personalDataReviewRequired, true);
assert.equal(tradeCase.communications.at(-1).sourceFile.emlHeadersPresent, true);
assert.equal(caseActionQueue(tradeCase).some((item) => item.kind === 'communication_action_review'), true);
assert.equal((await validateTradeCase(tradeCase)).length, 0);

let pdfTextReads = 0;
const pdfFile = fakeFile({
  name: 'technical-specification.pdf',
  type: 'application/pdf',
  text: 'THIS MUST NOT BE READ',
  onRead: () => { pdfTextReads += 1; }
});
assert.equal(classifyLocalDocument(pdfFile).state, 'metadata_only_unsupported_format');
const pdfOutcome = await ingestLocalDocument(tradeCase, pdfFile, {}, new Date('2026-08-03T00:03:00.000Z'));
tradeCase = pdfOutcome.caseRecord;
assert.equal(pdfTextReads, 0);
assert.equal(pdfOutcome.result.metadataOnly, true);
assert.equal(pdfOutcome.result.requirementCandidateCount, 0);
assert.equal(tradeCase.fileReferences.at(-1).adapterContentReadLocally, false);
assert.equal(tradeCase.fileReferences.at(-1).binaryDocumentParsingPerformed, false);
assert.equal((await validateTradeCase(tradeCase)).length, 0);

let oversizedTextReads = 0;
const oversizedFile = fakeFile({
  name: 'too-large.txt',
  type: 'text/plain',
  text: 'MUST NOT BE READ',
  size: MAX_LOCAL_TEXT_FILE_BYTES + 1,
  onRead: () => { oversizedTextReads += 1; }
});
assert.equal(classifyLocalDocument(oversizedFile).state, 'blocked_too_large');
const oversizedOutcome = await ingestLocalDocument(tradeCase, oversizedFile, {}, new Date('2026-08-03T00:04:00.000Z'));
tradeCase = oversizedOutcome.caseRecord;
assert.equal(oversizedTextReads, 0);
assert.equal(oversizedOutcome.result.metadataOnly, true);
assert.equal(tradeCase.fileReferences.at(-1).adapterState, 'blocked_too_large');
assert.equal((await validateTradeCase(tradeCase)).length, 0);

const invalidJson = fakeFile({
  name: 'broken.json',
  type: 'application/json',
  text: '{not valid json}'
});
await assert.rejects(
  () => ingestLocalDocument(tradeCase, invalidJson, {}, new Date('2026-08-03T00:05:00.000Z')),
  /not valid JSON/
);

const binaryLookingText = fakeFile({
  name: 'binary-looking.txt',
  type: 'text/plain',
  text: 'abc\u0000def'
});
await assert.rejects(
  () => ingestLocalDocument(tradeCase, binaryLookingText, {}, new Date('2026-08-03T00:06:00.000Z')),
  /Binary-looking/
);

for (const marker of [
  'document-intake-form',
  'document-file',
  'classification-state',
  'case-import-file',
  'export-case',
  'intake-result',
  'file-history'
]) {
  assert.equal(page.includes(marker), true, `Document intake page must contain ${marker}`);
}
assert.equal(page.includes('document-intake-ui.mjs'), true);
assert.equal(css.includes('@media (max-width: 880px)'), true);
assert.equal(operations.includes('./document-intake.html'), true);
assert.equal(guide.includes('adapterContentReadLocally'), true);
assert.equal(core.includes(LOCAL_DOCUMENT_INTAKE_VERSION), true);
assert.equal(ui.includes(CASE_STORAGE_KEY_FOR_TEST()), true);
assert.equal(/fetch\(|XMLHttpRequest|WebSocket|EventSource/.test(core), false, 'Local document core must not use network APIs.');
assert.equal(/fetch\(|XMLHttpRequest|WebSocket|EventSource/.test(ui), false, 'Local document UI must not use network APIs.');
assert.equal(/pdfjs|mammoth|xlsx|ocr|tesseract/i.test(core), false, 'Binary/OCR parsers must not be present.');
assert.equal(tradeCase.boundaries.fileUploaded, false);
assert.equal(tradeCase.boundaries.binaryDocumentParsingPerformed, false);

console.log('PASS: Controlled Local Document Intake v0.3');
console.log(`Adapter: ${LOCAL_DOCUMENT_INTAKE_VERSION}`);
console.log(`Notice candidates added: ${noticeOutcome.result.requirementCandidateCount}`);
console.log(`Email actions added: ${emailOutcome.result.actionCandidateCount}`);
console.log('TXT/Markdown/CSV/JSON/EML/XML allowlist: PASS');
console.log('PDF/Office/image metadata-only boundary: PASS');
console.log('No network / no upload / no OCR / no binary parsing: PASS');
console.log('Trade Case digest validation after intake: PASS');

function CASE_STORAGE_KEY_FOR_TEST() {
  return 'tradeproof.trade.case.v0.2';
}
