import assert from 'node:assert/strict';
import {
  DECISION_CONFIRMATION_TEXT,
  buildSupplierDecisionModel,
  createSupplierDecisionRecord,
  createSupplierDecisionWorkspace,
  upsertSupplierDecision,
  validateSupplierDecisionRecord,
  validateSupplierDecisionWorkspace
} from '../docs/supplier-decision-core.mjs';

const caseRecord = {
  caseId: 'case-001',
  requirementCandidates: [
    { requirementId: 'req-install', category: 'delivery', label: '目的地安装', excerpt: 'Installation required', status: 'confirmed_in_supplied_source', officialRequirement: true },
    { requirementId: 'req-cert', category: 'evidence', label: '有效认证', excerpt: 'Valid certification required', status: 'confirmed_in_supplied_source', officialRequirement: true },
    { requirementId: 'req-lead', category: 'delivery', label: '交付周期', excerpt: 'Delivery in 60 days', status: 'confirmed_in_supplied_source', officialRequirement: true }
  ]
};
const review = { selectedCandidateIds: ['supplier-a','supplier-b'] };
const request = {
  questions: [
    { questionId: 'q-install', sourceRequirementId: 'req-install', required: true },
    { questionId: 'q-cert', sourceRequirementId: 'req-cert', required: true },
    { questionId: 'q-lead', sourceRequirementId: 'req-lead', required: true },
    { questionId: 'q-base', required: true }
  ]
};
const answer = (questionId, value) => ({ questionId, value, supplierStatementClassification: 'supplier_submitted_unverified' });
const responses = [
  { candidateId: 'supplier-a', answers: [answer('q-install','We can install.'),answer('q-cert','ISO attached.'),answer('q-lead','60 days.'),answer('q-base','Factory details.')] },
  { candidateId: 'supplier-b', answers: [answer('q-install','No installation.'),answer('q-cert','Certificate provided.'),answer('q-lead',''),answer('q-base','Factory details.')] }
];
const finding = (value) => [{ field: 'valid_until', value, state: 'confirmed_in_local_file', sourceConfirmed: true }];
const evidenceQueue = { items: [
  { evidenceId: 'ev-a-install', candidateId: 'supplier-a', questionId: 'q-install', documentContentParsed: true, extractedFindings: finding('2028-12-31') },
  { evidenceId: 'ev-a-cert', candidateId: 'supplier-a', questionId: 'q-cert', documentContentParsed: true, extractedFindings: finding('2025-01-01') },
  { evidenceId: 'ev-b-install', candidateId: 'supplier-b', questionId: 'q-install', documentContentParsed: false, extractedFindings: [] },
  { evidenceId: 'ev-b-cert', candidateId: 'supplier-b', questionId: 'q-cert', documentContentParsed: true, extractedFindings: finding('2028-01-01') }
] };
const verificationWorkspace = { reviews: [
  { reviewId: 'vr-a-install', evidenceId: 'ev-a-install', assessment: 'supported', humanReviewConfirmed: true, state: 'holder_reviewed_receipt_unverified' },
  { reviewId: 'vr-b-install', evidenceId: 'ev-b-install', assessment: 'contradicted', humanReviewConfirmed: true, state: 'holder_reviewed_receipt_unverified' },
  { reviewId: 'vr-b-cert', evidenceId: 'ev-b-cert', assessment: 'inconclusive', humanReviewConfirmed: false, state: 'receipt_pending_holder_review' }
] };
const timeline = { events: [
  { eventId: 'mail-a', sentAt: '2026-07-31T00:00:00Z', association: { candidateId: 'supplier-a' }, actionCandidates: [] },
  { eventId: 'mail-b', sentAt: '2026-08-01T00:00:00Z', association: { candidateId: 'supplier-b' }, actionCandidates: [{ state: 'candidate_unconfirmed' }] }
] };
const collection = { candidates: [{ candidateId: 'supplier-a', displayName: 'Supplier A' }, { candidateId: 'supplier-b', displayName: 'Supplier B' }] };
let workspace = createSupplierDecisionWorkspace(caseRecord, review.selectedCandidateIds, '2026-08-03T00:00:00Z');
const model = buildSupplierDecisionModel({ caseRecord, supplierReview: review, request, responses, evidenceQueue, verificationWorkspace, timeline, supplierCollection: collection, decisionWorkspace: workspace, asOf: new Date('2026-08-03T00:00:00Z') });

assert.deepEqual(model.candidates.map((item) => item.candidateId), ['supplier-a','supplier-b']);
assert.equal(model.orderingPolicy, 'holder_selection_order_no_ranking');
assert.ok(model.candidates.every((item) => item.numericScore === null && item.rank === null));
assert.equal(model.counts.eligibilityDecisions, 0);
assert.equal(model.counts.formalShortlists, 0);

const a = model.candidates[0];
assert.deepEqual(a.requirementRows.map((row) => row.state), ['supported_candidate','stale','unverified_response_only']);
assert.equal(a.ruleSuggestion.decision, 'deeper_verification_required');
const b = model.candidates[1];
assert.deepEqual(b.requirementRows.map((row) => row.state), ['contradicted_candidate','unverified_evidence_available','missing']);
assert.equal(b.ruleSuggestion.decision, 'deeper_verification_required');
assert.notEqual(b.ruleSuggestion.decision, 'exclude_from_current_case');
assert.ok(b.actionCandidates.some((item) => item.actionType === 'investigate_contradiction'));
assert.ok(b.actionCandidates.some((item) => item.actionType === 'review_external_receipts'));
assert.ok(b.actionCandidates.every((item) => item.externalActionPerformed === false));

assert.throws(() => createSupplierDecisionRecord(a, 'continue_contact', 'Proceed', 'CONFIRM'), /exact supplier decision confirmation/);
const record = createSupplierDecisionRecord(a, 'continue_contact', '继续沟通，同时更新过期认证。', DECISION_CONFIRMATION_TEXT, '2026-08-03T01:00:00Z');
assert.deepEqual(validateSupplierDecisionRecord(record), []);
assert.equal(record.state, 'holder_local_candidate_decision');
assert.equal(record.decisionClassification, 'human_case_progression_candidate');
assert.equal(record.boundaries.supplierEligibilityDecided, false);
assert.equal(record.boundaries.numericScore, null);
workspace = upsertSupplierDecision(workspace, record, '2026-08-03T01:00:00Z');
assert.deepEqual(validateSupplierDecisionWorkspace(workspace), []);

const excluded = createSupplierDecisionRecord(b, 'exclude_from_current_case', '仅从当前案件排除，不形成平台资格结论。', DECISION_CONFIRMATION_TEXT);
assert.equal(excluded.boundaries.formalShortlistCreated, false);
assert.equal(excluded.boundaries.awardDecisionCreated, false);

console.log(JSON.stringify({
  candidates: model.counts.candidates,
  requirementStatesA: a.requirementRows.map((row) => row.state),
  requirementStatesB: b.requirementRows.map((row) => row.state),
  actionsB: b.actionCandidates.length,
  decisionsRecorded: workspace.decisions.length,
  numericScores: model.candidates.map((item) => item.numericScore),
  eligibilityDecisions: model.counts.eligibilityDecisions
}, null, 2));
