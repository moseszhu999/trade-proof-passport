import { canonicalizeJson, computePassportDigest, validateProofCard } from './rwp-card.mjs';
import { validateRwpRequest } from './rwp-request.mjs';
import { validateRwpRequestResponse } from './rwp-request-response.mjs';
import { validateRwpEvidencePackage } from './rwp-evidence-package.mjs';
import { validateRwpEvidenceReceipt } from './rwp-evidence-receipt.mjs';
import {
  validateRwpEvidenceResolution,
  validateRwpEvidenceResolutionReceipt
} from './rwp-evidence-resolution.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_CASE_GRAPH_FORMAT = 'real-world-proof-case-graph';
export const RWP_CASE_GRAPH_VERSION = '0.1';
export const RWP_TIMELINE_CARD_FORMAT = 'real-world-proof-timeline-card';
export const RWP_CASE_GRAPH_ASSURANCE =
  'This deterministic local graph links validated RWP artifacts by canonical digests and source references. It does not authenticate participants, prove legal effect, disclose source files, or establish absolute real-world truth.';
export const RWP_TIMELINE_CARD_ASSURANCE =
  'This privacy-bounded timeline card exposes artifact types, timestamps, states, aggregate counts and canonical digests only. It contains no participant names, evidence identifiers, file names, source-document bytes, evidence digests, delivery endpoints, or confidential trade content.';

const MAX_TIMELINE_PAYLOAD_LENGTH = 12000;
const NODE_TYPES = Object.freeze([
  'passport',
  'proof_card',
  'request',
  'request_response',
  'evidence_package',
  'evidence_receipt',
  'evidence_resolution',
  'evidence_resolution_receipt'
]);
const NODE_TYPE_SET = new Set(NODE_TYPES);
const EDGE_RELATIONS = Object.freeze([
  'projects_to',
  'requests_from',
  'responds_to',
  'packages_for',
  'receives',
  'resolves_package',
  'resolves_receipt',
  'verifies_resolution'
]);
const EDGE_RELATION_SET = new Set(EDGE_RELATIONS);
const TYPE_ORDER = new Map(NODE_TYPES.map((type, index) => [type, index]));
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBytes32 = (value) => /^0x[0-9a-f]{64}$/.test(value ?? '');
const isDateTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const safeInteger = (value) => Number.isInteger(value) && value >= 0;

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
  const format = artifact?.format;
  if (format === 'real-world-proof-card') return 'proof_card';
  if (format === 'real-world-proof-request') return 'request';
  if (format === 'real-world-proof-request-response') return 'request_response';
  if (format === 'real-world-proof-evidence-package') return 'evidence_package';
  if (format === 'real-world-proof-evidence-receipt') return 'evidence_receipt';
  if (format === 'real-world-proof-evidence-resolution') return 'evidence_resolution';
  if (format === 'real-world-proof-evidence-resolution-receipt') return 'evidence_resolution_receipt';
  throw new Error('Unsupported RWP graph artifact.');
};

const nodeKey = (type, artifact, passportDigest) => {
  if (type === 'passport') return `passport:${passportDigest.slice(2, 18)}`;
  if (type === 'proof_card') return `card:${artifact.cardDigest.slice(2, 18)}`;
  if (type === 'request') return artifact.requestId;
  if (type === 'request_response') return artifact.responseId;
  if (type === 'evidence_package') return artifact.packageId;
  if (type === 'evidence_receipt') return artifact.receiptId;
  if (type === 'evidence_resolution') return artifact.resolutionId;
  return artifact.receiptId;
};

const nodeDigest = (type, artifact, passportDigest) => {
  if (type === 'passport') return passportDigest;
  if (type === 'proof_card') return artifact.cardDigest;
  if (type === 'request') return artifact.requestDigest;
  if (type === 'request_response') return artifact.responseDigest;
  if (type === 'evidence_package') return artifact.packageDigest;
  if (type === 'evidence_receipt') return artifact.receiptDigest;
  if (type === 'evidence_resolution') return artifact.resolutionDigest;
  return artifact.receiptDigest;
};

const nodeAt = (type, artifact) => {
  if (type === 'passport' || type === 'proof_card') return new Date(artifact.updatedAt).toISOString();
  return new Date(artifact.createdAt).toISOString();
};

const nodeStatus = (type, artifact) => {
  if (type === 'passport') return artifact.lifecycle.status;
  if (type === 'proof_card') return artifact.lifecycleStatus;
  if (type === 'request') return artifact.requestedAction;
  if (type === 'request_response') return artifact.decision.status;
  if (type === 'evidence_package') return artifact.coverage.complete ? 'complete' : 'partial';
  if (type === 'evidence_receipt') return artifact.outcome.status;
  if (type === 'evidence_resolution') return artifact.resolution.complete ? 'complete' : 'partial';
  return artifact.outcome.status;
};

const nodeMetrics = (type, artifact) => {
  if (type === 'passport') return {
    claims: artifact.facts.length,
    evidence: artifact.evidence.length,
    confirmations: artifact.confirmations.length,
    provenance: Array.isArray(artifact.provenance) ? artifact.provenance.length : 0
  };
  if (type === 'proof_card') return {
    claims: artifact.claims.total,
    evidence: artifact.evidence.total,
    confirmations: artifact.confirmations.total,
    provenance: artifact.provenance.total
  };
  if (type === 'request') return { requestedEvidenceCategories: artifact.evidenceTypes.length };
  if (type === 'request_response') return { offeredEvidenceCategories: artifact.fulfillment.evidenceTypes.length };
  if (type === 'evidence_package') return {
    records: artifact.evidence.length,
    allowedCategories: artifact.coverage.allowedCategories.length,
    missingCategories: artifact.coverage.missingCategories.length
  };
  if (type === 'evidence_receipt') return { ...artifact.outcome.counts };
  if (type === 'evidence_resolution') return {
    records: artifact.evidence.length,
    issues: artifact.resolution.issueCount,
    unresolvedIssues: artifact.resolution.unresolvedIssueKeys.length
  };
  return { ...artifact.outcome.counts };
};

const validateArtifact = (type, artifact, context) => {
  let errors = [];
  if (type === 'passport') {
    computePassportDigest(artifact);
    return;
  }
  if (type === 'proof_card') errors = validateProofCard(artifact);
  if (type === 'request') errors = validateRwpRequest(artifact);
  if (type === 'request_response') {
    const request = context.requests.get(artifact.source?.requestId);
    if (!request) throw new Error(`Missing source Request for ${artifact.responseId}.`);
    errors = validateRwpRequestResponse(artifact, request);
  }
  if (type === 'evidence_package') errors = validateRwpEvidencePackage(artifact);
  if (type === 'evidence_receipt') {
    const pkg = context.packages.get(artifact.source?.packageId);
    if (!pkg) throw new Error(`Missing source Evidence Package for ${artifact.receiptId}.`);
    errors = validateRwpEvidenceReceipt(artifact, pkg);
  }
  if (type === 'evidence_resolution') errors = validateRwpEvidenceResolution(artifact);
  if (type === 'evidence_resolution_receipt') {
    const resolution = context.resolutions.get(artifact.source?.resolutionId);
    if (!resolution) throw new Error(`Missing source Evidence Resolution for ${artifact.receiptId}.`);
    errors = validateRwpEvidenceResolutionReceipt(artifact, resolution);
  }
  if (errors.length > 0) throw new Error(errors.join(' '));
};

const normalizeArtifacts = (input) => {
  const artifacts = Array.isArray(input) ? input : input?.artifacts;
  if (!Array.isArray(artifacts) || artifacts.length < 2) {
    throw new Error('RWP Case Graph requires an array containing at least a Passport and Proof Card.');
  }
  return artifacts;
};

const buildIndexes = (typed) => {
  const index = {
    requests: new Map(),
    responses: new Map(),
    packages: new Map(),
    receipts: new Map(),
    resolutions: new Map(),
    resolutionReceipts: new Map()
  };
  for (const { type, artifact } of typed) {
    if (type === 'request') index.requests.set(artifact.requestId, artifact);
    if (type === 'request_response') index.responses.set(artifact.responseId, artifact);
    if (type === 'evidence_package') index.packages.set(artifact.packageId, artifact);
    if (type === 'evidence_receipt') index.receipts.set(artifact.receiptId, artifact);
    if (type === 'evidence_resolution') index.resolutions.set(artifact.resolutionId, artifact);
    if (type === 'evidence_resolution_receipt') index.resolutionReceipts.set(artifact.receiptId, artifact);
  }
  return index;
};

const sourcePassportDigest = (type, artifact, passportDigest) => {
  if (type === 'passport') return passportDigest;
  if (type === 'proof_card') return artifact.sourceDigest;
  return artifact.source?.passportDigest;
};

const pushEdge = (edges, from, to, relation, nodesById) => {
  if (!from || !to) throw new Error(`Cannot create ${relation} edge with a missing endpoint.`);
  if (!nodesById.has(from) || !nodesById.has(to)) throw new Error(`Graph edge ${relation} references a missing node.`);
  const parent = nodesById.get(from);
  const child = nodesById.get(to);
  if (Date.parse(child.at) < Date.parse(parent.at)) {
    throw new Error(`Graph chronology violation: ${child.type} predates ${parent.type}.`);
  }
  edges.push({ from, to, relation });
};

const deriveCurrentState = (nodes) => {
  const latest = nodes[nodes.length - 1];
  if (!latest) return 'proof_available';
  if (latest.type === 'evidence_resolution_receipt') {
    if (latest.status === 'resolved') return 'resolved';
    return 'action_required';
  }
  if (latest.type === 'evidence_receipt') {
    if (latest.status === 'received') return 'evidence_received';
    return 'action_required';
  }
  if (latest.type === 'evidence_resolution') return 'awaiting_resolution_receipt';
  if (latest.type === 'evidence_package') return 'awaiting_evidence_receipt';
  if (latest.type === 'request_response') {
    if (latest.status === 'decline') return 'declined';
    if (latest.status === 'request_clarification') return 'action_required';
    return 'awaiting_evidence_package';
  }
  if (latest.type === 'request') return 'awaiting_response';
  return 'proof_available';
};

const summarizeGraph = (nodes, edges) => {
  const counts = Object.fromEntries(NODE_TYPES.map((type) => [type, 0]));
  const statusCounts = { resolved: 0, mismatch: 0, incomplete: 0, requestMore: 0, disputed: 0 };
  for (const node of nodes) {
    counts[node.type] += 1;
    if (node.status === 'resolved') statusCounts.resolved += 1;
    if (node.status === 'mismatch') statusCounts.mismatch += 1;
    if (node.status === 'incomplete') statusCounts.incomplete += 1;
    if (node.status === 'request_more') statusCounts.requestMore += 1;
    if (node.status === 'disputed') statusCounts.disputed += 1;
  }
  return {
    eventCount: nodes.length,
    edgeCount: edges.length,
    counts,
    statusCounts,
    currentState: deriveCurrentState(nodes),
    firstEventAt: nodes[0].at,
    lastEventAt: nodes[nodes.length - 1].at
  };
};

export const buildRwpCaseGraph = (input) => {
  const artifacts = normalizeArtifacts(input);
  const typed = artifacts.map((artifact) => ({ type: artifactType(artifact), artifact }));
  const passports = typed.filter((item) => item.type === 'passport');
  const cards = typed.filter((item) => item.type === 'proof_card');
  if (passports.length !== 1) throw new Error('RWP Case Graph requires exactly one Passport root.');
  if (cards.length !== 1) throw new Error('RWP Case Graph requires exactly one Proof Card projection.');

  const passport = passports[0].artifact;
  const card = cards[0].artifact;
  const passportDigest = computePassportDigest(passport);
  const cardErrors = validateProofCard(card);
  if (cardErrors.length > 0) throw new Error(cardErrors.join(' '));
  if (card.sourceDigest !== passportDigest) throw new Error('Proof Card sourceDigest does not match the Passport root.');

  const indexes = buildIndexes(typed);
  const seenNodeIds = new Set();
  const seenDigests = new Set();
  const nodes = [];
  for (const item of typed) {
    validateArtifact(item.type, item.artifact, indexes);
    const rootDigest = sourcePassportDigest(item.type, item.artifact, passportDigest);
    if (rootDigest !== passportDigest) throw new Error(`${item.type} belongs to a different Passport root.`);
    const id = nodeKey(item.type, item.artifact, passportDigest);
    const digest = nodeDigest(item.type, item.artifact, passportDigest);
    if (!isBytes32(digest)) throw new Error(`${item.type} digest is invalid.`);
    if (seenNodeIds.has(id)) throw new Error(`Duplicate graph node id: ${id}`);
    if (seenDigests.has(digest)) throw new Error(`Duplicate graph digest: ${digest}`);
    seenNodeIds.add(id);
    seenDigests.add(digest);
    nodes.push({
      id,
      type: item.type,
      digest,
      at: nodeAt(item.type, item.artifact),
      status: nodeStatus(item.type, item.artifact),
      metrics: nodeMetrics(item.type, item.artifact)
    });
  }
  nodes.sort((left, right) => Date.parse(left.at) - Date.parse(right.at) || TYPE_ORDER.get(left.type) - TYPE_ORDER.get(right.type) || left.digest.localeCompare(right.digest));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const idByDigest = new Map(nodes.map((node) => [node.digest, node.id]));
  const edges = [];

  pushEdge(edges, idByDigest.get(passportDigest), idByDigest.get(card.cardDigest), 'projects_to', nodesById);
  for (const request of indexes.requests.values()) {
    if (request.source.cardDigest !== card.cardDigest) throw new Error(`Request ${request.requestId} does not reference the graph Proof Card.`);
    pushEdge(edges, idByDigest.get(card.cardDigest), request.requestId, 'requests_from', nodesById);
  }
  for (const response of indexes.responses.values()) {
    pushEdge(edges, response.source.requestId, response.responseId, 'responds_to', nodesById);
  }
  for (const pkg of indexes.packages.values()) {
    const response = indexes.responses.get(pkg.source.responseId);
    if (!response) throw new Error(`Missing source Response for ${pkg.packageId}.`);
    if (pkg.source.requestId !== response.source.requestId || pkg.source.responseDigest !== response.responseDigest) {
      throw new Error(`Evidence Package ${pkg.packageId} source chain is inconsistent.`);
    }
    pushEdge(edges, pkg.source.responseId, pkg.packageId, 'packages_for', nodesById);
  }
  for (const receipt of indexes.receipts.values()) {
    pushEdge(edges, receipt.source.packageId, receipt.receiptId, 'receives', nodesById);
  }
  for (const resolution of indexes.resolutions.values()) {
    const pkg = indexes.packages.get(resolution.source.packageId);
    const receipt = indexes.receipts.get(resolution.source.receiptId);
    if (!pkg || !receipt) throw new Error(`Resolution ${resolution.resolutionId} has a missing prior Package or Receipt.`);
    if (resolution.source.packageDigest !== pkg.packageDigest || resolution.source.receiptDigest !== receipt.receiptDigest) {
      throw new Error(`Resolution ${resolution.resolutionId} source chain is inconsistent.`);
    }
    pushEdge(edges, resolution.source.packageId, resolution.resolutionId, 'resolves_package', nodesById);
    pushEdge(edges, resolution.source.receiptId, resolution.resolutionId, 'resolves_receipt', nodesById);
  }
  for (const receipt of indexes.resolutionReceipts.values()) {
    pushEdge(edges, receipt.source.resolutionId, receipt.receiptId, 'verifies_resolution', nodesById);
  }
  edges.sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to) || left.relation.localeCompare(right.relation));

  const payload = {
    format: RWP_CASE_GRAPH_FORMAT,
    version: RWP_CASE_GRAPH_VERSION,
    domain: 'trade',
    source: { passportDigest, cardDigest: card.cardDigest },
    nodes,
    edges,
    summary: summarizeGraph(nodes, edges),
    projectedAt: nodes[nodes.length - 1].at,
    assurance: RWP_CASE_GRAPH_ASSURANCE
  };
  const graphDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, graphId: `rwpgraph:${graphDigest.slice(2, 18)}`, graphDigest };
};

export const validateRwpCaseGraph = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Case Graph root must be an object.'];
  if (value.format !== RWP_CASE_GRAPH_FORMAT) errors.push(`format must equal ${RWP_CASE_GRAPH_FORMAT}.`);
  if (value.version !== RWP_CASE_GRAPH_VERSION) errors.push(`version must equal ${RWP_CASE_GRAPH_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwpgraph:[0-9a-f]{16}$/.test(value.graphId ?? '')) errors.push('graphId is invalid.');
  if (!isBytes32(value.graphDigest)) errors.push('graphDigest must be lowercase bytes32 hex.');
  if (!isRecord(value.source) || !isBytes32(value.source?.passportDigest) || !isBytes32(value.source?.cardDigest)) errors.push('source digests are invalid.');
  if (!Array.isArray(value.nodes) || value.nodes.length < 2) errors.push('nodes must contain at least Passport and Proof Card events.');
  if (!Array.isArray(value.edges) || value.edges.length < 1) errors.push('edges must contain at least the Passport projection edge.');
  const nodeIds = new Set();
  const digests = new Set();
  for (const node of Array.isArray(value.nodes) ? value.nodes : []) {
    if (!isRecord(node) || typeof node.id !== 'string' || node.id.length < 1) errors.push('node.id is required.');
    else if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    else nodeIds.add(node.id);
    if (!NODE_TYPE_SET.has(node?.type)) errors.push('node.type is unsupported.');
    if (!isBytes32(node?.digest)) errors.push('node.digest is invalid.');
    else if (digests.has(node.digest)) errors.push(`Duplicate node digest: ${node.digest}`);
    else digests.add(node.digest);
    if (!isDateTime(node?.at)) errors.push('node.at is invalid.');
    if (typeof node?.status !== 'string' || node.status.length < 1 || node.status.length > 64) errors.push('node.status is invalid.');
    if (!isRecord(node?.metrics) || Object.values(node.metrics).some((metric) => !safeInteger(metric))) errors.push('node.metrics must contain non-negative integers.');
  }
  for (const edge of Array.isArray(value.edges) ? value.edges : []) {
    if (!isRecord(edge) || !nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push('edge references a missing node.');
    if (!EDGE_RELATION_SET.has(edge?.relation)) errors.push('edge.relation is unsupported.');
  }
  if (!isRecord(value.summary) || !safeInteger(value.summary?.eventCount) || !safeInteger(value.summary?.edgeCount)) errors.push('summary counts are invalid.');
  if (value.summary?.eventCount !== value.nodes?.length || value.summary?.edgeCount !== value.edges?.length) errors.push('summary counts do not match graph arrays.');
  if (!isDateTime(value.summary?.firstEventAt) || !isDateTime(value.summary?.lastEventAt) || !isDateTime(value.projectedAt)) errors.push('summary timeline dates are invalid.');
  if (value.projectedAt !== value.summary?.lastEventAt) errors.push('projectedAt must equal summary.lastEventAt.');
  if (value.assurance !== RWP_CASE_GRAPH_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (/party:|evidence:\/\/|evidenceId|fileName|displayName|goodsDescription|computedDigest|deliveryEndpoint/i.test(canonicalizeJson(value))) {
    errors.push('RWP Case Graph contains a forbidden private-field marker.');
  }
  if (errors.length === 0) {
    const { graphId, graphDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (graphDigest !== expectedDigest) errors.push('graphDigest does not match the canonical graph payload.');
    if (graphId !== `rwpgraph:${expectedDigest.slice(2, 18)}`) errors.push('graphId does not match graphDigest.');
  }
  return errors;
};

export const buildRwpTimelineCard = (graph) => {
  const errors = validateRwpCaseGraph(graph);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const payload = {
    format: RWP_TIMELINE_CARD_FORMAT,
    version: RWP_CASE_GRAPH_VERSION,
    domain: 'trade',
    source: {
      graphId: graph.graphId,
      graphDigest: graph.graphDigest,
      passportDigest: graph.source.passportDigest,
      cardDigest: graph.source.cardDigest
    },
    currentState: graph.summary.currentState,
    events: graph.nodes.map((node) => ({ type: node.type, digest: node.digest, at: node.at, status: node.status })),
    counts: {
      events: graph.summary.eventCount,
      edges: graph.summary.edgeCount,
      requests: graph.summary.counts.request,
      responses: graph.summary.counts.request_response,
      packages: graph.summary.counts.evidence_package,
      receipts: graph.summary.counts.evidence_receipt,
      resolutions: graph.summary.counts.evidence_resolution,
      resolutionReceipts: graph.summary.counts.evidence_resolution_receipt,
      resolved: graph.summary.statusCounts.resolved,
      mismatch: graph.summary.statusCounts.mismatch,
      incomplete: graph.summary.statusCounts.incomplete,
      requestMore: graph.summary.statusCounts.requestMore
    },
    firstEventAt: graph.summary.firstEventAt,
    lastEventAt: graph.summary.lastEventAt,
    assurance: RWP_TIMELINE_CARD_ASSURANCE
  };
  const timelineDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, timelineId: `rwptl:${timelineDigest.slice(2, 18)}`, timelineDigest };
};

export const validateRwpTimelineCard = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Timeline Card root must be an object.'];
  if (value.format !== RWP_TIMELINE_CARD_FORMAT) errors.push(`format must equal ${RWP_TIMELINE_CARD_FORMAT}.`);
  if (value.version !== RWP_CASE_GRAPH_VERSION) errors.push(`version must equal ${RWP_CASE_GRAPH_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwptl:[0-9a-f]{16}$/.test(value.timelineId ?? '')) errors.push('timelineId is invalid.');
  if (!isBytes32(value.timelineDigest)) errors.push('timelineDigest is invalid.');
  if (!isRecord(value.source) || !/^rwpgraph:[0-9a-f]{16}$/.test(value.source?.graphId ?? '')) errors.push('source.graphId is invalid.');
  for (const field of ['graphDigest', 'passportDigest', 'cardDigest']) if (!isBytes32(value.source?.[field])) errors.push(`source.${field} is invalid.`);
  if (typeof value.currentState !== 'string' || value.currentState.length < 1) errors.push('currentState is required.');
  if (!Array.isArray(value.events) || value.events.length < 2) errors.push('events must contain at least two timeline entries.');
  for (const event of Array.isArray(value.events) ? value.events : []) {
    if (!NODE_TYPE_SET.has(event?.type)) errors.push('event.type is unsupported.');
    if (!isBytes32(event?.digest)) errors.push('event.digest is invalid.');
    if (!isDateTime(event?.at)) errors.push('event.at is invalid.');
    if (typeof event?.status !== 'string' || event.status.length < 1) errors.push('event.status is invalid.');
  }
  if (!isRecord(value.counts) || Object.values(value.counts).some((count) => !safeInteger(count))) errors.push('counts must contain non-negative integers.');
  if (value.counts?.events !== value.events?.length) errors.push('counts.events does not match events.');
  if (!isDateTime(value.firstEventAt) || !isDateTime(value.lastEventAt)) errors.push('timeline dates are invalid.');
  if (value.assurance !== RWP_TIMELINE_CARD_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (/party:|evidence:\/\/|evidenceId|fileName|displayName|goodsDescription|computedDigest|deliveryEndpoint/i.test(canonicalizeJson(value))) {
    errors.push('RWP Timeline Card contains a forbidden private-field marker.');
  }
  if (errors.length === 0) {
    const { timelineId, timelineDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (timelineDigest !== expectedDigest) errors.push('timelineDigest does not match the canonical timeline payload.');
    if (timelineId !== `rwptl:${expectedDigest.slice(2, 18)}`) errors.push('timelineId does not match timelineDigest.');
  }
  return errors;
};

export const encodeRwpTimelineCard = (card) => {
  const errors = validateRwpTimelineCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(card));
  if (encoded.length > MAX_TIMELINE_PAYLOAD_LENGTH) throw new Error('RWP Timeline Card exceeds the bounded share-link size.');
  return encoded;
};

export const decodeRwpTimelineCard = (payload) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_TIMELINE_PAYLOAD_LENGTH) throw new Error('RWP Timeline Card payload is missing or too large.');
  const card = JSON.parse(fromBase64Url(payload));
  const errors = validateRwpTimelineCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return card;
};

export const buildRwpTimelineCardUrl = (card, baseUrl) => {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/[^/]*$/, 'rwp-graph.html');
  url.search = '';
  url.hash = new URLSearchParams({ timeline: encodeRwpTimelineCard(card) }).toString();
  return url.toString();
};

export const readRwpTimelineCardFromHash = (hash) => {
  const payload = new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get('timeline');
  return payload ? decodeRwpTimelineCard(payload) : null;
};
