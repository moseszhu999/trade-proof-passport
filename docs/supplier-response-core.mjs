export const SUPPLIER_RESPONSE_REQUEST_VERSION = 'tradeproof.supplier-response-request.v0.5';
export const SUPPLIER_RESPONSE_VERSION = 'tradeproof.supplier-response.v0.5';
export const SUPPLIER_RESPONSE_WORKSPACE_VERSION = 'tradeproof.supplier-response-workspace.v0.5';

function clone(value) {
  return structuredClone(value);
}

function text(value) {
  return String(value ?? '').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeAnswerValue(value) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return text(value);
}

function stableQuestionId(prefix, value, index) {
  const normalized = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${prefix}-${normalized || index + 1}`;
}

const BASE_QUESTIONS = [
  {
    questionId: 'base-company-identity',
    category: 'company_identity',
    prompt: '请提供公司法定名称、注册国家或地区、统一登记信息，以及实际生产地址。',
    responseType: 'structured_text',
    required: true,
    evidenceRequested: ['company_registration', 'factory_address_evidence']
  },
  {
    questionId: 'base-manufacturing-role',
    category: 'manufacturing',
    prompt: '请说明哪些产品和工序由贵司自行生产，哪些由关联方或外包方完成。',
    responseType: 'structured_text',
    required: true,
    evidenceRequested: ['manufacturing_process_description']
  },
  {
    questionId: 'base-product-catalogue',
    category: 'technical',
    prompt: '请提供与本项目相关的产品目录、型号、材料、尺寸范围和可定制能力。',
    responseType: 'structured_text',
    required: true,
    evidenceRequested: ['product_catalogue', 'technical_datasheet']
  },
  {
    questionId: 'base-certifications',
    category: 'evidence',
    prompt: '请列出相关认证或测试报告，并提供编号、适用产品、签发机构和有效期。',
    responseType: 'structured_text',
    required: true,
    evidenceRequested: ['certificate', 'test_report']
  },
  {
    questionId: 'base-capacity-lead-time',
    category: 'quantity',
    prompt: '请说明当前产能、最小订单量、样品周期、量产周期和可承诺交期。',
    responseType: 'structured_text',
    required: true,
    evidenceRequested: ['capacity_statement', 'lead_time_statement']
  },
  {
    questionId: 'base-delivery-installation',
    category: 'delivery',
    prompt: '请说明是否能够承担目的地交付、安装、调试、售后或当地合作安排。',
    responseType: 'structured_text',
    required: true,
    evidenceRequested: ['delivery_plan', 'installation_plan']
  },
  {
    questionId: 'base-commercial',
    category: 'commercial',
    prompt: '请说明报价币种、价格有效期、付款条件、质保和主要商务前提。',
    responseType: 'structured_text',
    required: true,
    evidenceRequested: ['quotation_draft']
  },
  {
    questionId: 'base-sample-quality',
    category: 'sample_quality',
    prompt: '请说明样品、检验、测试、缺陷处理和验收支持方式。',
    responseType: 'structured_text',
    required: true,
    evidenceRequested: ['sample_plan', 'quality_control_plan']
  }
];

function confirmedRequirements(caseRecord) {
  return (caseRecord?.requirementCandidates ?? [])
    .filter((item) => item.status === 'confirmed_in_supplied_source' && item.officialRequirement === true)
    .map((item) => ({
      requirementId: item.requirementId,
      category: item.category,
      label: item.label,
      excerpt: item.excerpt,
      evidenceClassification: item.evidenceClassification
    }));
}

function requirementQuestion(requirement, index) {
  return {
    questionId: stableQuestionId('requirement', requirement.requirementId || requirement.label, index),
    category: requirement.category,
    prompt: `针对已确认要求“${text(requirement.label)}”，请说明贵司如何满足，并列出可提供的证明材料。`,
    sourceRequirementId: requirement.requirementId,
    sourceExcerpt: requirement.excerpt,
    responseType: 'structured_text',
    required: true,
    evidenceRequested: ['requirement_specific_evidence'],
    evidenceClassification: 'holder_confirmed_requirement'
  };
}

export function buildSupplierResponseRequest(caseRecord, supplierReview, supplierCollection, now = new Date()) {
  const selected = new Set(supplierReview?.selectedCandidateIds ?? []);
  const allowed = new Set((supplierCollection?.candidates ?? []).map((item) => item.candidateId));
  const selectedCandidateIds = [...selected].filter((id) => allowed.has(id));
  const requirements = confirmedRequirements(caseRecord);
  const questions = [
    ...BASE_QUESTIONS.map((item) => clone(item)),
    ...requirements.map(requirementQuestion)
  ];
  return {
    schemaVersion: SUPPLIER_RESPONSE_REQUEST_VERSION,
    requestId: `supplier-response-request:${caseRecord?.sourceOpportunity?.recordId ?? supplierCollection?.targetOpportunityRecordId ?? 'unknown'}:v0.5`,
    caseId: caseRecord?.caseId ?? null,
    targetOpportunityId: supplierCollection?.targetOpportunityId ?? null,
    targetOpportunityRecordId: supplierCollection?.targetOpportunityRecordId ?? null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    selectedCandidateIds,
    confirmedRequirementIds: requirements.map((item) => item.requirementId),
    questions,
    instructions: {
      language: 'zh-CN',
      responseMustReferenceQuestionId: true,
      attachmentsRepresentedAsMetadataOnly: true,
      supplierStatementsRemainUnverified: true
    },
    state: 'holder_local_draft',
    externalSendPerformed: false,
    contactDisclosurePerformed: false,
    formalShortlistCreated: false,
    supplierEligibilityDecided: false,
    rankingGenerated: false
  };
}

export function validateSupplierResponseRequest(request, supplierReview, supplierCollection) {
  const errors = [];
  const selected = new Set(supplierReview?.selectedCandidateIds ?? []);
  const allowed = new Set((supplierCollection?.candidates ?? []).map((item) => item.candidateId));
  if (request?.schemaVersion !== SUPPLIER_RESPONSE_REQUEST_VERSION) errors.push('unexpected request schemaVersion');
  if (request?.state !== 'holder_local_draft') errors.push('request must remain holder_local_draft');
  if (request?.externalSendPerformed !== false) errors.push('externalSendPerformed must remain false');
  if (request?.contactDisclosurePerformed !== false) errors.push('contactDisclosurePerformed must remain false');
  if (request?.formalShortlistCreated !== false) errors.push('formalShortlistCreated must remain false');
  if (request?.supplierEligibilityDecided !== false) errors.push('supplierEligibilityDecided must remain false');
  if (request?.rankingGenerated !== false) errors.push('rankingGenerated must remain false');
  if (!Array.isArray(request?.questions) || request.questions.length < BASE_QUESTIONS.length) errors.push('question set is incomplete');
  const questionIds = request?.questions?.map((item) => item.questionId) ?? [];
  if (new Set(questionIds).size !== questionIds.length) errors.push('duplicate questionId');
  for (const id of request?.selectedCandidateIds ?? []) {
    if (!allowed.has(id)) errors.push(`unknown candidate: ${id}`);
    if (!selected.has(id)) errors.push(`candidate not selected in holder review: ${id}`);
  }
  return unique(errors);
}

export function createSupplierResponseTemplate(request, candidateId, supplierCollection, now = new Date()) {
  const candidate = (supplierCollection?.candidates ?? []).find((item) => item.candidateId === candidateId);
  if (!candidate) throw new Error(`Unknown supplier candidate: ${candidateId}`);
  if (!(request?.selectedCandidateIds ?? []).includes(candidateId)) throw new Error('Candidate is not selected in the local review.');
  return {
    schemaVersion: SUPPLIER_RESPONSE_VERSION,
    responseId: `supplier-response:${request.requestId}:${candidateId}`,
    requestId: request.requestId,
    caseId: request.caseId,
    candidateId,
    supplierDisplayName: candidate.displayName,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    submittedBy: {
      name: '',
      role: '',
      authorityConfirmedByPlatform: false
    },
    answers: request.questions.map((question) => ({
      questionId: question.questionId,
      value: '',
      evidenceRefs: [],
      supplierStatementClassification: 'supplier_submitted_unverified'
    })),
    declarations: {
      informationAccurateToSupplierKnowledge: false,
      authorityToRespond: false
    },
    state: 'supplier_response_draft',
    importedByHolder: false,
    supplierIdentityVerified: false,
    evidenceVerified: false,
    formalSubmissionPerformed: false,
    eligibilityDecisionCreated: false
  };
}

export function validateSupplierResponse(response, request, supplierCollection) {
  const errors = [];
  const candidateIds = new Set((supplierCollection?.candidates ?? []).map((item) => item.candidateId));
  const questionIds = new Set((request?.questions ?? []).map((item) => item.questionId));
  if (response?.schemaVersion !== SUPPLIER_RESPONSE_VERSION) errors.push('unexpected response schemaVersion');
  if (response?.requestId !== request?.requestId) errors.push('requestId mismatch');
  if (!candidateIds.has(response?.candidateId)) errors.push('unknown candidateId');
  if (!(request?.selectedCandidateIds ?? []).includes(response?.candidateId)) errors.push('candidate was not selected');
  if (!['supplier_response_draft', 'holder_imported_unverified'].includes(response?.state)) errors.push('unexpected response state');
  if (response?.supplierIdentityVerified !== false) errors.push('supplierIdentityVerified must remain false');
  if (response?.evidenceVerified !== false) errors.push('evidenceVerified must remain false');
  if (response?.formalSubmissionPerformed !== false) errors.push('formalSubmissionPerformed must remain false');
  if (response?.eligibilityDecisionCreated !== false) errors.push('eligibilityDecisionCreated must remain false');
  if (!Array.isArray(response?.answers)) errors.push('answers must be an array');
  for (const answer of response?.answers ?? []) {
    if (!questionIds.has(answer.questionId)) errors.push(`unknown questionId: ${answer.questionId}`);
    if (answer.supplierStatementClassification !== 'supplier_submitted_unverified') errors.push(`invalid supplier statement classification: ${answer.questionId}`);
    if (!Array.isArray(answer.evidenceRefs)) errors.push(`evidenceRefs must be an array: ${answer.questionId}`);
    for (const evidence of answer.evidenceRefs ?? []) {
      if (evidence?.contentUploaded === true) errors.push(`evidence content upload is outside v0.5: ${answer.questionId}`);
    }
  }
  return unique(errors);
}

export function importSupplierResponse(response, request, supplierCollection, now = new Date()) {
  const errors = validateSupplierResponse(response, request, supplierCollection);
  if (errors.length) throw new Error(errors.join('; '));
  const next = clone(response);
  next.answers = next.answers.map((answer) => ({
    ...answer,
    value: normalizeAnswerValue(answer.value),
    evidenceRefs: (answer.evidenceRefs ?? []).map((evidence) => ({
      fileName: text(evidence.fileName),
      mediaType: text(evidence.mediaType),
      digest: text(evidence.digest),
      contentUploaded: false,
      evidenceVerified: false
    }))
  }));
  next.updatedAt = now.toISOString();
  next.state = 'holder_imported_unverified';
  next.importedByHolder = true;
  next.supplierIdentityVerified = false;
  next.evidenceVerified = false;
  next.formalSubmissionPerformed = false;
  next.eligibilityDecisionCreated = false;
  return next;
}

function answerMap(response) {
  return new Map((response?.answers ?? []).map((item) => [item.questionId, item]));
}

function isAnswered(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  return text(value).length > 0;
}

function detectPublicClaimConflict(candidate, question, answer) {
  const value = text(answer?.value).toLowerCase();
  if (!value) return null;
  const publicClaims = (candidate?.publicClaims ?? []).map((item) => `${item.claimType} ${item.text}`.toLowerCase()).join(' ');
  if (question.category === 'delivery' && /cannot|unable|no installation|不提供安装|不能安装/.test(value) && /install|installation|安装/.test(publicClaims)) {
    return '供应商回复与其公开安装相关自述可能存在冲突，需要澄清适用范围。';
  }
  if (question.category === 'evidence' && /no certificate|none|没有认证|无认证/.test(value) && /iso|ce|certificate|认证/.test(publicClaims)) {
    return '供应商回复与其公开认证自述可能存在冲突，需要核对证书主体和适用产品。';
  }
  return null;
}

export function evaluateSupplierResponse(candidate, request, response) {
  const answers = answerMap(response);
  const questionAssessments = request.questions.map((question) => {
    const answer = answers.get(question.questionId);
    const answered = isAnswered(answer?.value);
    const evidenceRefs = answer?.evidenceRefs ?? [];
    const conflict = answered ? detectPublicClaimConflict(candidate, question, answer) : null;
    let state = 'missing_response';
    if (answered && conflict) state = 'claim_response_conflict';
    else if (answered && evidenceRefs.length) state = 'answered_with_unverified_evidence_metadata';
    else if (answered) state = 'answered_unverified';
    return {
      questionId: question.questionId,
      category: question.category,
      prompt: question.prompt,
      required: question.required,
      state,
      answerValue: answered ? clone(answer.value) : null,
      evidenceRefs: clone(evidenceRefs),
      conflict,
      supplierStatementClassification: answered ? 'supplier_submitted_unverified' : null,
      supplierIdentityVerified: false,
      evidenceVerified: false
    };
  });
  const answeredCount = questionAssessments.filter((item) => item.state !== 'missing_response').length;
  const missingCount = questionAssessments.filter((item) => item.state === 'missing_response').length;
  const conflictCount = questionAssessments.filter((item) => item.state === 'claim_response_conflict').length;
  let state = 'no_response';
  if (response && answeredCount > 0 && missingCount > 0) state = 'partial_response_unverified';
  if (response && answeredCount > 0 && missingCount === 0) state = 'response_received_unverified';
  return {
    candidateId: candidate.candidateId,
    displayName: candidate.displayName,
    state,
    questionAssessments,
    counts: {
      totalQuestions: request.questions.length,
      answered: answeredCount,
      missing: missingCount,
      conflicts: conflictCount,
      evidenceMetadataRefs: questionAssessments.reduce((sum, item) => sum + item.evidenceRefs.length, 0)
    },
    boundaries: {
      numericScore: null,
      rank: null,
      supplierIdentityVerified: false,
      evidenceVerified: false,
      supplierEligibilityDecided: false,
      formalShortlistCreated: false,
      externalContactPerformed: false
    }
  };
}

export function buildSupplierResponseWorkspace(request, responses, supplierCollection) {
  const responseByCandidate = new Map((responses ?? []).map((item) => [item.candidateId, item]));
  const selectedCandidates = (supplierCollection?.candidates ?? []).filter((item) => (request?.selectedCandidateIds ?? []).includes(item.candidateId));
  const candidates = selectedCandidates.map((candidate) => evaluateSupplierResponse(candidate, request, responseByCandidate.get(candidate.candidateId) ?? null));
  return {
    schemaVersion: SUPPLIER_RESPONSE_WORKSPACE_VERSION,
    request: clone(request),
    candidates,
    counts: {
      selectedCandidates: candidates.length,
      responsesImported: candidates.filter((item) => item.state !== 'no_response').length,
      candidatesWithMissingAnswers: candidates.filter((item) => item.counts.missing > 0).length,
      candidatesWithConflicts: candidates.filter((item) => item.counts.conflicts > 0).length,
      verifiedSupplierIdentities: 0,
      verifiedEvidenceItems: 0,
      eligibilityDecisions: 0
    },
    orderingPolicy: 'holder_selection_order_no_ranking',
    rankingGenerated: false,
    formalWritePerformed: false
  };
}
