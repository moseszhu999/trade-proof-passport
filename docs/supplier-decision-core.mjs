export const SUPPLIER_DECISION_WORKSPACE_VERSION = 'tradeproof.supplier-decision-workspace.v1.0';
export const SUPPLIER_DECISION_RECORD_VERSION = 'tradeproof.supplier-decision-record.v1.0';
export const SUPPLIER_DECISION_MODEL_VERSION = 'tradeproof.supplier-decision-model.v1.0';
export const DECISION_CONFIRMATION_TEXT = 'CONFIRM SUPPLIER CASE DECISION';

const DECISIONS = new Set(['continue_contact','pause_pending_information','exclude_from_current_case','deeper_verification_required']);
const text = (value) => String(value ?? '').trim();
const clone = (value) => structuredClone(value);
const nowIso = (value) => value ?? new Date().toISOString();
const safeId = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'decision';
const nonEmptyAnswer = (value) => Array.isArray(value) ? value.some((item) => text(item)) : (typeof value === 'boolean' || typeof value === 'number' || Boolean(text(value)));

function confirmedRequirements(caseRecord) {
  return (caseRecord?.requirementCandidates ?? [])
    .filter((item) => item.status === 'confirmed_in_supplied_source' && item.officialRequirement === true)
    .map((item) => ({ requirementId: item.requirementId, category: item.category, label: item.label, excerpt: item.excerpt ?? null }));
}
function parsedDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
function candidateEvidence(candidateId, evidenceQueue) {
  return (evidenceQueue?.items ?? []).filter((item) => item.candidateId === candidateId);
}
function candidateReviews(candidateId, evidenceQueue, verificationWorkspace) {
  const evidenceIds = new Set(candidateEvidence(candidateId, evidenceQueue).map((item) => item.evidenceId));
  return (verificationWorkspace?.reviews ?? []).filter((review) => evidenceIds.has(review.evidenceId));
}
function latestCommunication(candidateId, timeline) {
  const events = (timeline?.events ?? []).filter((event) => event.association?.candidateId === candidateId);
  const ordered = events.slice().sort((a, b) => String(b.sentAt ?? b.observedAt ?? '').localeCompare(String(a.sentAt ?? a.observedAt ?? '')));
  return { events: ordered, latestAt: ordered[0]?.sentAt ?? ordered[0]?.observedAt ?? null, unresolvedActionCandidates: ordered.flatMap((event) => event.actionCandidates ?? []).filter((item) => item.state === 'candidate_unconfirmed').length };
}
function responseFor(candidateId, responses) {
  return (responses ?? []).find((item) => item.candidateId === candidateId) ?? null;
}
function questionForRequirement(requirementId, request) {
  return (request?.questions ?? []).find((item) => item.sourceRequirementId === requirementId) ?? null;
}
function answerForQuestion(response, questionId) {
  return (response?.answers ?? []).find((item) => item.questionId === questionId) ?? null;
}
function evidenceExpired(item, asOf) {
  const expiry = (item?.extractedFindings ?? []).find((finding) => finding.field === 'valid_until' && finding.state === 'confirmed_in_local_file' && finding.sourceConfirmed === true);
  const date = parsedDate(expiry?.value);
  return Boolean(date && date.getTime() < asOf.getTime());
}
function requirementState({ answer, evidenceItems, reviews, asOf }) {
  if (reviews.some((review) => review.assessment === 'contradicted')) return 'contradicted_candidate';
  if (evidenceItems.some((item) => evidenceExpired(item, asOf))) return 'stale';
  if (reviews.some((review) => review.assessment === 'supported' && review.humanReviewConfirmed === true)) return 'supported_candidate';
  if (!answer || !nonEmptyAnswer(answer.value)) return 'missing';
  if (evidenceItems.length) return 'unverified_evidence_available';
  return 'unverified_response_only';
}
function requirementRows(candidateId, caseRecord, request, response, evidenceQueue, verificationWorkspace, asOf) {
  return confirmedRequirements(caseRecord).map((requirement) => {
    const question = questionForRequirement(requirement.requirementId, request);
    const answer = question ? answerForQuestion(response, question.questionId) : null;
    const evidenceItems = candidateEvidence(candidateId, evidenceQueue).filter((item) => question && item.questionId === question.questionId);
    const evidenceIds = new Set(evidenceItems.map((item) => item.evidenceId));
    const reviews = (verificationWorkspace?.reviews ?? []).filter((review) => evidenceIds.has(review.evidenceId));
    const state = requirementState({ answer, evidenceItems, reviews, asOf });
    return {
      requirementId: requirement.requirementId,
      category: requirement.category,
      label: requirement.label,
      excerpt: requirement.excerpt,
      questionId: question?.questionId ?? null,
      state,
      answerPresent: Boolean(answer && nonEmptyAnswer(answer.value)),
      answerClassification: answer?.supplierStatementClassification ?? null,
      evidenceItemIds: evidenceItems.map((item) => item.evidenceId),
      verificationReviewIds: reviews.map((item) => item.reviewId),
      humanReviewedSupportedCount: reviews.filter((item) => item.assessment === 'supported' && item.humanReviewConfirmed === true).length,
      contradictedCount: reviews.filter((item) => item.assessment === 'contradicted').length,
      evidenceVerified: false,
      supplierEligibilityDecided: false
    };
  });
}
function responseSummary(response, request) {
  const required = (request?.questions ?? []).filter((item) => item.required !== false);
  const answers = new Map((response?.answers ?? []).map((item) => [item.questionId, item]));
  const answered = required.filter((question) => nonEmptyAnswer(answers.get(question.questionId)?.value)).length;
  return {
    state: response ? (answered === required.length ? 'response_received_unverified' : 'partial_response_unverified') : 'no_response',
    answered,
    required: required.length,
    missing: Math.max(0, required.length - answered),
    supplierIdentityVerified: false,
    evidenceVerified: false
  };
}
function actionCandidates(candidateId, rows, response, responseInfo, evidenceItems, reviews, communication) {
  const actions = [];
  const add = (type, label, reason) => actions.push({
    actionId: `decision-action:${safeId(candidateId)}:${type}`,
    actionType: type,
    label,
    reason,
    state: 'candidate_unconfirmed',
    humanConfirmationRequired: true,
    externalActionPerformed: false
  });
  if (!response) add('request_supplier_response', '索取统一供应商回复', '当前没有导入该供应商的结构化回复。');
  else if (responseInfo.missing) add('request_missing_answers', '补齐供应商回复缺失项', `仍缺少 ${responseInfo.missing} 个必答问题。`);
  const contradicted = rows.filter((row) => row.state === 'contradicted_candidate').length;
  const stale = rows.filter((row) => row.state === 'stale').length;
  const missing = rows.filter((row) => row.state === 'missing').length;
  if (contradicted) add('investigate_contradiction', '澄清矛盾证据', `${contradicted} 项正式要求存在外部回执矛盾候选。`);
  if (stale) add('request_current_evidence', '索取当前有效证据', `${stale} 项证据可能已经过期。`);
  if (missing) add('close_requirement_gaps', '补齐正式要求缺口', `${missing} 项正式要求没有可用回复。`);
  if (reviews.some((review) => review.state === 'receipt_pending_holder_review')) add('review_external_receipts', '审查外部核验回执', '存在尚未完成持有者审查的外部回执。');
  if (evidenceItems.length === 0 && response) add('request_evidence_files', '索取证据文件', '已有供应商回复，但尚未进入本地证据队列。');
  if (communication.unresolvedActionCandidates) add('review_inbound_actions', '处理入站沟通待办', `通信时间线仍有 ${communication.unresolvedActionCandidates} 个动作候选。`);
  return actions;
}
function ruleSuggestion(rows, responseInfo) {
  if (rows.some((row) => row.state === 'contradicted_candidate')) return { decision: 'deeper_verification_required', reason: '至少一项正式要求存在矛盾候选，需先深度核验。' };
  if (rows.some((row) => row.state === 'stale')) return { decision: 'deeper_verification_required', reason: '至少一项证据可能过期，需索取当前证据并复核。' };
  if (responseInfo.state === 'no_response' || responseInfo.missing > 0 || rows.some((row) => row.state === 'missing')) return { decision: 'pause_pending_information', reason: '供应商回复或正式要求证据仍有缺口。' };
  return { decision: 'continue_contact', reason: '当前未发现矛盾或过期信号，且必答信息已齐备；仍需人工判断。' };
}

export function createSupplierDecisionWorkspace(caseRecord, selectedCandidateIds = [], at) {
  return {
    schemaVersion: SUPPLIER_DECISION_WORKSPACE_VERSION,
    workspaceId: `supplier-decision:${safeId(caseRecord?.caseId)}`,
    caseId: caseRecord?.caseId ?? null,
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    state: 'holder_local_private',
    candidateOrder: [...new Set(selectedCandidateIds)],
    decisions: [],
    boundaries: {
      numericScoreGenerated: false,
      rankingGenerated: false,
      formalShortlistCreated: false,
      supplierEligibilityDecided: false,
      awardDecisionCreated: false,
      externalActionPerformed: false,
      serverPersistencePerformed: false
    }
  };
}

export function buildSupplierDecisionModel({ caseRecord, supplierReview, request, responses, evidenceQueue, verificationWorkspace, timeline, supplierCollection, decisionWorkspace, asOf = new Date() }) {
  const selected = supplierReview?.selectedCandidateIds ?? decisionWorkspace?.candidateOrder ?? [];
  const collectionMap = new Map((supplierCollection?.candidates ?? []).map((item) => [item.candidateId, item]));
  const candidates = selected.map((candidateId) => {
    const candidate = collectionMap.get(candidateId) ?? { candidateId, displayName: candidateId };
    const response = responseFor(candidateId, responses);
    const responseInfo = responseSummary(response, request);
    const evidenceItems = candidateEvidence(candidateId, evidenceQueue);
    const reviews = candidateReviews(candidateId, evidenceQueue, verificationWorkspace);
    const communication = latestCommunication(candidateId, timeline);
    const rows = requirementRows(candidateId, caseRecord, request, response, evidenceQueue, verificationWorkspace, asOf);
    const counts = {
      supported: rows.filter((row) => row.state === 'supported_candidate').length,
      missing: rows.filter((row) => row.state === 'missing').length,
      contradicted: rows.filter((row) => row.state === 'contradicted_candidate').length,
      stale: rows.filter((row) => row.state === 'stale').length,
      unverifiedEvidence: rows.filter((row) => row.state === 'unverified_evidence_available').length,
      unverifiedResponseOnly: rows.filter((row) => row.state === 'unverified_response_only').length,
      evidenceItems: evidenceItems.length,
      verificationReviews: reviews.length,
      inboundEvents: communication.events.length
    };
    const suggestion = ruleSuggestion(rows, responseInfo);
    return {
      candidateId,
      displayName: candidate.displayName,
      requirementRows: rows,
      responseSummary: responseInfo,
      evidenceSummary: {
        items: evidenceItems.length,
        parsedTextItems: evidenceItems.filter((item) => item.documentContentParsed === true).length,
        metadataOnlyItems: evidenceItems.filter((item) => item.documentContentParsed === false).length,
        evidenceVerified: 0
      },
      verificationSummary: {
        supportedCandidates: reviews.filter((item) => item.assessment === 'supported').length,
        contradictedCandidates: reviews.filter((item) => item.assessment === 'contradicted').length,
        inconclusiveCandidates: reviews.filter((item) => item.assessment === 'inconclusive').length,
        pendingHolderReview: reviews.filter((item) => item.state === 'receipt_pending_holder_review').length,
        verifierIdentitiesVerified: 0,
        receiptsAuthenticated: 0
      },
      communicationSummary: { events: communication.events.length, latestAt: communication.latestAt, unresolvedActionCandidates: communication.unresolvedActionCandidates },
      counts,
      actionCandidates: actionCandidates(candidateId, rows, response, responseInfo, evidenceItems, reviews, communication),
      ruleSuggestion: { ...suggestion, classification: 'deterministic_next_step_suggestion_not_decision', supplierEligibilityDecided: false },
      currentDecision: (decisionWorkspace?.decisions ?? []).find((item) => item.candidateId === candidateId) ?? null,
      numericScore: null,
      rank: null,
      supplierEligibilityDecided: false
    };
  });
  return {
    schemaVersion: SUPPLIER_DECISION_MODEL_VERSION,
    caseId: caseRecord?.caseId ?? null,
    asOf: asOf.toISOString(),
    orderingPolicy: 'holder_selection_order_no_ranking',
    candidates,
    counts: {
      candidates: candidates.length,
      withContradictions: candidates.filter((item) => item.counts.contradicted > 0).length,
      withMissingInformation: candidates.filter((item) => item.counts.missing > 0 || item.responseSummary.missing > 0).length,
      withStaleEvidence: candidates.filter((item) => item.counts.stale > 0).length,
      decisionsRecorded: candidates.filter((item) => item.currentDecision).length,
      eligibilityDecisions: 0,
      formalShortlists: 0
    },
    boundaries: { numericScoreGenerated: false, rankingGenerated: false, formalShortlistCreated: false, supplierEligibilityDecided: false, awardDecisionCreated: false }
  };
}

export function createSupplierDecisionRecord(candidateModel, decision, reason, confirmationText, at) {
  if (!DECISIONS.has(decision)) throw new Error('unsupported supplier case decision');
  if (text(confirmationText) !== DECISION_CONFIRMATION_TEXT) throw new Error('exact supplier decision confirmation is required');
  if (!text(reason)) throw new Error('decision reason is required');
  if (!candidateModel?.candidateId) throw new Error('candidate model is required');
  return {
    schemaVersion: SUPPLIER_DECISION_RECORD_VERSION,
    decisionId: `supplier-decision:${safeId(candidateModel.candidateId)}`,
    candidateId: candidateModel.candidateId,
    displayName: candidateModel.displayName,
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    state: 'holder_local_candidate_decision',
    decision,
    decisionClassification: 'human_case_progression_candidate',
    reason: text(reason),
    observedSignals: {
      requirementCounts: clone(candidateModel.counts),
      responseState: candidateModel.responseSummary.state,
      responseMissing: candidateModel.responseSummary.missing,
      verificationPendingHolderReview: candidateModel.verificationSummary.pendingHolderReview,
      unresolvedInboundActions: candidateModel.communicationSummary.unresolvedActionCandidates,
      ruleSuggestion: candidateModel.ruleSuggestion.decision
    },
    humanConfirmed: true,
    boundaries: {
      externalActionPerformed: false,
      formalSubmissionPerformed: false,
      formalShortlistCreated: false,
      supplierEligibilityDecided: false,
      awardDecisionCreated: false,
      rankingGenerated: false,
      numericScore: null,
      rank: null
    }
  };
}
export function upsertSupplierDecision(workspace, record, at) {
  const errors = validateSupplierDecisionRecord(record);
  if (errors.length) throw new Error(errors.join('; '));
  const next = clone(workspace);
  if (!(next.candidateOrder ?? []).includes(record.candidateId)) throw new Error('decision candidate is not selected');
  next.decisions = [...(next.decisions ?? []).filter((item) => item.candidateId !== record.candidateId), clone(record)];
  next.updatedAt = nowIso(at);
  return next;
}
export function validateSupplierDecisionRecord(record) {
  const errors = [];
  if (record?.schemaVersion !== SUPPLIER_DECISION_RECORD_VERSION) errors.push('unexpected supplier decision record schemaVersion');
  if (!DECISIONS.has(record?.decision)) errors.push('unsupported supplier decision');
  if (record?.state !== 'holder_local_candidate_decision') errors.push('decision must remain holder_local_candidate_decision');
  if (record?.decisionClassification !== 'human_case_progression_candidate') errors.push('decision classification must remain candidate');
  if (record?.humanConfirmed !== true) errors.push('decision must be human confirmed');
  if (!text(record?.reason)) errors.push('decision reason is required');
  for (const key of ['externalActionPerformed','formalSubmissionPerformed','formalShortlistCreated','supplierEligibilityDecided','awardDecisionCreated','rankingGenerated']) {
    if (record?.boundaries?.[key] !== false) errors.push(`${key} must remain false`);
  }
  if (record?.boundaries?.numericScore !== null || record?.boundaries?.rank !== null) errors.push('numeric score and rank must remain null');
  return errors;
}
export function validateSupplierDecisionWorkspace(workspace) {
  const errors = [];
  if (workspace?.schemaVersion !== SUPPLIER_DECISION_WORKSPACE_VERSION) errors.push('unexpected supplier decision workspace schemaVersion');
  if (workspace?.state !== 'holder_local_private') errors.push('decision workspace must remain holder_local_private');
  const allowed = new Set(workspace?.candidateOrder ?? []);
  const seen = new Set();
  for (const record of workspace?.decisions ?? []) {
    for (const error of validateSupplierDecisionRecord(record)) errors.push(`${record?.candidateId}: ${error}`);
    if (!allowed.has(record.candidateId)) errors.push(`decision candidate is not selected: ${record.candidateId}`);
    if (seen.has(record.candidateId)) errors.push(`duplicate decision candidate: ${record.candidateId}`);
    seen.add(record.candidateId);
  }
  for (const key of ['numericScoreGenerated','rankingGenerated','formalShortlistCreated','supplierEligibilityDecided','awardDecisionCreated','externalActionPerformed','serverPersistencePerformed']) {
    if (workspace?.boundaries?.[key] !== false) errors.push(`${key} must remain false`);
  }
  return errors;
}

export { DECISIONS };
