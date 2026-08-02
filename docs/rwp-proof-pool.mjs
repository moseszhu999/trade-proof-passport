import { canonicalizeJson } from './rwp-card.mjs';
import {
  validateRwpCaseGraph,
  validateRwpTimelineCard
} from './rwp-case-graph.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_PROOF_PATTERN_FORMAT = 'real-world-proof-pattern';
export const RWP_TRADE_POOL_FORMAT = 'real-world-proof-trade-pool';
export const RWP_PROOF_PATTERN_VERSION = '0.1';

export const RWP_PROOF_PATTERN_ASSURANCE =
  'This public pattern separates workflow facts deterministically derived from a validated RWP Graph or Timeline from operator-declared role, evidence-category and status-gate requirements. It does not copy source trade data, authenticate an operator, approve a trade, create legal authority, or establish absolute real-world truth.';

export const RWP_TRADE_POOL_ASSURANCE =
  'This open Trade Pool publishes reusable Real-World Proof rules. Forking copies public rules only. It never copies the source Passport, evidence records, participant data, file digests or confidential trade content, and it does not make a new adopter compliant, approved or truthful.';

export const RWP_POOL_ROLES = Object.freeze([
  'exporter', 'buyer', 'supplier', 'manufacturer', 'inspection', 'logistics',
  'warehouse', 'customs', 'insurance', 'legal', 'funder', 'other'
]);

export const RWP_POOL_EVIDENCE_CATEGORIES = Object.freeze([
  'bill_of_lading', 'commercial_invoice', 'customs_record', 'inspection_report',
  'insurance_record', 'logistics_event', 'packing_list', 'purchase_order',
  'warehouse_receipt', 'other'
]);

export const RWP_POOL_STATUS_GATES = Object.freeze([
  'proof_available', 'awaiting_response', 'awaiting_evidence_package',
  'awaiting_evidence_receipt', 'evidence_received', 'awaiting_resolution_receipt',
  'action_required', 'resolved', 'declined'
]);

export const RWP_POOL_SCOPES = Object.freeze([
  'trade_corridor', 'industry', 'workflow', 'other'
]);

const ROLE_SET = new Set(RWP_POOL_ROLES);
const EVIDENCE_SET = new Set(RWP_POOL_EVIDENCE_CATEGORIES);
const STATUS_GATE_SET = new Set(RWP_POOL_STATUS_GATES);
const SCOPE_SET = new Set(RWP_POOL_SCOPES);
const MAX_POOL_PAYLOAD_LENGTH = 20000;
const MAX_LABEL_LENGTH = 96;
const MAX_SUMMARY_LENGTH = 280;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBytes32 = (value) => /^0x[0-9a-f]{64}$/.test(value ?? '');
const isDateTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const forbiddenPrivateMarker = (value) =>
  /party:|evidence:\/\/|"evidenceId"|"fileName"|"displayName"|"goodsDescription"|"computedDigest"|"deliveryEndpoint"|"passportId"|"statement"|"proofValue"/i.test(value);

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

const normalizeLabel = (value, fallback) => {
  const label = String(value ?? fallback ?? '').trim();
  if (label.length < 1 || label.length > MAX_LABEL_LENGTH) {
    throw new Error(`Public label must contain 1 to ${MAX_LABEL_LENGTH} characters.`);
  }
  return label;
};

const normalizeSummary = (value) => {
  const summary = String(value ?? '').trim();
  if (summary.length > MAX_SUMMARY_LENGTH) throw new Error(`Public summary must be at most ${MAX_SUMMARY_LENGTH} characters.`);
  if (forbiddenPrivateMarker(summary)) throw new Error('Public summary contains a forbidden private-field marker.');
  return summary;
};

const normalizeEnumList = (values, allowed, field, { required = false } = {}) => {
  const normalized = [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))].sort();
  for (const value of normalized) if (!allowed.has(value)) throw new Error(`${field} contains unsupported value: ${value}`);
  if (required && normalized.length === 0) throw new Error(`${field} must contain at least one value.`);
  return normalized;
};

const sourceDescriptor = (source) => {
  if (source?.format === 'real-world-proof-case-graph') {
    const errors = validateRwpCaseGraph(source);
    if (errors.length > 0) throw new Error(errors.join(' '));
    return {
      sourceType: 'case_graph',
      artifactId: source.graphId,
      artifactDigest: source.graphDigest,
      passportDigest: source.source.passportDigest,
      cardDigest: source.source.cardDigest,
      derivedAt: source.projectedAt,
      terminalState: source.summary.currentState,
      events: source.nodes.map((node) => ({ type: node.type, status: node.status, at: node.at })),
      relations: (() => {
        const types = new Map(source.nodes.map((node) => [node.id, node.type]));
        const unique = new Map();
        for (const edge of source.edges) {
          const relation = {
            fromType: types.get(edge.from),
            toType: types.get(edge.to),
            relation: edge.relation
          };
          unique.set(canonicalizeJson(relation), relation);
        }
        return [...unique.values()].sort((left, right) => canonicalizeJson(left).localeCompare(canonicalizeJson(right)));
      })(),
      relationCoverage: 'explicit_graph',
      branchingObserved: (source.summary.counts?.request ?? 0) > 1 || (source.summary.counts?.request_response ?? 0) > 1
    };
  }

  if (source?.format === 'real-world-proof-timeline-card') {
    const errors = validateRwpTimelineCard(source);
    if (errors.length > 0) throw new Error(errors.join(' '));
    return {
      sourceType: 'timeline_card',
      artifactId: source.timelineId,
      artifactDigest: source.timelineDigest,
      passportDigest: source.source.passportDigest,
      cardDigest: source.source.cardDigest,
      derivedAt: source.lastEventAt,
      terminalState: source.currentState,
      events: source.events.map((event) => ({ type: event.type, status: event.status, at: event.at })),
      relations: [],
      relationCoverage: 'sequence_only',
      branchingObserved: (source.counts?.requests ?? 0) > 1 || (source.counts?.responses ?? 0) > 1
    };
  }

  throw new Error('A validated RWP Case Graph or Timeline Card is required.');
};

const buildPatternPayload = (source, options = {}) => {
  const derived = sourceDescriptor(source);
  const roles = normalizeEnumList(options.roles, ROLE_SET, 'declaredRequirements.roles');
  const evidenceCategories = normalizeEnumList(options.evidenceCategories, EVIDENCE_SET, 'declaredRequirements.evidenceCategories');
  const statusGates = normalizeEnumList(
    options.statusGates ?? [derived.terminalState],
    STATUS_GATE_SET,
    'declaredRequirements.statusGates',
    { required: true }
  );
  const steps = derived.events.map((event, index) => ({
    order: index + 1,
    type: event.type,
    observedStatus: event.status
  }));
  const requiredNodeTypes = [...new Set(steps.map((step) => step.type))].sort();
  return {
    format: RWP_PROOF_PATTERN_FORMAT,
    version: RWP_PROOF_PATTERN_VERSION,
    domain: 'trade',
    source: {
      artifactType: derived.sourceType,
      artifactId: derived.artifactId,
      artifactDigest: derived.artifactDigest,
      passportDigest: derived.passportDigest,
      cardDigest: derived.cardDigest
    },
    derivedWorkflow: {
      steps,
      requiredNodeTypes,
      relations: derived.relations,
      relationCoverage: derived.relationCoverage,
      terminalStateObserved: derived.terminalState,
      branchingObserved: derived.branchingObserved
    },
    declaredRequirements: {
      provenance: 'operator_declared',
      roles,
      evidenceCategories,
      statusGates
    },
    derivedAt: new Date(derived.derivedAt).toISOString(),
    assurance: RWP_PROOF_PATTERN_ASSURANCE
  };
};

export const buildRwpProofPattern = (source, options = {}) => {
  const payload = buildPatternPayload(source, options);
  const patternDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, patternId: `rwppat:${patternDigest.slice(2, 18)}`, patternDigest };
};

export const validateRwpProofPattern = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Proof Pattern root must be an object.'];
  if (value.format !== RWP_PROOF_PATTERN_FORMAT) errors.push(`format must equal ${RWP_PROOF_PATTERN_FORMAT}.`);
  if (value.version !== RWP_PROOF_PATTERN_VERSION) errors.push(`version must equal ${RWP_PROOF_PATTERN_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwppat:[0-9a-f]{16}$/.test(value.patternId ?? '')) errors.push('patternId is invalid.');
  if (!isBytes32(value.patternDigest)) errors.push('patternDigest is invalid.');
  if (!isRecord(value.source) || !['case_graph', 'timeline_card'].includes(value.source?.artifactType)) errors.push('source.artifactType is invalid.');
  if (typeof value.source?.artifactId !== 'string' || value.source.artifactId.length < 1) errors.push('source.artifactId is required.');
  for (const field of ['artifactDigest', 'passportDigest', 'cardDigest']) if (!isBytes32(value.source?.[field])) errors.push(`source.${field} is invalid.`);
  const workflow = value.derivedWorkflow;
  if (!isRecord(workflow)) errors.push('derivedWorkflow must be an object.');
  if (!Array.isArray(workflow?.steps) || workflow.steps.length < 2) errors.push('derivedWorkflow.steps must contain at least two events.');
  for (const [index, step] of (Array.isArray(workflow?.steps) ? workflow.steps : []).entries()) {
    if (!isRecord(step) || step.order !== index + 1) errors.push('derivedWorkflow.steps must use contiguous 1-based order.');
    if (typeof step?.type !== 'string' || step.type.length < 1) errors.push('derivedWorkflow.steps.type is required.');
    if (typeof step?.observedStatus !== 'string' || step.observedStatus.length < 1 || step.observedStatus.length > 64) errors.push('derivedWorkflow.steps.observedStatus is invalid.');
  }
  if (!Array.isArray(workflow?.requiredNodeTypes) || new Set(workflow.requiredNodeTypes).size !== workflow.requiredNodeTypes.length || [...workflow.requiredNodeTypes].sort().join('|') !== workflow.requiredNodeTypes.join('|')) errors.push('derivedWorkflow.requiredNodeTypes must be unique and sorted.');
  if (!Array.isArray(workflow?.relations)) errors.push('derivedWorkflow.relations must be an array.');
  if (!['explicit_graph', 'sequence_only'].includes(workflow?.relationCoverage)) errors.push('derivedWorkflow.relationCoverage is invalid.');
  if (typeof workflow?.terminalStateObserved !== 'string' || workflow.terminalStateObserved.length < 1) errors.push('derivedWorkflow.terminalStateObserved is required.');
  if (typeof workflow?.branchingObserved !== 'boolean') errors.push('derivedWorkflow.branchingObserved must be boolean.');
  const requirements = value.declaredRequirements;
  if (!isRecord(requirements) || requirements?.provenance !== 'operator_declared') errors.push('declaredRequirements provenance boundary is missing.');
  for (const [field, allowed] of [['roles', ROLE_SET], ['evidenceCategories', EVIDENCE_SET], ['statusGates', STATUS_GATE_SET]]) {
    const list = requirements?.[field];
    if (!Array.isArray(list) || list.some((entry) => !allowed.has(entry)) || new Set(list).size !== list.length || [...list].sort().join('|') !== list.join('|')) errors.push(`declaredRequirements.${field} must contain unique, sorted, supported values.`);
  }
  if (requirements?.statusGates?.length < 1) errors.push('declaredRequirements.statusGates must contain at least one gate.');
  if (!isDateTime(value.derivedAt)) errors.push('derivedAt is invalid.');
  if (value.assurance !== RWP_PROOF_PATTERN_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (forbiddenPrivateMarker(canonicalizeJson(value))) errors.push('RWP Proof Pattern contains a forbidden private-field marker.');
  if (errors.length === 0) {
    const { patternId, patternDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (patternDigest !== expectedDigest) errors.push('patternDigest does not match the canonical pattern payload.');
    if (patternId !== `rwppat:${expectedDigest.slice(2, 18)}`) errors.push('patternId does not match patternDigest.');
  }
  return errors;
};

const buildPoolPayload = (pattern, options = {}) => {
  const patternErrors = validateRwpProofPattern(pattern);
  if (patternErrors.length > 0) throw new Error(patternErrors.join(' '));
  const scope = String(options.scope ?? 'workflow');
  if (!SCOPE_SET.has(scope)) throw new Error(`Unsupported Trade Pool scope: ${scope}`);
  const roles = normalizeEnumList(options.roles ?? pattern.declaredRequirements.roles, ROLE_SET, 'publicRules.roles');
  const evidenceCategories = normalizeEnumList(options.evidenceCategories ?? pattern.declaredRequirements.evidenceCategories, EVIDENCE_SET, 'publicRules.evidenceCategories');
  const statusGates = normalizeEnumList(options.statusGates ?? pattern.declaredRequirements.statusGates, STATUS_GATE_SET, 'publicRules.statusGates', { required: true });
  const generation = Number(options.generation ?? 0);
  if (!Number.isInteger(generation) || generation < 0) throw new Error('lineage.generation must be a non-negative integer.');
  const forkedFromPoolDigest = options.forkedFromPoolDigest;
  if (forkedFromPoolDigest !== undefined && !isBytes32(forkedFromPoolDigest)) throw new Error('lineage.forkedFromPoolDigest is invalid.');
  return {
    format: RWP_TRADE_POOL_FORMAT,
    version: RWP_PROOF_PATTERN_VERSION,
    domain: 'trade',
    label: normalizeLabel(options.label, 'Open Trade Proof Pool'),
    scope,
    ...(normalizeSummary(options.summary) ? { summary: normalizeSummary(options.summary) } : {}),
    proofPattern: pattern,
    publicRules: {
      provenance: 'pool_operator_declared',
      roles,
      evidenceCategories,
      statusGates,
      reuseMode: 'independent_rwp_only'
    },
    lineage: {
      generation,
      ...(forkedFromPoolDigest ? { forkedFromPoolDigest } : {})
    },
    createdAt: new Date(options.createdAt ?? Date.now()).toISOString(),
    assurance: RWP_TRADE_POOL_ASSURANCE
  };
};

export const buildRwpTradePool = (pattern, options = {}) => {
  const payload = buildPoolPayload(pattern, options);
  const poolDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, poolId: `rwppool:${poolDigest.slice(2, 18)}`, poolDigest };
};

export const forkRwpTradePool = (pool, options = {}) => {
  const errors = validateRwpTradePool(pool);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return buildRwpTradePool(pool.proofPattern, {
    label: options.label ?? `${pool.label} fork`,
    scope: options.scope ?? pool.scope,
    summary: options.summary ?? pool.summary,
    roles: options.roles ?? pool.publicRules.roles,
    evidenceCategories: options.evidenceCategories ?? pool.publicRules.evidenceCategories,
    statusGates: options.statusGates ?? pool.publicRules.statusGates,
    generation: pool.lineage.generation + 1,
    forkedFromPoolDigest: pool.poolDigest,
    createdAt: options.createdAt
  });
};

export const validateRwpTradePool = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Trade Pool root must be an object.'];
  if (value.format !== RWP_TRADE_POOL_FORMAT) errors.push(`format must equal ${RWP_TRADE_POOL_FORMAT}.`);
  if (value.version !== RWP_PROOF_PATTERN_VERSION) errors.push(`version must equal ${RWP_PROOF_PATTERN_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwppool:[0-9a-f]{16}$/.test(value.poolId ?? '')) errors.push('poolId is invalid.');
  if (!isBytes32(value.poolDigest)) errors.push('poolDigest is invalid.');
  if (typeof value.label !== 'string' || value.label.length < 1 || value.label.length > MAX_LABEL_LENGTH) errors.push('label is invalid.');
  if (!SCOPE_SET.has(value.scope)) errors.push('scope is unsupported.');
  if (value.summary !== undefined && (typeof value.summary !== 'string' || value.summary.length < 1 || value.summary.length > MAX_SUMMARY_LENGTH)) errors.push('summary is invalid.');
  const patternErrors = validateRwpProofPattern(value.proofPattern);
  if (patternErrors.length > 0) errors.push(...patternErrors.map((error) => `proofPattern: ${error}`));
  const rules = value.publicRules;
  if (!isRecord(rules) || rules?.provenance !== 'pool_operator_declared' || rules?.reuseMode !== 'independent_rwp_only') errors.push('publicRules provenance or reuse boundary is invalid.');
  for (const [field, allowed] of [['roles', ROLE_SET], ['evidenceCategories', EVIDENCE_SET], ['statusGates', STATUS_GATE_SET]]) {
    const list = rules?.[field];
    if (!Array.isArray(list) || list.some((entry) => !allowed.has(entry)) || new Set(list).size !== list.length || [...list].sort().join('|') !== list.join('|')) errors.push(`publicRules.${field} must contain unique, sorted, supported values.`);
  }
  if (rules?.statusGates?.length < 1) errors.push('publicRules.statusGates must contain at least one gate.');
  if (!isRecord(value.lineage) || !Number.isInteger(value.lineage?.generation) || value.lineage.generation < 0) errors.push('lineage.generation is invalid.');
  if (value.lineage?.forkedFromPoolDigest !== undefined && !isBytes32(value.lineage.forkedFromPoolDigest)) errors.push('lineage.forkedFromPoolDigest is invalid.');
  if (value.lineage?.generation === 0 && value.lineage?.forkedFromPoolDigest !== undefined) errors.push('generation zero cannot declare a parent Pool.');
  if (value.lineage?.generation > 0 && !isBytes32(value.lineage?.forkedFromPoolDigest)) errors.push('forked Pools require lineage.forkedFromPoolDigest.');
  if (!isDateTime(value.createdAt)) errors.push('createdAt is invalid.');
  if (value.assurance !== RWP_TRADE_POOL_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (forbiddenPrivateMarker(canonicalizeJson(value))) errors.push('RWP Trade Pool contains a forbidden private-field marker.');
  if (errors.length === 0) {
    const { poolId, poolDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (poolDigest !== expectedDigest) errors.push('poolDigest does not match the canonical Pool payload.');
    if (poolId !== `rwppool:${expectedDigest.slice(2, 18)}`) errors.push('poolId does not match poolDigest.');
  }
  return errors;
};

export const encodeRwpTradePool = (pool) => {
  const errors = validateRwpTradePool(pool);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(pool));
  if (encoded.length > MAX_POOL_PAYLOAD_LENGTH) throw new Error('RWP Trade Pool exceeds the bounded share-link size.');
  return encoded;
};

export const decodeRwpTradePool = (payload) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_POOL_PAYLOAD_LENGTH) throw new Error('RWP Trade Pool payload is missing or too large.');
  const pool = JSON.parse(fromBase64Url(payload));
  const errors = validateRwpTradePool(pool);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return pool;
};

export const buildRwpTradePoolUrl = (pool, baseUrl) => {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/[^/]*$/, 'rwp-pool.html');
  url.search = '';
  url.hash = new URLSearchParams({ pool: encodeRwpTradePool(pool) }).toString();
  return url.toString();
};

export const readRwpTradePoolFromHash = (hash) => {
  const payload = new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get('pool');
  return payload ? decodeRwpTradePool(payload) : null;
};
