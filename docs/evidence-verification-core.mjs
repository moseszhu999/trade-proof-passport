export const VERIFICATION_TASK_VERSION = 'tradeproof.evidence-verification-task.v0.9';
export const VERIFICATION_RECEIPT_VERSION = 'tradeproof.evidence-verification-receipt.v0.9';
export const VERIFICATION_REVIEW_VERSION = 'tradeproof.evidence-verification-review.v0.9';
export const VERIFICATION_WORKSPACE_VERSION = 'tradeproof.evidence-verification-workspace.v0.9';
export const HANDOFF_CONFIRMATION_TEXT = 'APPROVE VERIFICATION HANDOFF';
export const RECEIPT_REVIEW_CONFIRMATION_TEXT = 'CONFIRM VERIFICATION RECEIPT REVIEW';

const OUTCOMES = new Set(['supported', 'contradicted', 'inconclusive']);
const VERIFIER_TYPES = new Set(['certification_body', 'testing_laboratory', 'inspection_provider', 'registry_operator', 'professional_reviewer', 'other']);
const text = (value) => String(value ?? '').trim();
const clone = (value) => structuredClone(value);
const nowIso = (value) => value ?? new Date().toISOString();
const safeId = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'verification';
const unique = (values) => [...new Set(values.filter(Boolean))];

function assertSha256(value, label = 'digest') {
  if (!/^sha256:[0-9a-f]{64}$/.test(text(value))) throw new Error(`${label} must be sha256`);
}

function eligibleFindings(evidenceItem) {
  return (evidenceItem?.extractedFindings ?? []).filter((finding) => finding.state === 'confirmed_in_local_file' && finding.sourceConfirmed === true);
}

function overallOutcome(fieldResults) {
  if (fieldResults.some((item) => item.outcome === 'contradicted')) return 'contradicted';
  if (fieldResults.length > 0 && fieldResults.every((item) => item.outcome === 'supported')) return 'supported';
  return 'inconclusive';
}

export function createVerificationWorkspace(caseRecord, evidenceQueue, at) {
  return {
    schemaVersion: VERIFICATION_WORKSPACE_VERSION,
    workspaceId: `evidence-verification:${safeId(caseRecord?.caseId)}`,
    caseId: caseRecord?.caseId ?? evidenceQueue?.caseId ?? null,
    evidenceQueueId: evidenceQueue?.queueId ?? null,
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    state: 'holder_local_private',
    tasks: [],
    receipts: [],
    reviews: [],
    boundaries: {
      connectorRuntimeUsed: false,
      externalLookupPerformed: false,
      externalRequestSent: false,
      verifierIdentityVerified: false,
      receiptAuthenticityVerified: false,
      evidenceVerified: false,
      formalSubmissionPerformed: false,
      rankingGenerated: false,
      supplierEligibilityDecided: false
    }
  };
}

export function createVerificationTask(evidenceItem, findingIds, verifierInput = {}, at) {
  if (!evidenceItem?.evidenceId) throw new Error('evidence item is required');
  assertSha256(evidenceItem.contentDigest, 'evidence digest');
  if (evidenceItem?.boundaries?.evidenceVerified !== false) throw new Error('source evidence must remain unverified');
  const eligible = eligibleFindings(evidenceItem);
  const selectedIds = unique(findingIds ?? []);
  if (selectedIds.length === 0) throw new Error('at least one confirmed source finding is required');
  const selected = selectedIds.map((findingId) => {
    const finding = eligible.find((item) => item.findingId === findingId);
    if (!finding) throw new Error(`finding is not confirmed in local file: ${findingId}`);
    return {
      findingId: finding.findingId,
      field: finding.field,
      claimedValue: finding.value,
      sourceExcerpt: finding.excerpt || null,
      sourceConfirmed: true,
      evidenceVerified: false
    };
  });
  const verifierType = text(verifierInput.verifierType) || 'other';
  if (!VERIFIER_TYPES.has(verifierType)) throw new Error('unsupported verifier type');
  const verifierName = text(verifierInput.verifierName);
  if (!verifierName) throw new Error('verifier name is required');
  const selector = selected.map((item) => item.findingId).sort().join('|');
  const taskId = `verification-task:${safeId(evidenceItem.evidenceId)}:${safeId(selector).slice(0, 40)}`;
  return {
    schemaVersion: VERIFICATION_TASK_VERSION,
    taskId,
    caseId: evidenceItem.caseId,
    requestId: evidenceItem.requestId,
    candidateId: evidenceItem.candidateId,
    evidenceId: evidenceItem.evidenceId,
    contentDigest: evidenceItem.contentDigest,
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    state: 'holder_local_draft',
    verificationPurpose: 'field_level_external_verification',
    sourceFile: {
      fileName: evidenceItem.source?.fileName ?? null,
      mediaType: evidenceItem.source?.mediaType ?? null,
      size: evidenceItem.source?.size ?? null,
      originalFileIncluded: false
    },
    verifier: {
      verifierName,
      verifierType,
      contactReference: text(verifierInput.contactReference) || null,
      instructions: text(verifierInput.instructions) || null,
      verifierIdentityVerified: false
    },
    selectedFindings: selected,
    approval: {
      holderDisclosureApproved: false,
      exportApproved: false,
      approvedAt: null,
      scope: 'verification_handoff_package_only'
    },
    boundaries: {
      originalFileIncluded: false,
      fullContentIncluded: false,
      connectorRuntimeUsed: false,
      externalLookupPerformed: false,
      externalRequestSent: false,
      verifierIdentityVerified: false,
      evidenceVerified: false,
      formalSubmissionPerformed: false,
      rankingGenerated: false,
      supplierEligibilityDecided: false
    }
  };
}

export function approveVerificationHandoff(task, confirmationText, at) {
  if (text(confirmationText) !== HANDOFF_CONFIRMATION_TEXT) throw new Error('exact verification handoff confirmation is required');
  const next = clone(task);
  next.state = 'holder_export_ready';
  next.updatedAt = nowIso(at);
  next.approval = {
    holderDisclosureApproved: true,
    exportApproved: true,
    approvedAt: nowIso(at),
    scope: 'verification_handoff_package_only'
  };
  next.boundaries.externalRequestSent = false;
  next.boundaries.formalSubmissionPerformed = false;
  return next;
}

export function buildVerificationHandoffPackage(task) {
  const errors = validateVerificationTask(task);
  if (errors.length) throw new Error(errors.join('; '));
  if (task.state !== 'holder_export_ready' || task.approval?.exportApproved !== true) throw new Error('verification task is not export approved');
  return {
    schemaVersion: 'tradeproof.evidence-verification-handoff-package.v0.9',
    taskId: task.taskId,
    caseId: task.caseId,
    requestId: task.requestId,
    candidateId: task.candidateId,
    evidenceId: task.evidenceId,
    contentDigest: task.contentDigest,
    verificationPurpose: task.verificationPurpose,
    verifier: clone(task.verifier),
    sourceFile: clone(task.sourceFile),
    requestedChecks: clone(task.selectedFindings),
    boundaries: {
      originalFileIncluded: false,
      fullContentIncluded: false,
      externalRequestSent: false,
      formalSubmissionPerformed: false,
      supplierEligibilityDecided: false
    }
  };
}

export function buildReceiptTemplate(task) {
  const handoff = buildVerificationHandoffPackage(task);
  return {
    schemaVersion: VERIFICATION_RECEIPT_VERSION,
    receiptId: `verification-receipt:${safeId(task.taskId)}`,
    taskId: task.taskId,
    evidenceId: task.evidenceId,
    contentDigest: task.contentDigest,
    reviewedAt: null,
    verifier: {
      verifierName: task.verifier.verifierName,
      verifierType: task.verifier.verifierType,
      verifierReference: null,
      signerName: null,
      signerRole: null,
      statementOfAuthority: null
    },
    fieldResults: handoff.requestedChecks.map((finding) => ({
      findingId: finding.findingId,
      field: finding.field,
      claimedValue: finding.claimedValue,
      outcome: 'inconclusive',
      observedValue: null,
      rationale: null,
      sourceReference: null
    })),
    overallStatement: null,
    receiptClassification: 'external_verification_receipt_unverified',
    verifierIdentityVerified: false,
    receiptAuthenticityVerified: false,
    evidenceVerified: false,
    formalSubmissionPerformed: false
  };
}

export function validateReceiptAgainstTask(task, receipt) {
  const errors = [];
  if (receipt?.schemaVersion !== VERIFICATION_RECEIPT_VERSION) errors.push('unexpected verification receipt schemaVersion');
  if (receipt?.taskId !== task?.taskId) errors.push('receipt taskId mismatch');
  if (receipt?.evidenceId !== task?.evidenceId) errors.push('receipt evidenceId mismatch');
  if (receipt?.contentDigest !== task?.contentDigest) errors.push('receipt contentDigest mismatch');
  try { assertSha256(receipt?.contentDigest, 'receipt contentDigest'); } catch (error) { errors.push(error.message); }
  const expected = new Map((task?.selectedFindings ?? []).map((finding) => [finding.findingId, finding]));
  const seen = new Set();
  for (const result of receipt?.fieldResults ?? []) {
    const finding = expected.get(result.findingId);
    if (!finding) errors.push(`unexpected receipt finding: ${result.findingId}`);
    if (seen.has(result.findingId)) errors.push(`duplicate receipt finding: ${result.findingId}`);
    seen.add(result.findingId);
    if (!OUTCOMES.has(result.outcome)) errors.push(`unsupported receipt outcome: ${result.outcome}`);
    if (finding && result.field !== finding.field) errors.push(`receipt field mismatch: ${result.findingId}`);
  }
  for (const findingId of expected.keys()) if (!seen.has(findingId)) errors.push(`missing receipt finding: ${findingId}`);
  if (receipt?.receiptClassification !== 'external_verification_receipt_unverified') errors.push('receipt classification must remain unverified');
  for (const key of ['verifierIdentityVerified', 'receiptAuthenticityVerified', 'evidenceVerified', 'formalSubmissionPerformed']) if (receipt?.[key] !== false) errors.push(`${key} must remain false`);
  return errors;
}

export function createVerificationReview(task, receipt, at) {
  const errors = validateReceiptAgainstTask(task, receipt);
  if (errors.length) throw new Error(errors.join('; '));
  const fieldAssessments = receipt.fieldResults.map((result) => ({
    findingId: result.findingId,
    field: result.field,
    claimedValue: result.claimedValue,
    observedValue: result.observedValue ?? null,
    outcome: result.outcome,
    rationale: text(result.rationale) || null,
    sourceReference: text(result.sourceReference) || null,
    humanReviewed: false
  }));
  const assessment = overallOutcome(fieldAssessments);
  return {
    schemaVersion: VERIFICATION_REVIEW_VERSION,
    reviewId: `verification-review:${safeId(receipt.receiptId || task.taskId)}`,
    taskId: task.taskId,
    receiptId: receipt.receiptId,
    evidenceId: task.evidenceId,
    contentDigest: task.contentDigest,
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    state: 'receipt_pending_holder_review',
    assessment,
    assessmentClassification: 'external_receipt_assessment_candidate',
    fieldAssessments,
    verifier: clone(receipt.verifier),
    humanReviewConfirmed: false,
    humanReviewConfirmedAt: null,
    boundaries: {
      verifierIdentityVerified: false,
      receiptAuthenticityVerified: false,
      evidenceVerified: false,
      externalVerificationAutomaticallyTrusted: false,
      formalSubmissionPerformed: false,
      rankingGenerated: false,
      supplierEligibilityDecided: false
    }
  };
}

export function confirmVerificationReview(review, confirmationText, at) {
  if (text(confirmationText) !== RECEIPT_REVIEW_CONFIRMATION_TEXT) throw new Error('exact receipt review confirmation is required');
  const next = clone(review);
  next.state = 'holder_reviewed_receipt_unverified';
  next.updatedAt = nowIso(at);
  next.humanReviewConfirmed = true;
  next.humanReviewConfirmedAt = nowIso(at);
  next.fieldAssessments = next.fieldAssessments.map((item) => ({ ...item, humanReviewed: true }));
  next.boundaries.evidenceVerified = false;
  next.boundaries.supplierEligibilityDecided = false;
  return next;
}

export function upsertVerificationTask(workspace, task, at) {
  const errors = validateVerificationTask(task);
  if (errors.length) throw new Error(errors.join('; '));
  const next = clone(workspace);
  next.tasks = [...next.tasks.filter((item) => item.taskId !== task.taskId), clone(task)];
  next.updatedAt = nowIso(at);
  return next;
}

export function upsertVerificationReceipt(workspace, task, receipt, at) {
  const errors = validateReceiptAgainstTask(task, receipt);
  if (errors.length) throw new Error(errors.join('; '));
  const next = clone(workspace);
  next.receipts = [...next.receipts.filter((item) => item.receiptId !== receipt.receiptId), clone(receipt)];
  next.updatedAt = nowIso(at);
  return next;
}

export function upsertVerificationReview(workspace, review, at) {
  const errors = validateVerificationReview(review);
  if (errors.length) throw new Error(errors.join('; '));
  const next = clone(workspace);
  next.reviews = [...next.reviews.filter((item) => item.reviewId !== review.reviewId), clone(review)];
  next.updatedAt = nowIso(at);
  return next;
}

export function validateVerificationTask(task) {
  const errors = [];
  if (task?.schemaVersion !== VERIFICATION_TASK_VERSION) errors.push('unexpected verification task schemaVersion');
  if (!text(task?.taskId) || !text(task?.caseId) || !text(task?.candidateId) || !text(task?.evidenceId)) errors.push('verification task identifiers are required');
  try { assertSha256(task?.contentDigest, 'task contentDigest'); } catch (error) { errors.push(error.message); }
  if (!Array.isArray(task?.selectedFindings) || task.selectedFindings.length === 0) errors.push('verification task needs selected findings');
  for (const finding of task?.selectedFindings ?? []) {
    if (finding.sourceConfirmed !== true || finding.evidenceVerified !== false) errors.push(`task finding boundary changed: ${finding.findingId}`);
  }
  if (task?.verifier?.verifierIdentityVerified !== false) errors.push('verifier identity must remain unverified');
  for (const key of ['originalFileIncluded', 'fullContentIncluded', 'connectorRuntimeUsed', 'externalLookupPerformed', 'externalRequestSent', 'verifierIdentityVerified', 'evidenceVerified', 'formalSubmissionPerformed', 'rankingGenerated', 'supplierEligibilityDecided']) if (task?.boundaries?.[key] !== false) errors.push(`${key} must remain false`);
  return errors;
}

export function validateVerificationReview(review) {
  const errors = [];
  if (review?.schemaVersion !== VERIFICATION_REVIEW_VERSION) errors.push('unexpected verification review schemaVersion');
  if (!OUTCOMES.has(review?.assessment)) errors.push('unsupported review assessment');
  if (review?.assessmentClassification !== 'external_receipt_assessment_candidate') errors.push('review assessment must remain candidate');
  for (const key of ['verifierIdentityVerified', 'receiptAuthenticityVerified', 'evidenceVerified', 'externalVerificationAutomaticallyTrusted', 'formalSubmissionPerformed', 'rankingGenerated', 'supplierEligibilityDecided']) if (review?.boundaries?.[key] !== false) errors.push(`${key} must remain false`);
  return errors;
}

export function validateVerificationWorkspace(workspace) {
  const errors = [];
  if (workspace?.schemaVersion !== VERIFICATION_WORKSPACE_VERSION) errors.push('unexpected verification workspace schemaVersion');
  if (workspace?.state !== 'holder_local_private') errors.push('verification workspace must remain holder_local_private');
  for (const key of ['connectorRuntimeUsed', 'externalLookupPerformed', 'externalRequestSent', 'verifierIdentityVerified', 'receiptAuthenticityVerified', 'evidenceVerified', 'formalSubmissionPerformed', 'rankingGenerated', 'supplierEligibilityDecided']) if (workspace?.boundaries?.[key] !== false) errors.push(`${key} must remain false`);
  for (const task of workspace?.tasks ?? []) for (const error of validateVerificationTask(task)) errors.push(`${task.taskId}: ${error}`);
  for (const review of workspace?.reviews ?? []) for (const error of validateVerificationReview(review)) errors.push(`${review.reviewId}: ${error}`);
  return errors;
}

export function buildVerificationWorkspaceModel(workspace) {
  const tasks = workspace?.tasks ?? [];
  const receipts = workspace?.receipts ?? [];
  const reviews = workspace?.reviews ?? [];
  return {
    schemaVersion: 'tradeproof.evidence-verification-workspace-model.v0.9',
    state: 'holder_local_projection',
    tasks,
    receipts,
    reviews,
    counts: {
      tasks: tasks.length,
      exportReadyTasks: tasks.filter((item) => item.state === 'holder_export_ready').length,
      receipts: receipts.length,
      pendingReviews: reviews.filter((item) => !item.humanReviewConfirmed).length,
      supported: reviews.filter((item) => item.assessment === 'supported').length,
      contradicted: reviews.filter((item) => item.assessment === 'contradicted').length,
      inconclusive: reviews.filter((item) => item.assessment === 'inconclusive').length,
      verifiedEvidence: 0,
      supplierEligibilityDecisions: 0
    },
    boundaries: clone(workspace?.boundaries ?? {})
  };
}
