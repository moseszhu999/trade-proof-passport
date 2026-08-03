#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSupplierResponseRequest,
  buildSupplierResponseWorkspace,
  createSupplierResponseTemplate,
  evaluateSupplierResponse,
  importSupplierResponse,
  validateSupplierResponse,
  validateSupplierResponseRequest
} from '../docs/supplier-response-core.mjs';

const collection = JSON.parse(await readFile(new URL('../docs/data/supplier-candidates-hospital-furniture-v0.4.json', import.meta.url), 'utf8'));
const schema = JSON.parse(await readFile(new URL('../schema/supplier-response.schema.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../docs/supplier-responses.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../docs/supplier-responses.css', import.meta.url), 'utf8');
const ui = await readFile(new URL('../docs/supplier-responses.mjs', import.meta.url), 'utf8');
const core = await readFile(new URL('../docs/supplier-response-core.mjs', import.meta.url), 'utf8');
const operations = await readFile(new URL('../docs/operations.html', import.meta.url), 'utf8');

const caseRecord = {
  caseId: 'trade-case:ted-search-api:519243-2026',
  title: 'Poland hospital furniture with delivery and installation',
  sourceOpportunity: {
    opportunityId: 'opportunity:ted:519243-2026',
    recordId: '519243-2026',
    classificationCodes: ['39100000']
  },
  requirementCandidates: [
    {
      requirementId: 'req-delivery',
      category: 'delivery',
      label: '交付、安装与履约地点',
      excerpt: 'Delivery, installation and placement are required at the hospital.',
      status: 'confirmed_in_supplied_source',
      officialRequirement: true,
      evidenceClassification: 'holder_supplied_source_text'
    },
    {
      requirementId: 'req-evidence',
      category: 'evidence',
      label: '证书、证明与历史业绩',
      excerpt: 'Certificates and reference evidence are required.',
      status: 'confirmed_in_supplied_source',
      officialRequirement: true,
      evidenceClassification: 'holder_supplied_source_text'
    },
    {
      requirementId: 'req-commercial-draft',
      category: 'commercial',
      label: '未确认商务条款',
      excerpt: 'Draft payment terms.',
      status: 'candidate_unconfirmed',
      officialRequirement: false,
      evidenceClassification: 'holder_supplied_source_text'
    }
  ]
};

const selectedIds = collection.candidates.slice(0, 2).map((item) => item.candidateId);
const review = {
  schemaVersion: 'tradeproof.supplier-review.v0.4',
  caseId: caseRecord.caseId,
  targetOpportunityId: collection.targetOpportunityId,
  selectedCandidateIds: selectedIds,
  notes: {},
  state: 'holder_local_draft',
  formalWritePerformed: false,
  externalContactPerformed: false,
  supplierEligibilityDecided: false
};

const fixedNow = new Date('2026-08-03T00:00:00.000Z');
const request = buildSupplierResponseRequest(caseRecord, review, collection, fixedNow);
assert.equal(request.schemaVersion, 'tradeproof.supplier-response-request.v0.5');
assert.equal(request.state, 'holder_local_draft');
assert.deepEqual(request.selectedCandidateIds, selectedIds);
assert.deepEqual(request.confirmedRequirementIds, ['req-delivery', 'req-evidence']);
assert.equal(request.questions.length, 10);
assert.equal(request.questions.some((item) => item.sourceRequirementId === 'req-commercial-draft'), false);
assert.equal(request.externalSendPerformed, false);
assert.equal(request.contactDisclosurePerformed, false);
assert.equal(request.formalShortlistCreated, false);
assert.equal(request.supplierEligibilityDecided, false);
assert.equal(request.rankingGenerated, false);
assert.deepEqual(validateSupplierResponseRequest(request, review, collection), []);

const unselectedId = collection.candidates[2].candidateId;
assert.throws(() => createSupplierResponseTemplate(request, unselectedId, collection), /not selected/i);

const firstTemplate = createSupplierResponseTemplate(request, selectedIds[0], collection, fixedNow);
assert.equal(firstTemplate.schemaVersion, 'tradeproof.supplier-response.v0.5');
assert.equal(firstTemplate.answers.length, request.questions.length);
assert.equal(firstTemplate.answers.every((item) => item.supplierStatementClassification === 'supplier_submitted_unverified'), true);
assert.equal(firstTemplate.supplierIdentityVerified, false);
assert.equal(firstTemplate.evidenceVerified, false);
assert.equal(firstTemplate.formalSubmissionPerformed, false);
assert.equal(firstTemplate.eligibilityDecisionCreated, false);
assert.deepEqual(validateSupplierResponse(firstTemplate, request, collection), []);

const deliveryQuestion = request.questions.find((item) => item.category === 'delivery');
const evidenceQuestion = request.questions.find((item) => item.category === 'evidence');
const productQuestion = request.questions.find((item) => item.questionId === 'base-product-catalogue');

const firstReturned = structuredClone(firstTemplate);
firstReturned.answers.find((item) => item.questionId === productQuestion.questionId).value = 'We manufacture hospital beds and bedside cabinets.';
firstReturned.answers.find((item) => item.questionId === deliveryQuestion.questionId).value = 'We cannot provide installation at the destination.';
firstReturned.answers.find((item) => item.questionId === evidenceQuestion.questionId).value = 'ISO and CE materials are available.';
firstReturned.answers.find((item) => item.questionId === evidenceQuestion.questionId).evidenceRefs = [{
  fileName: 'certificates.pdf',
  mediaType: 'application/pdf',
  digest: 'sha256:test-certificates',
  contentUploaded: false,
  evidenceVerified: false
}];
firstReturned.declarations.informationAccurateToSupplierKnowledge = true;
firstReturned.declarations.authorityToRespond = true;

const importedFirst = importSupplierResponse(firstReturned, request, collection, fixedNow);
assert.equal(importedFirst.state, 'holder_imported_unverified');
assert.equal(importedFirst.importedByHolder, true);
assert.equal(importedFirst.supplierIdentityVerified, false);
assert.equal(importedFirst.evidenceVerified, false);
assert.equal(importedFirst.answers.find((item) => item.questionId === evidenceQuestion.questionId).evidenceRefs[0].contentUploaded, false);

const firstEvaluation = evaluateSupplierResponse(collection.candidates[0], request, importedFirst);
assert.equal(firstEvaluation.state, 'partial_response_unverified');
assert.equal(firstEvaluation.counts.answered, 3);
assert.equal(firstEvaluation.counts.missing, 7);
assert.equal(firstEvaluation.counts.evidenceMetadataRefs, 1);
assert.equal(firstEvaluation.questionAssessments.some((item) => item.state === 'claim_response_conflict'), true);
assert.equal(firstEvaluation.boundaries.numericScore, null);
assert.equal(firstEvaluation.boundaries.rank, null);
assert.equal(firstEvaluation.boundaries.supplierEligibilityDecided, false);

const secondTemplate = createSupplierResponseTemplate(request, selectedIds[1], collection, fixedNow);
for (const answer of secondTemplate.answers) {
  answer.value = `Response for ${answer.questionId}`;
}
const importedSecond = importSupplierResponse(secondTemplate, request, collection, fixedNow);
const secondEvaluation = evaluateSupplierResponse(collection.candidates[1], request, importedSecond);
assert.equal(secondEvaluation.state, 'response_received_unverified');
assert.equal(secondEvaluation.counts.answered, 10);
assert.equal(secondEvaluation.counts.missing, 0);
assert.equal(secondEvaluation.boundaries.evidenceVerified, false);

const workspace = buildSupplierResponseWorkspace(request, [importedFirst, importedSecond], collection);
assert.equal(workspace.schemaVersion, 'tradeproof.supplier-response-workspace.v0.5');
assert.equal(workspace.counts.selectedCandidates, 2);
assert.equal(workspace.counts.responsesImported, 2);
assert.equal(workspace.counts.candidatesWithMissingAnswers, 1);
assert.equal(workspace.counts.candidatesWithConflicts >= 1, true);
assert.equal(workspace.counts.verifiedSupplierIdentities, 0);
assert.equal(workspace.counts.verifiedEvidenceItems, 0);
assert.equal(workspace.counts.eligibilityDecisions, 0);
assert.equal(workspace.orderingPolicy, 'holder_selection_order_no_ranking');
assert.deepEqual(workspace.candidates.map((item) => item.candidateId), selectedIds);
assert.equal(workspace.candidates.every((item) => item.boundaries.numericScore === null && item.boundaries.rank === null), true);
assert.equal(workspace.rankingGenerated, false);
assert.equal(workspace.formalWritePerformed, false);

const invalidUpload = structuredClone(firstReturned);
invalidUpload.answers[0].evidenceRefs = [{ fileName: 'secret.pdf', contentUploaded: true, evidenceVerified: false }];
assert.equal(validateSupplierResponse(invalidUpload, request, collection).some((item) => item.includes('content upload')), true);

assert.equal(schema.properties.schemaVersion.const, 'tradeproof.supplier-response.v0.5');
assert.equal(schema.properties.supplierIdentityVerified.const, false);
assert.equal(schema.properties.evidenceVerified.const, false);
assert.equal(schema.properties.formalSubmissionPerformed.const, false);
assert.equal(schema.properties.eligibilityDecisionCreated.const, false);

for (const marker of ['data-supplier-response-root', 'response-file', 'export-request', 'supplier_submitted_unverified', 'rankingGenerated=false']) {
  assert.equal(html.includes(marker), true, `Supplier response page must contain ${marker}`);
}
for (const marker of ['buildSupplierResponseRequest', 'createSupplierResponseTemplate', 'importSupplierResponse', 'buildSupplierResponseWorkspace']) {
  assert.equal(core.includes(marker), true, `Supplier response core must contain ${marker}`);
}
for (const marker of ['导出该供应商回复模板', 'missing_response', 'claim_response_conflict', 'numericScore=null', 'rank=null']) {
  assert.equal(ui.includes(marker), true, `Supplier response UI must contain ${marker}`);
}
assert.equal(operations.includes('./supplier-responses.html'), true, 'Daily operations must link supplier response workspace.');
assert.equal(css.includes('@media(max-width:720px)'), true);
assert.equal(/fetch\(|XMLHttpRequest|WebSocket/.test(core), false, 'Supplier response core must not perform network access.');

console.log('PASS: Supplier Response Workspace v0.5');
console.log(`Selected candidates: ${workspace.counts.selectedCandidates}`);
console.log(`Questions per supplier: ${request.questions.length}`);
console.log(`Imported responses: ${workspace.counts.responsesImported}`);
console.log(`Candidates with missing answers: ${workspace.counts.candidatesWithMissingAnswers}`);
console.log(`Candidates with conflicts: ${workspace.counts.candidatesWithConflicts}`);
console.log('Supplier identity remains unverified: PASS');
console.log('Evidence remains unverified metadata only: PASS');
console.log('No external send / no formal shortlist / no eligibility decision: PASS');
console.log('No ranking or numeric score: PASS');
