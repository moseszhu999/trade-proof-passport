import { canonicalJson, sha256Text } from './trade-case-core.mjs';

export const RELATIONSHIP_FEEDBACK_HANDOFF_VERSION = 'tradeproof.relationship-feedback-handoff.v0.1';
export const RELATIONSHIP_CANDIDATE_VERSION = 'tradeproof.relationship-candidate.v0.1';

const SHA256 = /^sha256:[0-9a-f]{64}$/;

function clean(value) {
  return String(value ?? '').trim();
}

function unique(values) {
  return [...new Set((values ?? []).map(clean).filter(Boolean))].sort();
}

function unsignedEnvelope(envelope) {
  const { handoffDigest, ...unsigned } = envelope;
  return unsigned;
}

function validate(input) {
  const errors = [];
  if (!clean(input?.sourceCaseId)) errors.push('source_case_id_required');
  if (!SHA256.test(clean(input?.sourceCaseDigest))) errors.push('source_case_digest_required');
  if (!SHA256.test(clean(input?.sourceEvidenceDigest))) errors.push('source_evidence_digest_required');
  if (!['buyer', 'supplier', 'opportunity'].includes(input?.subject?.kind)) errors.push('subject_kind_invalid');
  if (!clean(input?.subject?.publicObjectId)) errors.push('public_object_id_required');
  if (!SHA256.test(clean(input?.subject?.publicObjectDigest))) errors.push('public_object_digest_required');
  if (!['delivery_completed', 'response_observed', 'inspection_verified', 'correction_required'].includes(input?.relationshipType)) {
    errors.push('relationship_type_invalid');
  }
  if (!clean(input?.statement)) errors.push('relationship_statement_required');
  if (unique(input?.provenanceRefIds).length === 0) errors.push('provenance_required');
  if (!clean(input?.reviewedAt)) errors.push('reviewed_at_required');
  if (!input?.publicDisclosureAllowed) errors.push('public_disclosure_not_allowed');
  if (input?.reviewStatus === 'reviewed_with_gaps' && unique(input?.uncertainty).length === 0) {
    errors.push('uncertainty_required_for_reviewed_gaps');
  }
  if (!['verified_for_internal_use', 'reviewed_with_gaps'].includes(input?.reviewStatus)) {
    errors.push('review_status_invalid');
  }
  if (clean(input?.confirmationText) !== 'PREPARE TRADEPROOF RELATIONSHIP CANDIDATE') {
    errors.push('exact_handoff_confirmation_required');
  }
  if (!clean(input?.preparedAt)) errors.push('prepared_at_required');
  return errors;
}

export async function createRelationshipFeedbackHandoff(input) {
  const errors = validate(input);
  if (errors.length) throw new Error(errors.join(','));

  const provenanceRefIds = unique(input.provenanceRefIds);
  const uncertainty = unique(input.uncertainty);
  const candidateSeed = {
    schemaVersion: RELATIONSHIP_CANDIDATE_VERSION,
    subject: {
      kind: input.subject.kind,
      publicObjectId: clean(input.subject.publicObjectId),
      publicObjectDigest: clean(input.subject.publicObjectDigest)
    },
    relationshipType: input.relationshipType,
    statement: clean(input.statement),
    provenanceRefIds,
    uncertainty,
    reviewedAt: clean(input.reviewedAt),
    status: 'candidate_pending_holder_review',
    boundaries: {
      identityVerified: false,
      relationshipVerifiedForPublicUse: false,
      rankingPerformed: false,
      scoreCreated: false,
      publicProfileUpdated: false,
      registryWritePerformed: false,
      chainSubmissionPerformed: false,
      externalActionPerformed: false
    }
  };
  const candidateDigest = await sha256Text(canonicalJson(candidateSeed));
  const candidate = {
    ...candidateSeed,
    candidateId: `relationship-candidate:${candidateDigest.slice(7, 23)}`,
    candidateDigest
  };
  const envelope = {
    schemaVersion: RELATIONSHIP_FEEDBACK_HANDOFF_VERSION,
    handoffId: `relationship-handoff:${candidateDigest.slice(7, 23)}`,
    preparedAt: clean(input.preparedAt),
    source: {
      sourceSystem: 'tradeos',
      sourceCaseId: clean(input.sourceCaseId),
      sourceCaseDigest: clean(input.sourceCaseDigest),
      sourceEvidenceDigest: clean(input.sourceEvidenceDigest),
      organizationIdIncluded: false,
      actorIdIncluded: false,
      rawEvidenceIncluded: false,
      contactDataIncluded: false
    },
    candidate,
    status: 'handoff_prepared_not_imported',
    boundaries: {
      holderReviewRequired: true,
      importPerformed: false,
      publicationApproved: false,
      publicWritePerformed: false,
      registryWritePerformed: false,
      chainSubmissionPerformed: false,
      externalActionPerformed: false
    }
  };
  return {
    ...envelope,
    handoffDigest: await sha256Text(canonicalJson(unsignedEnvelope(envelope)))
  };
}

export function relationshipFeedbackPublicProjection(envelope) {
  return {
    schemaVersion: RELATIONSHIP_CANDIDATE_VERSION,
    candidateId: envelope.candidate.candidateId,
    candidateDigest: envelope.candidate.candidateDigest,
    subject: envelope.candidate.subject,
    relationshipType: envelope.candidate.relationshipType,
    statement: envelope.candidate.statement,
    provenanceRefIds: envelope.candidate.provenanceRefIds,
    uncertainty: envelope.candidate.uncertainty,
    reviewedAt: envelope.candidate.reviewedAt,
    status: envelope.candidate.status,
    privacy: {
      sourceCaseIdIncluded: false,
      organizationIdIncluded: false,
      actorIdIncluded: false,
      sourceEvidenceDigestIncluded: false,
      rawEvidenceIncluded: false,
      contactDataIncluded: false
    }
  };
}
