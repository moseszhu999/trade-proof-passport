import { canonicalizeJson } from './rwp-card.mjs';
import { buildRwpCaseGraph, validateRwpCaseGraph } from './rwp-case-graph.mjs';
import {
  RWP_POOL_EVIDENCE_CATEGORIES,
  RWP_POOL_ROLES,
  validateRwpTradePool
} from './rwp-proof-pool.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_POOL_ADOPTION_RECEIPT_FORMAT = 'real-world-proof-pool-adoption-receipt';
export const RWP_POOL_ADOPTION_CARD_FORMAT = 'real-world-proof-pool-adoption-card';
export const RWP_POOL_ADOPTION_VERSION = '0.1';

export const RWP_POOL_ADOPTION_RECEIPT_ASSURANCE =
  'This unsigned self-declared receipt compares one independently produced RWP Case Graph with one public Trade Pool. It verifies canonical objects and structural rule satisfaction only. It does not authenticate participants, prove legal compliance, transfer reputation, create asset liquidity, authorize financing, or establish absolute real-world truth.';

export const RWP_POOL_ADOPTION_CARD_ASSURANCE =
  'This privacy-bounded public card summarizes one Pool Adoption Receipt. Proof-liquidity eligibility means that the imported independent RWP structurally satisfied the referenced public Pool rules. It is not financial liquidity, identity verification, legal approval, credit scoring, Token entitlement, or proof of absolute truth.';

export const RWP_POOL_ADOPTION_STATUSES = Object.freeze([
  'verified_adoption',
  'partial_adoption',
  'not_adopted'
]);

export const RWP_POOL_ADOPTION_CHECK_STATUSES = Object.freeze([
  'satisfied',
  'not_satisfied',
  'not_observable'
]);

const ROLE_SET = new Set(RWP_POOL_ROLES);
const EVIDENCE_SET = new Set(RWP_POOL_EVIDENCE_CATEGORIES);
const ADOPTION_STATUS_SET = new Set(RWP_POOL_ADOPTION_STATUSES);
const CHECK_STATUS_SET = new Set(RWP_POOL_ADOPTION_CHECK_STATUSES);
const MAX_CARD_PAYLOAD_LENGTH = 9000;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBytes32 = (value) => /^0x[0-9a-f]{64}$/.test(value ?? '');
const isDateTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const forbiddenPrivateMarker = (value) =>
  /party:|evidence:\/\/|"evidenceId"|"fileName"|"displayName"|"goodsDescription"|"computedDigest"|"deliveryEndpoint"|"passportId"|"statement"|"proofValue"|bankAccount|unitPrice/i.test(value);

const toBase64Url = (text) => {
  const bytes = new TextEncoder().encode(text);
  if (typeof btoa === 'function') {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
  }
  return Buffer.from(bytes).toString('base64url');
};

const fromBase64Url = (value) => {
  if (typeof atob === 'function') {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  }
  return Buffer.from(value, 'base64url').toString('utf8');
};

const artifactType = (artifact) => {
  if (isRecord(artifact) && artifact.schemaVersion === '0.1' && typeof artifact.passportId === 'string') return 'passport';
  return artifact?.format ?? 'unknown';
};

const deriveObservedBasis = (artifacts, graph) => {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    return {
      observability: 'graph_only',
      artifactCount: 0,
      observedRoles: [],
      observedEvidenceCategories: []
    };
  }

  const rebuilt = buildRwpCaseGraph(artifacts);
  if (rebuilt.graphDigest !== graph.graphDigest) {
    throw new Error('Imported source artifacts do not reproduce the supplied Case Graph digest.');
  }

  const roles = new Set();
  const evidenceCategories = new Set();
  const addRole = (role) => { if (ROLE_SET.has(role)) roles.add(role); };
  const addCategory = (category) => { if (EVIDENCE_SET.has(category)) evidenceCategories.add(category); };

  for (const artifact of artifacts) {
    const type = artifactType(artifact);
    if (type === 'passport') {
      for (const party of Array.isArray(artifact.parties) ? artifact.parties : []) addRole(party?.role);
    }
    if (type === 'real-world-proof-card') {
      for (const role of artifact.confirmations?.confirmedRoles ?? []) addRole(role);
      for (const role of artifact.confirmations?.respondedRoles ?? []) addRole(role);
    }
    if (type === 'real-world-proof-request') addRole(artifact.requester?.role);
    if (type === 'real-world-proof-request-response') addRole(artifact.responder?.role);
    if (type === 'real-world-proof-evidence-package') {
      for (const item of artifact.evidence ?? []) addRole(item?.issuerRole);
    }
    if (type === 'real-world-proof-evidence-receipt') {
      addRole(artifact.receiver?.role);
      for (const item of artifact.evidenceResults ?? []) if (item?.status === 'matched') addCategory(item.category);
    }
    if (type === 'real-world-proof-evidence-resolution') {
      for (const item of artifact.evidence ?? []) addRole(item?.issuerRole);
    }
    if (type === 'real-world-proof-evidence-resolution-receipt') {
      addRole(artifact.receiver?.role);
      for (const item of artifact.evidenceResults ?? []) if (item?.status === 'matched') addCategory(item.category);
    }
  }

  return {
    observability: 'full_artifact_bundle',
    artifactCount: artifacts.length,
    observedRoles: [...roles].sort(),
    observedEvidenceCategories: [...evidenceCategories].sort()
  };
};

const requiredRelationTriples = (pool) =>
  pool.proofPattern.derivedWorkflow.relations.map((item) => ({
    fromType: item.fromType,
    relation: item.relation,
    toType: item.toType
  }));

const observedRelationKeys = (graph) => {
  const typeById = new Map(graph.nodes.map((node) => [node.id, node.type]));
  return new Set(graph.edges.map((edge) => canonicalizeJson({
    fromType: typeById.get(edge.from),
    relation: edge.relation,
    toType: typeById.get(edge.to)
  })));
};

const evaluateRequiredValues = (values, observed, observable = true) =>
  values.map((value) => ({
    value,
    status: observable ? (observed.has(value) ? 'satisfied' : 'not_satisfied') : 'not_observable'
  }));

const orderedStepSequenceSatisfied = (requiredSteps, graphNodes) => {
  let cursor = 0;
  for (const node of graphNodes) {
    const required = requiredSteps[cursor];
    if (!required) break;
    if (node.type === required.type && node.status === required.observedStatus) cursor += 1;
  }
  return cursor === requiredSteps.length;
};

const countChecks = (checks) => {
  const counts = { total: 0, satisfied: 0, notSatisfied: 0, notObservable: 0 };
  for (const check of checks) {
    counts.total += 1;
    if (check.status === 'satisfied') counts.satisfied += 1;
    if (check.status === 'not_satisfied') counts.notSatisfied += 1;
    if (check.status === 'not_observable') counts.notObservable += 1;
  }
  return counts;
};

const flattenChecks = (evaluation) => [
  ...evaluation.workflow.requiredNodeTypes,
  ...evaluation.workflow.requiredRelations,
  evaluation.workflow.stepSequence,
  evaluation.workflow.branching,
  evaluation.statusGate,
  ...evaluation.roles,
  ...evaluation.evidenceCategories
];

const deriveAdoptionStatus = (evaluation) => {
  const coreChecks = [
    ...evaluation.workflow.requiredNodeTypes,
    ...evaluation.workflow.requiredRelations,
    evaluation.workflow.stepSequence,
    evaluation.workflow.branching,
    evaluation.statusGate
  ];
  if (coreChecks.some((check) => check.status !== 'satisfied')) return 'not_adopted';
  const declaredChecks = [...evaluation.roles, ...evaluation.evidenceCategories];
  if (declaredChecks.some((check) => check.status !== 'satisfied')) return 'partial_adoption';
  return 'verified_adoption';
};

const buildEvaluation = (pool, graph, basis) => {
  const nodeTypes = new Set(graph.nodes.map((node) => node.type));
  const relationKeys = observedRelationKeys(graph);
  const requiredRelations = requiredRelationTriples(pool).map((relation) => ({
    ...relation,
    status: relationKeys.has(canonicalizeJson(relation)) ? 'satisfied' : 'not_satisfied'
  }));
  const requiredNodeTypes = pool.proofPattern.derivedWorkflow.requiredNodeTypes.map((value) => ({
    value,
    status: nodeTypes.has(value) ? 'satisfied' : 'not_satisfied'
  }));
  const stepSequence = {
    status: orderedStepSequenceSatisfied(pool.proofPattern.derivedWorkflow.steps, graph.nodes)
      ? 'satisfied'
      : 'not_satisfied',
    requiredSteps: pool.proofPattern.derivedWorkflow.steps.length,
    observedEvents: graph.nodes.length
  };
  const branchingRequired = pool.proofPattern.derivedWorkflow.branchingObserved;
  const branchingObserved =
    (graph.summary.counts?.request ?? 0) > 1 ||
    (graph.summary.counts?.request_response ?? 0) > 1;
  const branching = {
    status: !branchingRequired || branchingObserved ? 'satisfied' : 'not_satisfied',
    required: branchingRequired,
    observed: branchingObserved
  };
  const statusGate = {
    status: pool.publicRules.statusGates.includes(graph.summary.currentState) ? 'satisfied' : 'not_satisfied',
    currentState: graph.summary.currentState,
    acceptedStates: [...pool.publicRules.statusGates]
  };
  const observable = basis.observability === 'full_artifact_bundle';
  const roles = evaluateRequiredValues(pool.publicRules.roles, new Set(basis.observedRoles), observable);
  const evidenceCategories = evaluateRequiredValues(
    pool.publicRules.evidenceCategories,
    new Set(basis.observedEvidenceCategories),
    observable
  );

  const evaluation = {
    workflow: {
      relationCoverage: pool.proofPattern.derivedWorkflow.relationCoverage,
      requiredNodeTypes,
      requiredRelations,
      stepSequence,
      branching
    },
    statusGate,
    roles,
    evidenceCategories
  };
  const adoptionStatus = deriveAdoptionStatus(evaluation);
  return {
    ...evaluation,
    adoptionStatus,
    proofLiquidityEligible: adoptionStatus === 'verified_adoption',
    checks: countChecks(flattenChecks(evaluation))
  };
};

export const buildRwpPoolAdoptionReceipt = (pool, graph, options = {}) => {
  const poolErrors = validateRwpTradePool(pool);
  if (poolErrors.length > 0) throw new Error(poolErrors.join(' '));
  const graphErrors = validateRwpCaseGraph(graph);
  if (graphErrors.length > 0) throw new Error(graphErrors.join(' '));
  if (graph.source.passportDigest === pool.proofPattern.source.passportDigest) {
    throw new Error('Pool adoption requires an independent RWP root, not the Pool source Passport.');
  }

  const basis = deriveObservedBasis(options.artifacts, graph);
  const evaluation = buildEvaluation(pool, graph, basis);
  const payload = {
    format: RWP_POOL_ADOPTION_RECEIPT_FORMAT,
    version: RWP_POOL_ADOPTION_VERSION,
    domain: 'trade',
    source: {
      poolId: pool.poolId,
      poolDigest: pool.poolDigest,
      patternId: pool.proofPattern.patternId,
      patternDigest: pool.proofPattern.patternDigest,
      graphId: graph.graphId,
      graphDigest: graph.graphDigest,
      passportDigest: graph.source.passportDigest,
      cardDigest: graph.source.cardDigest
    },
    basis,
    evaluation,
    createdAt: new Date(options.createdAt ?? Date.now()).toISOString(),
    assurance: RWP_POOL_ADOPTION_RECEIPT_ASSURANCE
  };
  const receiptDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, receiptId: `rwpadopt:${receiptDigest.slice(2, 18)}`, receiptDigest };
};

const validateSortedEnumList = (list, allowed, field, errors) => {
  if (
    !Array.isArray(list) ||
    list.some((value) => !allowed.has(value)) ||
    new Set(list).size !== list.length ||
    [...list].sort().join('|') !== list.join('|')
  ) errors.push(`${field} must contain unique, sorted, supported values.`);
};

const validateCheckStatus = (value, field, errors) => {
  if (!CHECK_STATUS_SET.has(value)) errors.push(`${field} is invalid.`);
};

export const validateRwpPoolAdoptionReceipt = (value, pool, graph) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Pool Adoption Receipt root must be an object.'];
  const poolErrors = validateRwpTradePool(pool);
  if (poolErrors.length > 0) errors.push(...poolErrors.map((error) => `pool: ${error}`));
  const graphErrors = validateRwpCaseGraph(graph);
  if (graphErrors.length > 0) errors.push(...graphErrors.map((error) => `graph: ${error}`));

  if (value.format !== RWP_POOL_ADOPTION_RECEIPT_FORMAT) errors.push(`format must equal ${RWP_POOL_ADOPTION_RECEIPT_FORMAT}.`);
  if (value.version !== RWP_POOL_ADOPTION_VERSION) errors.push(`version must equal ${RWP_POOL_ADOPTION_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwpadopt:[0-9a-f]{16}$/.test(value.receiptId ?? '')) errors.push('receiptId is invalid.');
  if (!isBytes32(value.receiptDigest)) errors.push('receiptDigest is invalid.');
  if (!isRecord(value.source)) errors.push('source must be an object.');
  for (const field of ['poolDigest', 'patternDigest', 'graphDigest', 'passportDigest', 'cardDigest']) {
    if (!isBytes32(value.source?.[field])) errors.push(`source.${field} is invalid.`);
  }
  if (!/^rwppool:[0-9a-f]{16}$/.test(value.source?.poolId ?? '')) errors.push('source.poolId is invalid.');
  if (!/^rwppat:[0-9a-f]{16}$/.test(value.source?.patternId ?? '')) errors.push('source.patternId is invalid.');
  if (!/^rwpgraph:[0-9a-f]{16}$/.test(value.source?.graphId ?? '')) errors.push('source.graphId is invalid.');

  if (poolErrors.length === 0 && graphErrors.length === 0) {
    const expectedSource = {
      poolId: pool.poolId,
      poolDigest: pool.poolDigest,
      patternId: pool.proofPattern.patternId,
      patternDigest: pool.proofPattern.patternDigest,
      graphId: graph.graphId,
      graphDigest: graph.graphDigest,
      passportDigest: graph.source.passportDigest,
      cardDigest: graph.source.cardDigest
    };
    if (canonicalizeJson(value.source) !== canonicalizeJson(expectedSource)) errors.push('Receipt source does not match the supplied Pool and Case Graph.');
    if (graph.source.passportDigest === pool.proofPattern.source.passportDigest) errors.push('Adoption Graph must use an independent Passport root.');
  }

  if (!isRecord(value.basis) || !['graph_only', 'full_artifact_bundle'].includes(value.basis?.observability)) errors.push('basis.observability is invalid.');
  if (!Number.isInteger(value.basis?.artifactCount) || value.basis.artifactCount < 0) errors.push('basis.artifactCount is invalid.');
  validateSortedEnumList(value.basis?.observedRoles, ROLE_SET, 'basis.observedRoles', errors);
  validateSortedEnumList(value.basis?.observedEvidenceCategories, EVIDENCE_SET, 'basis.observedEvidenceCategories', errors);
  if (value.basis?.observability === 'graph_only' && (value.basis.artifactCount !== 0 || value.basis.observedRoles?.length > 0 || value.basis.observedEvidenceCategories?.length > 0)) errors.push('graph_only basis cannot claim private-artifact observations.');
  if (value.basis?.observability === 'full_artifact_bundle' && value.basis.artifactCount < 2) errors.push('full_artifact_bundle requires at least Passport and Proof Card artifacts.');

  const evaluation = value.evaluation;
  if (!isRecord(evaluation) || !isRecord(evaluation?.workflow)) errors.push('evaluation.workflow is required.');
  const workflow = evaluation?.workflow;
  if (!['explicit_graph', 'sequence_only'].includes(workflow?.relationCoverage)) errors.push('evaluation.workflow.relationCoverage is invalid.');
  for (const [field, sourceValues] of [
    ['requiredNodeTypes', pool?.proofPattern?.derivedWorkflow?.requiredNodeTypes ?? []],
    ['roles', pool?.publicRules?.roles ?? []],
    ['evidenceCategories', pool?.publicRules?.evidenceCategories ?? []]
  ]) {
    const list = field === 'requiredNodeTypes' ? workflow?.requiredNodeTypes : evaluation?.[field];
    if (!Array.isArray(list)) { errors.push(`evaluation.${field} must be an array.`); continue; }
    if (canonicalizeJson(list.map((item) => item?.value)) !== canonicalizeJson(sourceValues)) errors.push(`evaluation.${field} does not match Pool requirements.`);
    for (const item of list) validateCheckStatus(item?.status, `evaluation.${field}.status`, errors);
  }

  if (!Array.isArray(workflow?.requiredRelations)) errors.push('evaluation.workflow.requiredRelations must be an array.');
  else {
    const expectedRelations = requiredRelationTriples(pool);
    const actualRelations = workflow.requiredRelations.map(({ fromType, relation, toType }) => ({ fromType, relation, toType }));
    if (canonicalizeJson(actualRelations) !== canonicalizeJson(expectedRelations)) errors.push('evaluation.workflow.requiredRelations does not match the Pool Pattern.');
    for (const item of workflow.requiredRelations) validateCheckStatus(item?.status, 'evaluation.workflow.requiredRelations.status', errors);
  }

  if (!isRecord(workflow?.stepSequence)) errors.push('evaluation.workflow.stepSequence is required.');
  else {
    validateCheckStatus(workflow.stepSequence.status, 'evaluation.workflow.stepSequence.status', errors);
    if (!Number.isInteger(workflow.stepSequence.requiredSteps) || workflow.stepSequence.requiredSteps < 2) errors.push('stepSequence.requiredSteps is invalid.');
    if (!Number.isInteger(workflow.stepSequence.observedEvents) || workflow.stepSequence.observedEvents < 2) errors.push('stepSequence.observedEvents is invalid.');
  }
  if (!isRecord(workflow?.branching)) errors.push('evaluation.workflow.branching is required.');
  else {
    validateCheckStatus(workflow.branching.status, 'evaluation.workflow.branching.status', errors);
    if (typeof workflow.branching.required !== 'boolean' || typeof workflow.branching.observed !== 'boolean') errors.push('branching flags must be boolean.');
  }
  if (!isRecord(evaluation?.statusGate)) errors.push('evaluation.statusGate is required.');
  else {
    validateCheckStatus(evaluation.statusGate.status, 'evaluation.statusGate.status', errors);
    if (evaluation.statusGate.currentState !== graph?.summary?.currentState) errors.push('statusGate.currentState does not match the Case Graph.');
    if (canonicalizeJson(evaluation.statusGate.acceptedStates) !== canonicalizeJson(pool?.publicRules?.statusGates ?? [])) errors.push('statusGate.acceptedStates does not match the Pool.');
  }
  if (!ADOPTION_STATUS_SET.has(evaluation?.adoptionStatus)) errors.push('evaluation.adoptionStatus is invalid.');
  if (typeof evaluation?.proofLiquidityEligible !== 'boolean') errors.push('evaluation.proofLiquidityEligible must be boolean.');
  if (!isRecord(evaluation?.checks)) errors.push('evaluation.checks is required.');

  if (errors.length === 0) {
    const expectedEvaluation = buildEvaluation(pool, graph, value.basis);
    if (canonicalizeJson(evaluation) !== canonicalizeJson(expectedEvaluation)) errors.push('evaluation does not match the deterministic Pool adoption result.');
  }
  if (!isDateTime(value.createdAt)) errors.push('createdAt is invalid.');
  if (value.assurance !== RWP_POOL_ADOPTION_RECEIPT_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (forbiddenPrivateMarker(canonicalizeJson(value))) errors.push('Pool Adoption Receipt contains a forbidden private-field marker.');

  if (errors.length === 0) {
    const { receiptId, receiptDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (receiptDigest !== expectedDigest) errors.push('receiptDigest does not match the canonical receipt payload.');
    if (receiptId !== `rwpadopt:${expectedDigest.slice(2, 18)}`) errors.push('receiptId does not match receiptDigest.');
  }
  return errors;
};

export const buildRwpPoolAdoptionCard = (receipt, pool, graph) => {
  const errors = validateRwpPoolAdoptionReceipt(receipt, pool, graph);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const payload = {
    format: RWP_POOL_ADOPTION_CARD_FORMAT,
    version: RWP_POOL_ADOPTION_VERSION,
    domain: 'trade',
    source: {
      receiptId: receipt.receiptId,
      receiptDigest: receipt.receiptDigest,
      poolId: pool.poolId,
      poolDigest: pool.poolDigest,
      graphId: graph.graphId,
      graphDigest: graph.graphDigest,
      passportDigest: graph.source.passportDigest
    },
    pool: { label: pool.label, scope: pool.scope, generation: pool.lineage.generation },
    adoptionStatus: receipt.evaluation.adoptionStatus,
    proofLiquidityEligible: receipt.evaluation.proofLiquidityEligible,
    observability: receipt.basis.observability,
    currentState: graph.summary.currentState,
    checks: { ...receipt.evaluation.checks },
    createdAt: receipt.createdAt,
    assurance: RWP_POOL_ADOPTION_CARD_ASSURANCE
  };
  const cardDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, cardId: `rwpadoptcard:${cardDigest.slice(2, 18)}`, cardDigest };
};

export const validateRwpPoolAdoptionCard = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Pool Adoption Card root must be an object.'];
  if (value.format !== RWP_POOL_ADOPTION_CARD_FORMAT) errors.push(`format must equal ${RWP_POOL_ADOPTION_CARD_FORMAT}.`);
  if (value.version !== RWP_POOL_ADOPTION_VERSION) errors.push(`version must equal ${RWP_POOL_ADOPTION_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwpadoptcard:[0-9a-f]{16}$/.test(value.cardId ?? '')) errors.push('cardId is invalid.');
  if (!isBytes32(value.cardDigest)) errors.push('cardDigest is invalid.');
  if (!isRecord(value.source)) errors.push('source must be an object.');
  if (!/^rwpadopt:[0-9a-f]{16}$/.test(value.source?.receiptId ?? '')) errors.push('source.receiptId is invalid.');
  if (!/^rwppool:[0-9a-f]{16}$/.test(value.source?.poolId ?? '')) errors.push('source.poolId is invalid.');
  if (!/^rwpgraph:[0-9a-f]{16}$/.test(value.source?.graphId ?? '')) errors.push('source.graphId is invalid.');
  for (const field of ['receiptDigest', 'poolDigest', 'graphDigest', 'passportDigest']) if (!isBytes32(value.source?.[field])) errors.push(`source.${field} is invalid.`);
  if (!isRecord(value.pool) || typeof value.pool?.label !== 'string' || value.pool.label.length < 1 || value.pool.label.length > 96) errors.push('pool.label is invalid.');
  if (!['trade_corridor', 'industry', 'workflow', 'other'].includes(value.pool?.scope)) errors.push('pool.scope is invalid.');
  if (!Number.isInteger(value.pool?.generation) || value.pool.generation < 0) errors.push('pool.generation is invalid.');
  if (!ADOPTION_STATUS_SET.has(value.adoptionStatus)) errors.push('adoptionStatus is invalid.');
  if (typeof value.proofLiquidityEligible !== 'boolean') errors.push('proofLiquidityEligible must be boolean.');
  if (value.proofLiquidityEligible !== (value.adoptionStatus === 'verified_adoption')) errors.push('proofLiquidityEligible is inconsistent with adoptionStatus.');
  if (!['graph_only', 'full_artifact_bundle'].includes(value.observability)) errors.push('observability is invalid.');
  if (typeof value.currentState !== 'string' || value.currentState.length < 1) errors.push('currentState is required.');
  if (!isRecord(value.checks)) errors.push('checks is required.');
  else {
    for (const field of ['total', 'satisfied', 'notSatisfied', 'notObservable']) {
      if (!Number.isInteger(value.checks[field]) || value.checks[field] < 0) errors.push(`checks.${field} is invalid.`);
    }
    if (value.checks.total !== value.checks.satisfied + value.checks.notSatisfied + value.checks.notObservable) errors.push('checks totals are inconsistent.');
  }
  if (!isDateTime(value.createdAt)) errors.push('createdAt is invalid.');
  if (value.assurance !== RWP_POOL_ADOPTION_CARD_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (forbiddenPrivateMarker(canonicalizeJson(value))) errors.push('Pool Adoption Card contains a forbidden private-field marker.');
  if (errors.length === 0) {
    const { cardId, cardDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (cardDigest !== expectedDigest) errors.push('cardDigest does not match the canonical adoption card payload.');
    if (cardId !== `rwpadoptcard:${expectedDigest.slice(2, 18)}`) errors.push('cardId does not match cardDigest.');
  }
  return errors;
};

export const encodeRwpPoolAdoptionCard = (card) => {
  const errors = validateRwpPoolAdoptionCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(card));
  if (encoded.length > MAX_CARD_PAYLOAD_LENGTH) throw new Error('RWP Pool Adoption Card exceeds the bounded share-link size.');
  return encoded;
};

export const decodeRwpPoolAdoptionCard = (payload) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_CARD_PAYLOAD_LENGTH) throw new Error('RWP Pool Adoption Card payload is missing or too large.');
  const card = JSON.parse(fromBase64Url(payload));
  const errors = validateRwpPoolAdoptionCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return card;
};

export const buildRwpPoolAdoptionCardUrl = (card, baseUrl) => {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/[^/]*$/, 'rwp-adopt.html');
  url.search = '';
  url.hash = new URLSearchParams({ adoption: encodeRwpPoolAdoptionCard(card) }).toString();
  return url.toString();
};

export const readRwpPoolAdoptionCardFromHash = (hash) => {
  const payload = new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get('adoption');
  return payload ? decodeRwpPoolAdoptionCard(payload) : null;
};
