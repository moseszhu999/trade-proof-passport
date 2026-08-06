import assert from 'node:assert/strict';

import {
  createRelationshipFeedbackHandoff,
  relationshipFeedbackPublicProjection
} from '../docs/relationship-feedback-handoff.mjs';

const input = {
  sourceCaseId: 'case-001',
  sourceCaseDigest: `sha256:${'a'.repeat(64)}`,
  sourceEvidenceDigest: `sha256:${'b'.repeat(64)}`,
  subject: {
    kind: 'supplier',
    publicObjectId: 'mp_supplier_001',
    publicObjectDigest: `sha256:${'c'.repeat(64)}`
  },
  relationshipType: 'inspection_verified',
  statement: 'Reviewed inspection evidence may support a relationship update.',
  provenanceRefIds: ['tradeos:evidence:inspection:001', 'tradeos:review:001'],
  uncertainty: [],
  reviewStatus: 'verified_for_internal_use',
  reviewedAt: '2026-08-06T00:00:00.000Z',
  publicDisclosureAllowed: true,
  confirmationText: 'PREPARE TRADEPROOF RELATIONSHIP CANDIDATE',
  preparedAt: '2026-08-06T00:10:00.000Z'
};

const first = await createRelationshipFeedbackHandoff(input);
const second = await createRelationshipFeedbackHandoff(input);
assert.deepEqual(first, second);
assert.match(first.handoffDigest, /^sha256:[0-9a-f]{64}$/);
assert.match(first.candidate.candidateDigest, /^sha256:[0-9a-f]{64}$/);
assert.equal(first.status, 'handoff_prepared_not_imported');
assert.deepEqual(first.boundaries, {
  holderReviewRequired: true,
  importPerformed: false,
  publicationApproved: false,
  publicWritePerformed: false,
  registryWritePerformed: false,
  chainSubmissionPerformed: false,
  externalActionPerformed: false
});
assert.equal(first.candidate.boundaries.identityVerified, false);
assert.equal(first.candidate.boundaries.relationshipVerifiedForPublicUse, false);
assert.equal(first.candidate.boundaries.rankingPerformed, false);
assert.equal(first.candidate.boundaries.scoreCreated, false);
assert.equal(first.candidate.boundaries.registryWritePerformed, false);
assert.equal(first.candidate.boundaries.chainSubmissionPerformed, false);

const projection = relationshipFeedbackPublicProjection(first);
const serialized = JSON.stringify(projection);
assert.equal(projection.privacy.sourceCaseIdIncluded, false);
assert.equal(projection.privacy.organizationIdIncluded, false);
assert.equal(projection.privacy.sourceEvidenceDigestIncluded, false);
assert.ok(!serialized.includes(input.sourceCaseId));
assert.ok(!serialized.includes(input.sourceEvidenceDigest));

await assert.rejects(
  () => createRelationshipFeedbackHandoff({ ...input, publicDisclosureAllowed: false }),
  /public_disclosure_not_allowed/
);
await assert.rejects(
  () => createRelationshipFeedbackHandoff({ ...input, provenanceRefIds: [] }),
  /provenance_required/
);
await assert.rejects(
  () => createRelationshipFeedbackHandoff({ ...input, confirmationText: 'publish' }),
  /exact_handoff_confirmation_required/
);
await assert.rejects(
  () => createRelationshipFeedbackHandoff({
    ...input,
    reviewStatus: 'reviewed_with_gaps',
    uncertainty: []
  }),
  /uncertainty_required_for_reviewed_gaps/
);

const withGaps = await createRelationshipFeedbackHandoff({
  ...input,
  reviewStatus: 'reviewed_with_gaps',
  uncertainty: ['Inspection covered one facility only.']
});
assert.deepEqual(withGaps.candidate.uncertainty, ['Inspection covered one facility only.']);

console.log('PASS: deterministic TradeOS relationship feedback handoff, privacy projection and no-write boundaries');
