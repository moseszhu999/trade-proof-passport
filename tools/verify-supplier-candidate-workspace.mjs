#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildRequirementProfile,
  buildSupplierWorkspaceModel,
  createSupplierReview,
  evaluateSupplierCandidate,
  toggleSupplierCandidate,
  validateSupplierCollection,
  validateSupplierReview
} from '../docs/supplier-candidate-core.mjs';

const collection = JSON.parse(await readFile(new URL('../docs/data/supplier-candidates-hospital-furniture-v0.4.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../docs/suppliers.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../docs/suppliers.css', import.meta.url), 'utf8');
const ui = await readFile(new URL('../docs/suppliers.mjs', import.meta.url), 'utf8');
const core = await readFile(new URL('../docs/supplier-candidate-core.mjs', import.meta.url), 'utf8');
const operations = await readFile(new URL('../docs/operations.html', import.meta.url), 'utf8');

assert.deepEqual(validateSupplierCollection(collection), []);
assert.equal(collection.candidates.length, 5);
assert.equal(collection.targetOpportunityId, 'opportunity:ted:519243-2026');
assert.equal(collection.targetOpportunityRecordId, '519243-2026');
assert.equal(collection.sourcePolicy.verificationState, 'unverified');
assert.equal(collection.sourcePolicy.contactDisclosureIncluded, false);
assert.equal(collection.sourcePolicy.rankingGenerated, false);
assert.equal(collection.sourcePolicy.eligibilityDecisionGenerated, false);
assert.equal(collection.candidates.every((candidate) => candidate.state === 'observed_unclaimed'), true);
assert.equal(collection.candidates.every((candidate) => candidate.country === 'CHN'), true);
assert.equal(collection.candidates.every((candidate) => candidate.website.startsWith('https://')), true);
assert.equal(collection.candidates.flatMap((candidate) => candidate.publicClaims).every((claim) => claim.evidenceClassification === 'public_self_asserted' && claim.verified === false), true);
assert.equal(/@|mailto:|tel:|whatsapp|wechat|微信|phone|mobile/i.test(JSON.stringify(collection)), false, 'Candidate collection must not contain contact details.');

const noCaseModel = buildSupplierWorkspaceModel(null, collection);
assert.equal(noCaseModel.schemaVersion, 'tradeproof.supplier-candidate-workspace.v0.4');
assert.equal(noCaseModel.counts.observedCandidates, 5);
assert.equal(noCaseModel.counts.confirmedRequirements, 0);
assert.equal(noCaseModel.counts.verifiedSuppliers, 0);
assert.equal(noCaseModel.counts.eligibilityDecisions, 0);
assert.equal(noCaseModel.orderingPolicy, 'source_observation_order_no_ranking');
assert.equal(noCaseModel.candidates.every((candidate) => candidate.state === 'scope_candidate_only'), true);
assert.equal(noCaseModel.candidates.every((candidate) => candidate.boundaries.rank === null), true);
assert.equal(noCaseModel.candidates.every((candidate) => candidate.boundaries.numericScore === null), true);
assert.equal(noCaseModel.candidates.every((candidate) => candidate.boundaries.eligibleForTender === 'unknown'), true);
assert.deepEqual(noCaseModel.candidates.map((candidate) => candidate.candidateId), collection.candidates.map((candidate) => candidate.candidateId));

const caseRecord = {
  caseId: 'trade-case:ted-search-api:519243-2026',
  title: 'Poland – Furniture – hospital furniture with delivery and installation',
  sourceOpportunity: {
    opportunityId: 'opportunity:ted:519243-2026',
    recordId: '519243-2026',
    classificationCodes: ['39100000']
  },
  requirementCandidates: [
    {
      requirementId: 'req-technical',
      category: 'technical',
      label: '技术、规格与标准',
      excerpt: 'Furniture must satisfy the technical specification and material requirements.',
      status: 'confirmed_in_supplied_source',
      officialRequirement: true,
      evidenceClassification: 'holder_supplied_source_text'
    },
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
      requirementId: 'req-eligibility',
      category: 'eligibility',
      label: '参与资格与主体要求',
      excerpt: 'Tender eligibility and subcontracting declarations are required.',
      status: 'confirmed_in_supplied_source',
      officialRequirement: true,
      evidenceClassification: 'holder_supplied_source_text'
    },
    {
      requirementId: 'req-draft',
      category: 'commercial',
      label: '未确认商务要求',
      excerpt: 'Draft price terms.',
      status: 'candidate_unconfirmed',
      officialRequirement: false,
      evidenceClassification: 'holder_supplied_source_text'
    }
  ]
};

const profile = buildRequirementProfile(caseRecord, collection);
assert.equal(profile.hasConfirmedRequirements, true);
assert.equal(profile.confirmedRequirements.length, 4);
assert.equal(profile.confirmedRequirements.some((item) => item.requirementId === 'req-draft'), false);
assert.equal(profile.boundaries.rankingGenerated, false);
assert.equal(profile.boundaries.supplierEligibilityDecided, false);

const model = buildSupplierWorkspaceModel(caseRecord, collection);
assert.equal(model.counts.confirmedRequirements, 4);
assert.equal(model.candidates.every((candidate) => ['potential_candidate_with_gaps', 'public_claim_overlap_requires_verification'].includes(candidate.state)), true);
assert.equal(model.candidates.every((candidate) => candidate.requirementAssessments.length === 4), true);
assert.equal(model.candidates.every((candidate) => candidate.requirementAssessments.some((item) => item.category === 'eligibility' && item.state === 'evidence_gap')), true);
assert.equal(model.candidates.some((candidate) => candidate.requirementAssessments.some((item) => item.category === 'delivery' && item.state === 'public_claim_only')), true);
assert.equal(model.candidates.some((candidate) => candidate.requirementAssessments.some((item) => item.category === 'evidence' && item.state === 'public_claim_only')), true);
assert.equal(model.candidates.every((candidate) => candidate.boundaries.verifiedSupplier === false), true);
assert.equal(model.candidates.every((candidate) => candidate.boundaries.contactDisclosed === false), true);
assert.equal(model.candidates.every((candidate) => candidate.boundaries.formalWritePerformed === false), true);

const evaluated = evaluateSupplierCandidate(collection.candidates[0], profile);
assert.equal(evaluated.scope.state, 'public_scope_overlap');
assert.equal(evaluated.scope.verified, false);
assert.equal(evaluated.nextReviewQuestions.length > 0, true);
assert.equal(evaluated.publicClaims.every((claim) => claim.verified === false), true);

let review = createSupplierReview(caseRecord, collection);
assert.deepEqual(validateSupplierReview(review, collection), []);
review = toggleSupplierCandidate(review, collection.candidates[0].candidateId);
assert.equal(review.selectedCandidateIds.length, 1);
assert.equal(review.formalWritePerformed, false);
assert.equal(review.externalContactPerformed, false);
assert.equal(review.supplierEligibilityDecided, false);
assert.deepEqual(validateSupplierReview(review, collection), []);
review = toggleSupplierCandidate(review, collection.candidates[0].candidateId);
assert.equal(review.selectedCandidateIds.length, 0);

for (const marker of ['data-supplier-workspace-root', 'export-review', 'suppliers.mjs']) {
  assert.equal(html.includes(marker), true, `Supplier page must contain ${marker}`);
}
for (const marker of ['buildSupplierWorkspaceModel', 'toggleSupplierCandidate', 'source_observation_order_no_ranking']) {
  assert.equal(core.includes(marker), true, `Supplier core must contain ${marker}`);
}
for (const marker of ['public_self_asserted', 'verifiedSupplier=false', 'eligibleForTender=unknown', '本地候选名单']) {
  assert.equal(ui.includes(marker), true, `Supplier UI must contain ${marker}`);
}
assert.equal(operations.includes('./suppliers.html'), true, 'Daily operations must link the supplier workspace.');
assert.equal(css.includes('@media(max-width:720px)'), true);
assert.equal(/fetch\(|XMLHttpRequest|WebSocket/.test(core), false, 'Supplier comparison core must not perform network access.');
assert.equal(/numericScore\s*:\s*(?:[0-9]|['"])/.test(core), false, 'Supplier core must not assign a numeric or string score.');
assert.equal(/\brank\s*:\s*(?:[0-9]|['"])/.test(core), false, 'Supplier core must not assign a numeric or string rank.');

console.log('PASS: Supplier Candidate Workspace v0.4');
console.log(`Observed public candidates: ${model.counts.observedCandidates}`);
console.log(`Confirmed requirements compared: ${model.counts.confirmedRequirements}`);
console.log(`Scope-overlap candidates: ${model.counts.scopeOverlap}`);
console.log('Public self-assertion / verified evidence separation: PASS');
console.log('No contact disclosure: PASS');
console.log('No ranking or numeric score: PASS');
console.log('No supplier eligibility decision: PASS');
console.log('Holder-local candidate review boundary: PASS');
