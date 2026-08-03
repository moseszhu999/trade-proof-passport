export const SUPPLIER_WORKSPACE_VERSION = 'tradeproof.supplier-candidate-workspace.v0.4';
export const SUPPLIER_REVIEW_VERSION = 'tradeproof.supplier-review.v0.4';

function clone(value) {
  return structuredClone(value);
}

function text(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

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

const HOSPITAL_SCOPE_TERMS = [
  'hospital_furniture',
  'hospital_beds',
  'bedside_cabinets',
  'waiting_chairs',
  'medical_trolleys',
  'treatment_tables',
  'nurse_station_desks',
  'medical_cabinets',
  'storage_cabinets',
  'patient_stretchers',
  'other_hospital_furniture'
];

export function validateSupplierCollection(collection) {
  const errors = [];
  if (collection?.schemaVersion !== 'tradeproof.supplier-candidate-collection.v0.4') errors.push('unexpected schemaVersion');
  if (collection?.sourcePolicy?.authorityClass !== 'public_company_self_assertion') errors.push('authorityClass must remain public_company_self_assertion');
  if (collection?.sourcePolicy?.verificationState !== 'unverified') errors.push('verificationState must remain unverified');
  if (collection?.sourcePolicy?.contactDisclosureIncluded !== false) errors.push('contactDisclosureIncluded must remain false');
  if (collection?.sourcePolicy?.rankingGenerated !== false) errors.push('rankingGenerated must remain false');
  if (collection?.sourcePolicy?.eligibilityDecisionGenerated !== false) errors.push('eligibilityDecisionGenerated must remain false');
  if (!Array.isArray(collection?.candidates) || !collection.candidates.length) errors.push('candidate collection is empty');
  for (const candidate of collection?.candidates ?? []) {
    if (!text(candidate.candidateId).startsWith('supplier-candidate:')) errors.push('invalid candidateId');
    if (!text(candidate.website).startsWith('https://')) errors.push(`invalid website for ${candidate.candidateId}`);
    if (candidate.state !== 'observed_unclaimed') errors.push(`candidate must remain observed_unclaimed: ${candidate.candidateId}`);
    if (!(candidate.publicClaims ?? []).length) errors.push(`candidate has no public claims: ${candidate.candidateId}`);
    for (const claim of candidate.publicClaims ?? []) {
      if (claim.evidenceClassification !== 'public_self_asserted') errors.push(`claim classification changed: ${claim.claimId}`);
      if (claim.verified !== false) errors.push(`claim must remain unverified: ${claim.claimId}`);
      if (!text(claim.sourceUrl).startsWith('https://')) errors.push(`invalid claim source: ${claim.claimId}`);
    }
  }
  return unique(errors);
}

export function buildRequirementProfile(caseRecord, collection) {
  const sourceCodes = caseRecord?.sourceOpportunity?.classificationCodes ?? [];
  const title = text(caseRecord?.title);
  const hospitalFurnitureScope = sourceCodes.includes('39100000') || /furniture|meblow/i.test(title) || collection?.targetProductFamily === 'hospital_furniture';
  return {
    profileVersion: 'tradeproof.supplier-requirement-profile.v0.4',
    caseId: caseRecord?.caseId ?? null,
    sourceOpportunityId: caseRecord?.sourceOpportunity?.opportunityId ?? collection?.targetOpportunityId ?? null,
    sourceRecordId: caseRecord?.sourceOpportunity?.recordId ?? collection?.targetOpportunityRecordId ?? null,
    sourceScope: {
      title,
      classificationCodes: sourceCodes,
      targetProductFamily: collection?.targetProductFamily ?? null,
      productTerms: hospitalFurnitureScope ? HOSPITAL_SCOPE_TERMS : [],
      evidenceClassification: 'source_opportunity_scope',
      confirmedRequirement: false
    },
    confirmedRequirements: confirmedRequirements(caseRecord),
    hasConfirmedRequirements: confirmedRequirements(caseRecord).length > 0,
    boundaries: {
      sourceScopeIsEligibilityDecision: false,
      publicClaimIsVerifiedEvidence: false,
      rankingGenerated: false,
      supplierEligibilityDecided: false
    }
  };
}

function productOverlap(candidate, profile) {
  const candidateTerms = new Set(candidate.productFamilies ?? []);
  const matched = profile.sourceScope.productTerms.filter((term) => candidateTerms.has(term));
  const broadHospitalFurniture = candidateTerms.has('hospital_furniture') || candidateTerms.has('other_hospital_furniture');
  return {
    state: matched.length || broadHospitalFurniture ? 'public_scope_overlap' : 'no_public_scope_overlap',
    matchedTerms: matched,
    evidenceClassification: 'public_self_asserted',
    verified: false
  };
}

function claimText(candidate) {
  return (candidate.publicClaims ?? []).map((claim) => `${claim.claimType} ${claim.text}`).join(' ').toLowerCase();
}

function requirementAssessment(candidate, requirement) {
  const claims = claimText(candidate);
  const excerpt = lower(requirement.excerpt);
  let state = 'evidence_gap';
  let reason = '公开网页声明不足以覆盖该项正式要求，需要供应商提供针对性材料。';

  if (requirement.category === 'deadline' || requirement.category === 'communication') {
    state = 'not_supplier_capability_criterion';
    reason = '该项属于时间或沟通动作，不用于判断供应商能力。';
  } else if (requirement.category === 'delivery') {
    if (/delivery|installation|install|交付|安装/.test(claims)) {
      state = 'public_claim_only';
      reason = '官网存在交付或安装相关自述，但尚未证明能够在本项目地点和条件下履约。';
    }
  } else if (requirement.category === 'evidence' || /iso|ce|certificate|certification|证书|认证/.test(excerpt)) {
    if (/iso|ce|certificate|certification/.test(claims)) {
      state = 'public_claim_only';
      reason = '官网存在认证自述；仍需取得证书编号、适用产品、签发机构、有效期和真实性材料。';
    }
  } else if (requirement.category === 'quantity') {
    if (/capacity|daily|square metre|employees|production|产能/.test(claims)) {
      state = 'public_claim_only';
      reason = '官网存在规模或产能自述；仍需针对本项目数量、排产和交期进行确认。';
    }
  } else if (requirement.category === 'technical') {
    if (/hospital|medical|bed|cabinet|trolley|furniture/.test(claims)) {
      state = 'public_claim_only';
      reason = '公开产品范围可能相关，但不能证明满足具体尺寸、材料、标准和验收要求。';
    }
  } else if (requirement.category === 'eligibility') {
    reason = '投标主体、联合体、分包和地域资格不能由产品官网判断。';
  } else if (requirement.category === 'commercial') {
    reason = '价格、保证、付款和商务条件需要正式询价或文件确认。';
  } else if (requirement.category === 'sample_quality') {
    if (/quality|inspection|test/.test(claims)) {
      state = 'public_claim_only';
      reason = '官网存在质量相关自述；仍需样品、测试报告、检验方法和验收结果。';
    }
  }

  return {
    requirementId: requirement.requirementId,
    label: requirement.label,
    category: requirement.category,
    state,
    reason,
    officialRequirement: true,
    supplierEvidenceVerified: false
  };
}

export function evaluateSupplierCandidate(candidate, profile) {
  const scope = productOverlap(candidate, profile);
  const requirementAssessments = profile.confirmedRequirements.map((requirement) => requirementAssessment(candidate, requirement));
  const evidenceGaps = requirementAssessments.filter((item) => item.state === 'evidence_gap');
  const publicClaimOnly = requirementAssessments.filter((item) => item.state === 'public_claim_only');

  let state = 'scope_candidate_only';
  if (scope.state === 'no_public_scope_overlap') state = 'scope_mismatch';
  else if (profile.hasConfirmedRequirements) state = evidenceGaps.length ? 'potential_candidate_with_gaps' : 'public_claim_overlap_requires_verification';

  return {
    evaluationVersion: SUPPLIER_WORKSPACE_VERSION,
    candidateId: candidate.candidateId,
    displayName: candidate.displayName,
    country: candidate.country,
    region: candidate.region,
    website: candidate.website,
    candidateState: candidate.state,
    state,
    scope,
    publicClaims: clone(candidate.publicClaims ?? []),
    requirementAssessments,
    evidenceGaps: evidenceGaps.map((item) => item.label),
    publicClaimOnlyCount: publicClaimOnly.length,
    nextReviewQuestions: unique([
      '请提供与本项目产品范围对应的目录、型号和技术规格。',
      '请提供公司主体、实际生产地址和制造环节说明。',
      '请提供认证原件或可核验编号，并说明适用产品和有效期。',
      '请确认是否能够承担目的地交付、安装、售后或当地合作安排。',
      ...evidenceGaps.map((item) => `请补充：${item.label}`)
    ]),
    boundaries: {
      rank: null,
      numericScore: null,
      verifiedSupplier: false,
      eligibleForTender: 'unknown',
      contactDisclosed: false,
      formalWritePerformed: false
    }
  };
}

export function buildSupplierWorkspaceModel(caseRecord, collection) {
  const collectionErrors = validateSupplierCollection(collection);
  if (collectionErrors.length) throw new Error(collectionErrors.join('; '));
  const profile = buildRequirementProfile(caseRecord, collection);
  const candidates = collection.candidates.map((candidate) => evaluateSupplierCandidate(candidate, profile));
  return {
    schemaVersion: SUPPLIER_WORKSPACE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: collection.generatedAt,
    sourcePolicy: clone(collection.sourcePolicy),
    requirementProfile: profile,
    candidates,
    counts: {
      observedCandidates: candidates.length,
      scopeOverlap: candidates.filter((item) => item.scope.state === 'public_scope_overlap').length,
      confirmedRequirements: profile.confirmedRequirements.length,
      eligibilityDecisions: 0,
      verifiedSuppliers: 0
    },
    orderingPolicy: 'source_observation_order_no_ranking',
    formalWritePerformed: false
  };
}

export function createSupplierReview(caseRecord, collection) {
  return {
    schemaVersion: SUPPLIER_REVIEW_VERSION,
    caseId: caseRecord?.caseId ?? null,
    targetOpportunityId: collection.targetOpportunityId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedCandidateIds: [],
    notes: {},
    state: 'holder_local_draft',
    formalWritePerformed: false,
    externalContactPerformed: false,
    supplierEligibilityDecided: false
  };
}

export function toggleSupplierCandidate(review, candidateId) {
  const next = clone(review);
  const selected = new Set(next.selectedCandidateIds ?? []);
  if (selected.has(candidateId)) selected.delete(candidateId); else selected.add(candidateId);
  next.selectedCandidateIds = [...selected];
  next.updatedAt = new Date().toISOString();
  return next;
}

export function validateSupplierReview(review, collection) {
  const errors = [];
  const allowed = new Set((collection?.candidates ?? []).map((item) => item.candidateId));
  if (review?.schemaVersion !== SUPPLIER_REVIEW_VERSION) errors.push('unexpected review schemaVersion');
  if (review?.state !== 'holder_local_draft') errors.push('review must remain holder_local_draft');
  if (review?.formalWritePerformed !== false) errors.push('formalWritePerformed must remain false');
  if (review?.externalContactPerformed !== false) errors.push('externalContactPerformed must remain false');
  if (review?.supplierEligibilityDecided !== false) errors.push('supplierEligibilityDecided must remain false');
  for (const id of review?.selectedCandidateIds ?? []) if (!allowed.has(id)) errors.push(`unknown candidate: ${id}`);
  return unique(errors);
}
