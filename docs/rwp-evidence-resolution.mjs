import { canonicalizeJson, computePassportDigest } from './rwp-card.mjs';
import {
  evidenceCategoryForType,
  validateRwpEvidencePackage
} from './rwp-evidence-package.mjs';
import {
  validateRwpEvidenceReceipt,
  verifyReceivedEvidenceFileBytes
} from './rwp-evidence-receipt.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_EVIDENCE_RESOLUTION_FORMAT = 'real-world-proof-evidence-resolution';
export const RWP_EVIDENCE_RESOLUTION_RECEIPT_FORMAT = 'real-world-proof-evidence-resolution-receipt';
export const RWP_EVIDENCE_RESOLUTION_CARD_FORMAT = 'real-world-proof-evidence-resolution-card';
export const RWP_EVIDENCE_RESOLUTION_VERSION = '0.1';

export const RWP_EVIDENCE_RESOLUTION_ASSURANCE =
  'This holder-generated resolution package appends a bounded redelivery or supplement to a prior Evidence Package and Receipt. It does not erase history, authenticate either party, expand authorization, prove delivery, create legal authority, or establish absolute real-world truth.';

export const RWP_EVIDENCE_RESOLUTION_RECEIPT_ASSURANCE =
  'This unsigned self-declared resolution receipt records a recipient-side check of a prior issue and a subsequent Resolution Package. It does not authenticate the recipient, prove legal delivery, validate source-document content, create authority, or establish absolute real-world truth.';

export const RWP_EVIDENCE_RESOLUTION_CARD_ASSURANCE =
  'This privacy-bounded public card summarizes a Resolution Receipt. It contains no evidence identifiers, file names, source-document bytes, evidence digests, delivery endpoints, or confidential trade content.';

export const RESOLUTION_MODES = Object.freeze(['redelivery', 'supplemental', 'combined']);
export const RESOLUTION_RECEIPT_OUTCOMES = Object.freeze(['resolved', 'unresolved', 'request_more']);
export const RESOLUTION_ITEM_STATUSES = Object.freeze([
  'matched',
  'mismatch',
  'missing',
  'not_checked',
  'unsupported_algorithm'
]);

const MODE_SET = new Set(RESOLUTION_MODES);
const OUTCOME_SET = new Set(RESOLUTION_RECEIPT_OUTCOMES);
const ITEM_STATUS_SET = new Set(RESOLUTION_ITEM_STATUSES);
const ROLE_SET = new Set([
  'exporter', 'buyer', 'supplier', 'manufacturer', 'inspection', 'logistics',
  'warehouse', 'customs', 'insurance', 'legal', 'funder', 'other'
]);
const MAX_NOTE_LENGTH = 280;
const MAX_CARD_PAYLOAD_LENGTH = 5000;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBytes32 = (value) => /^0x[0-9a-f]{64}$/.test(value ?? '');
const isHex = (value) => typeof value === 'string' && /^[0-9a-f]+$/.test(value);
const isDateTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

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

const normalizeNote = (value) => {
  const note = typeof value === 'string' ? value.trim() : '';
  if (note.length > MAX_NOTE_LENGTH) throw new Error(`Resolution note must be at most ${MAX_NOTE_LENGTH} characters.`);
  if (note && /https?:\/\/|www\.|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|party:|evidence:\/\/|displayName|goodsDescription|proofValue/i.test(note)) {
    throw new Error('Resolution note contains a forbidden private or endpoint marker.');
  }
  return note;
};

const sourceFromPrior = (evidencePackage, receipt) => ({
  packageId: evidencePackage.packageId,
  packageDigest: evidencePackage.packageDigest,
  receiptId: receipt.receiptId,
  receiptDigest: receipt.receiptDigest,
  passportDigest: evidencePackage.source.passportDigest,
  cardDigest: evidencePackage.source.cardDigest,
  requestId: evidencePackage.source.requestId,
  requestDigest: evidencePackage.source.requestDigest,
  responseId: evidencePackage.source.responseId,
  responseDigest: evidencePackage.source.responseDigest
});

const priorIssues = (evidencePackage, receipt) => {
  const issues = [];
  for (const item of receipt.evidenceResults) {
    if (item.status !== 'matched') {
      issues.push({
        issueKey: `evidence:${item.evidenceId}`,
        kind: 'evidence_record',
        evidenceId: item.evidenceId,
        category: item.category,
        priorStatus: item.status
      });
    }
  }
  for (const category of evidencePackage.coverage.missingCategories) {
    issues.push({
      issueKey: `category:${category}`,
      kind: 'missing_category',
      category,
      priorStatus: 'missing'
    });
  }
  if (receipt.outcome.status === 'request_more' && issues.length === 0) {
    issues.push({
      issueKey: 'request:additional',
      kind: 'request_more',
      priorStatus: receipt.outcome.deterministicStatus
    });
  }
  return issues.sort((left, right) => left.issueKey.localeCompare(right.issueKey));
};

const evidenceById = (passport) => new Map(
  (Array.isArray(passport.evidence) ? passport.evidence : [])
    .filter((item) => isRecord(item) && typeof item.evidenceId === 'string')
    .map((item) => [item.evidenceId, item])
);

const roleByPartyId = (passport) => new Map(
  (Array.isArray(passport.parties) ? passport.parties : [])
    .filter((item) => isRecord(item) && typeof item.partyId === 'string' && typeof item.role === 'string')
    .map((item) => [item.partyId, item.role])
);

const normalizeMatchedVerification = (record, value) => {
  const verification = isRecord(value) ? value : {};
  if (verification.status !== 'matched') {
    throw new Error(`Resolution evidence ${record.evidenceId} must be locally verified as matched before packaging.`);
  }
  const algorithm = String(verification.algorithm ?? record.digest?.algorithm ?? '').toLowerCase();
  const computedDigest = String(verification.computedDigest ?? '').toLowerCase();
  const expectedDigest = String(record.digest?.value ?? '').toLowerCase();
  if (!algorithm || !isHex(computedDigest) || computedDigest !== expectedDigest) {
    throw new Error(`Resolution evidence ${record.evidenceId} does not match the Passport digest.`);
  }
  return { status: 'matched', algorithm, computedDigest };
};

const assertPriorChain = (evidencePackage, receipt, passport) => {
  const packageErrors = validateRwpEvidencePackage(evidencePackage);
  if (packageErrors.length > 0) throw new Error(packageErrors.join(' '));
  const receiptErrors = validateRwpEvidenceReceipt(receipt, evidencePackage);
  if (receiptErrors.length > 0) throw new Error(receiptErrors.join(' '));
  if (receipt.outcome.status === 'received' && receipt.outcome.deterministicStatus === 'received') {
    throw new Error('A fully received Evidence Package has no unresolved issue to resolve.');
  }
  if (computePassportDigest(passport) !== evidencePackage.source.passportDigest) {
    throw new Error('Imported Passport digest does not match the prior Evidence Package source.');
  }
};

const buildUnsignedResolution = (evidencePackage, receipt, passport, options = {}) => {
  assertPriorChain(evidencePackage, receipt, passport);
  const selectedIds = [...new Set((Array.isArray(options.evidenceIds) ? options.evidenceIds : []).map(String))].sort();
  if (selectedIds.length === 0) throw new Error('Select at least one evidence record for resolution.');

  const issues = priorIssues(evidencePackage, receipt);
  const issueByEvidenceId = new Map(issues.filter((item) => item.evidenceId).map((item) => [item.evidenceId, item]));
  const issueByCategory = new Map(issues.filter((item) => item.kind === 'missing_category').map((item) => [item.category, item]));
  const genericRequest = issues.find((item) => item.kind === 'request_more');
  const priorEvidenceIds = new Set(evidencePackage.evidence.map((item) => item.evidenceId));
  const allowedCategories = new Set(evidencePackage.coverage.allowedCategories);
  const records = evidenceById(passport);
  const roles = roleByPartyId(passport);
  const verifications = isRecord(options.fileVerifications) ? options.fileVerifications : {};
  const addressed = new Set();
  const relations = new Set();

  const evidence = selectedIds.map((evidenceId) => {
    const record = records.get(evidenceId);
    if (!record) throw new Error(`Unknown Passport evidence record: ${evidenceId}`);
    const category = evidenceCategoryForType(record.type);
    if (!allowedCategories.has(category)) {
      throw new Error(`Evidence ${evidenceId} maps to category ${category}, which the prior Response did not authorize.`);
    }
    if (!isRecord(record.digest) || typeof record.digest.algorithm !== 'string' || !isHex(String(record.digest.value ?? '').toLowerCase())) {
      throw new Error(`Evidence ${evidenceId} has an invalid digest.`);
    }

    let relation = null;
    if (issueByEvidenceId.has(evidenceId)) {
      addressed.add(issueByEvidenceId.get(evidenceId).issueKey);
      relation = 'redelivery';
      relations.add('redelivery');
    }
    if (!priorEvidenceIds.has(evidenceId) && issueByCategory.has(category)) {
      addressed.add(issueByCategory.get(category).issueKey);
      relation = relation ?? 'supplemental';
      relations.add('supplemental');
    }
    if (!priorEvidenceIds.has(evidenceId) && genericRequest) {
      addressed.add(genericRequest.issueKey);
      relation = relation ?? 'supplemental';
      relations.add('supplemental');
    }
    if (!relation) {
      throw new Error(`Evidence ${evidenceId} does not address a recorded Receipt issue.`);
    }

    const issuerRole = record.issuedBy ? roles.get(record.issuedBy) : undefined;
    return {
      evidenceId,
      relation,
      category,
      type: String(record.type),
      digest: {
        algorithm: String(record.digest.algorithm).toLowerCase(),
        value: String(record.digest.value).toLowerCase()
      },
      disclosure: record.disclosure,
      ...(isDateTime(record.issuedAt) ? { issuedAt: new Date(record.issuedAt).toISOString() } : {}),
      ...(issuerRole ? { issuerRole } : {}),
      fileVerification: normalizeMatchedVerification(record, verifications[evidenceId])
    };
  });

  const unresolvedIssues = issues.filter((item) => !addressed.has(item.issueKey));
  const mode = relations.size > 1 ? 'combined' : [...relations][0];
  if (!MODE_SET.has(mode)) throw new Error('Resolution mode could not be derived.');
  const note = normalizeNote(options.note);
  const createdAt = new Date(options.createdAt ?? Date.now()).toISOString();

  return {
    format: RWP_EVIDENCE_RESOLUTION_FORMAT,
    version: RWP_EVIDENCE_RESOLUTION_VERSION,
    domain: 'trade',
    source: sourceFromPrior(evidencePackage, receipt),
    resolution: {
      mode,
      priorOutcome: receipt.outcome.status,
      priorDeterministicStatus: receipt.outcome.deterministicStatus,
      issueCount: issues.length,
      addressedIssueKeys: [...addressed].sort(),
      unresolvedIssueKeys: unresolvedIssues.map((item) => item.issueKey),
      complete: unresolvedIssues.length === 0
    },
    evidence,
    ...(note ? { note } : {}),
    createdAt,
    assurance: RWP_EVIDENCE_RESOLUTION_ASSURANCE
  };
};

export const buildRwpEvidenceResolution = (evidencePackage, receipt, passport, options = {}) => {
  const payload = buildUnsignedResolution(evidencePackage, receipt, passport, options);
  const resolutionDigest = keccakUtf8(canonicalizeJson(payload));
  return {
    ...payload,
    resolutionId: `rwperes:${resolutionDigest.slice(2, 18)}`,
    resolutionDigest
  };
};

export const validateRwpEvidenceResolution = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['Evidence Resolution root must be an object.'];
  if (value.format !== RWP_EVIDENCE_RESOLUTION_FORMAT) errors.push(`format must equal ${RWP_EVIDENCE_RESOLUTION_FORMAT}.`);
  if (value.version !== RWP_EVIDENCE_RESOLUTION_VERSION) errors.push(`version must equal ${RWP_EVIDENCE_RESOLUTION_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwperes:[0-9a-f]{16}$/.test(value.resolutionId ?? '')) errors.push('resolutionId is invalid.');
  if (!isBytes32(value.resolutionDigest)) errors.push('resolutionDigest must be lowercase bytes32 hex.');
  if (!isRecord(value.source)) errors.push('source must be an object.');
  if (!/^rwpep:[0-9a-f]{16}$/.test(value.source?.packageId ?? '')) errors.push('source.packageId is invalid.');
  if (!/^rwper:[0-9a-f]{16}$/.test(value.source?.receiptId ?? '')) errors.push('source.receiptId is invalid.');
  if (!/^rwpr:[0-9a-f]{16}$/.test(value.source?.requestId ?? '')) errors.push('source.requestId is invalid.');
  if (!/^rwprr:[0-9a-f]{16}$/.test(value.source?.responseId ?? '')) errors.push('source.responseId is invalid.');
  for (const field of ['packageDigest', 'receiptDigest', 'passportDigest', 'cardDigest', 'requestDigest', 'responseDigest']) {
    if (!isBytes32(value.source?.[field])) errors.push(`source.${field} must be lowercase bytes32 hex.`);
  }
  if (!isRecord(value.resolution)) errors.push('resolution must be an object.');
  if (!MODE_SET.has(value.resolution?.mode)) errors.push('resolution.mode is unsupported.');
  if (!['incomplete', 'mismatch', 'request_more'].includes(value.resolution?.priorOutcome)) errors.push('resolution.priorOutcome is unsupported.');
  if (!['received', 'incomplete', 'mismatch'].includes(value.resolution?.priorDeterministicStatus)) errors.push('resolution.priorDeterministicStatus is invalid.');
  if (!Number.isInteger(value.resolution?.issueCount) || value.resolution.issueCount < 1) errors.push('resolution.issueCount must be a positive integer.');
  for (const field of ['addressedIssueKeys', 'unresolvedIssueKeys']) {
    const list = value.resolution?.[field];
    if (!Array.isArray(list) || list.some((item) => typeof item !== 'string') || new Set(list).size !== list.length || [...list].sort().join('|') !== list.join('|')) {
      errors.push(`resolution.${field} must contain unique sorted strings.`);
    }
  }
  const addressedCount = value.resolution?.addressedIssueKeys?.length ?? 0;
  const unresolvedCount = value.resolution?.unresolvedIssueKeys?.length ?? 0;
  if (addressedCount + unresolvedCount !== value.resolution?.issueCount) errors.push('resolution issue counts are inconsistent.');
  if (value.resolution?.complete !== (unresolvedCount === 0)) errors.push('resolution.complete is inconsistent.');
  if (!Array.isArray(value.evidence) || value.evidence.length < 1) errors.push('evidence must contain at least one record.');
  const evidenceIds = new Set();
  const relations = new Set();
  for (const item of Array.isArray(value.evidence) ? value.evidence : []) {
    if (!isRecord(item)) { errors.push('evidence records must be objects.'); continue; }
    if (typeof item.evidenceId !== 'string' || item.evidenceId.length < 1) errors.push('evidence.evidenceId is required.');
    else if (evidenceIds.has(item.evidenceId)) errors.push(`Duplicate evidenceId: ${item.evidenceId}`);
    else evidenceIds.add(item.evidenceId);
    if (!['redelivery', 'supplemental'].includes(item.relation)) errors.push('evidence.relation is unsupported.');
    else relations.add(item.relation);
    if (typeof item.category !== 'string' || typeof item.type !== 'string') errors.push('evidence category and type are required.');
    if (!isRecord(item.digest) || typeof item.digest.algorithm !== 'string' || !isHex(item.digest.value ?? '')) errors.push('evidence.digest is invalid.');
    if (!isRecord(item.fileVerification) || item.fileVerification.status !== 'matched' || !isHex(item.fileVerification.computedDigest ?? '')) errors.push('resolution evidence must have matched file verification.');
    if (item.fileVerification?.computedDigest !== item.digest?.value) errors.push('resolution evidence computedDigest must equal evidence digest.');
  }
  const derivedMode = relations.size > 1 ? 'combined' : [...relations][0];
  if (derivedMode !== value.resolution?.mode) errors.push('resolution.mode does not match evidence relations.');
  if (value.note !== undefined && (typeof value.note !== 'string' || value.note.length < 1 || value.note.length > MAX_NOTE_LENGTH)) errors.push(`note must contain 1 to ${MAX_NOTE_LENGTH} characters when present.`);
  if (!isDateTime(value.createdAt)) errors.push('createdAt is invalid.');
  if (value.assurance !== RWP_EVIDENCE_RESOLUTION_ASSURANCE) errors.push('assurance boundary is missing or changed.');

  if (errors.length === 0) {
    const { resolutionId, resolutionDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (resolutionDigest !== expectedDigest) errors.push('resolutionDigest does not match the canonical payload.');
    if (resolutionId !== `rwperes:${expectedDigest.slice(2, 18)}`) errors.push('resolutionId does not match resolutionDigest.');
  }
  return errors;
};

export const verifyResolutionEvidenceFileBytes = verifyReceivedEvidenceFileBytes;

const summarize = (results) => {
  const counts = { total: results.length, matched: 0, mismatch: 0, missing: 0, notChecked: 0, unsupportedAlgorithm: 0 };
  for (const item of results) {
    if (item.status === 'matched') counts.matched += 1;
    if (item.status === 'mismatch') counts.mismatch += 1;
    if (item.status === 'missing') counts.missing += 1;
    if (item.status === 'not_checked') counts.notChecked += 1;
    if (item.status === 'unsupported_algorithm') counts.unsupportedAlgorithm += 1;
  }
  return counts;
};

const normalizeResolutionItem = (resolutionEvidence, raw) => {
  const value = isRecord(raw) ? raw : { status: 'missing' };
  const status = String(value.status ?? 'missing');
  if (!ITEM_STATUS_SET.has(status)) throw new Error(`Unsupported resolution receipt item status: ${status}`);
  const algorithm = String(value.algorithm ?? resolutionEvidence.digest.algorithm).toLowerCase();
  const result = { evidenceId: resolutionEvidence.evidenceId, relation: resolutionEvidence.relation, category: resolutionEvidence.category, status, algorithm };
  if (value.computedDigest !== undefined) {
    const computedDigest = String(value.computedDigest).toLowerCase();
    if (!isHex(computedDigest)) throw new Error('computedDigest must be lowercase hexadecimal.');
    result.computedDigest = computedDigest;
  }
  if ((status === 'matched' || status === 'mismatch') && !result.computedDigest) throw new Error(`${status} resolution item requires computedDigest.`);
  const expected = String(resolutionEvidence.digest.value).toLowerCase();
  if (status === 'matched' && result.computedDigest !== expected) throw new Error('matched resolution item does not equal the Resolution evidence digest.');
  if (status === 'mismatch' && result.computedDigest === expected) throw new Error('mismatch resolution item unexpectedly equals the Resolution evidence digest.');
  if ((status === 'missing' || status === 'not_checked' || status === 'unsupported_algorithm') && result.computedDigest) throw new Error(`${status} resolution item cannot include computedDigest.`);
  return result;
};

const sourceFromResolution = (resolution) => ({
  resolutionId: resolution.resolutionId,
  resolutionDigest: resolution.resolutionDigest,
  packageId: resolution.source.packageId,
  packageDigest: resolution.source.packageDigest,
  priorReceiptId: resolution.source.receiptId,
  priorReceiptDigest: resolution.source.receiptDigest,
  passportDigest: resolution.source.passportDigest,
  cardDigest: resolution.source.cardDigest,
  requestId: resolution.source.requestId,
  requestDigest: resolution.source.requestDigest,
  responseId: resolution.source.responseId,
  responseDigest: resolution.source.responseDigest
});

const buildUnsignedResolutionReceipt = (resolution, options = {}) => {
  const resolutionErrors = validateRwpEvidenceResolution(resolution);
  if (resolutionErrors.length > 0) throw new Error(resolutionErrors.join(' '));
  const receiverRole = String(options.receiverRole ?? 'other');
  if (!ROLE_SET.has(receiverRole)) throw new Error(`Unsupported receiver role: ${receiverRole}`);
  const rawResults = isRecord(options.evidenceResults) ? options.evidenceResults : {};
  const results = resolution.evidence
    .map((item) => normalizeResolutionItem(item, rawResults[item.evidenceId]))
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const counts = summarize(results);
  const deterministicStatus = resolution.resolution.complete && counts.total > 0 && counts.matched === counts.total ? 'resolved' : 'unresolved';
  const requestedStatus = options.outcome === undefined ? deterministicStatus : String(options.outcome);
  if (!OUTCOME_SET.has(requestedStatus)) throw new Error(`Unsupported resolution receipt outcome: ${requestedStatus}`);
  const note = normalizeNote(options.note);
  if (requestedStatus === 'request_more') {
    if (!note) throw new Error('request_more requires a public note.');
  } else if (requestedStatus !== deterministicStatus) {
    throw new Error(`Resolution receipt outcome must equal deterministic outcome ${deterministicStatus}.`);
  }
  const createdAt = new Date(options.createdAt ?? Date.now()).toISOString();
  return {
    format: RWP_EVIDENCE_RESOLUTION_RECEIPT_FORMAT,
    version: RWP_EVIDENCE_RESOLUTION_VERSION,
    domain: 'trade',
    source: sourceFromResolution(resolution),
    receiver: { role: receiverRole },
    outcome: {
      status: requestedStatus,
      deterministicStatus,
      priorIssuesFullyAddressed: resolution.resolution.complete,
      counts
    },
    evidenceResults: results,
    ...(note ? { note } : {}),
    createdAt,
    assurance: RWP_EVIDENCE_RESOLUTION_RECEIPT_ASSURANCE
  };
};

export const buildRwpEvidenceResolutionReceipt = (resolution, options = {}) => {
  const payload = buildUnsignedResolutionReceipt(resolution, options);
  const receiptDigest = keccakUtf8(canonicalizeJson(payload));
  return {
    ...payload,
    receiptId: `rwperr:${receiptDigest.slice(2, 18)}`,
    receiptDigest
  };
};

export const validateRwpEvidenceResolutionReceipt = (value, resolution) => {
  const errors = [];
  if (!isRecord(value)) return ['Evidence Resolution Receipt root must be an object.'];
  if (value.format !== RWP_EVIDENCE_RESOLUTION_RECEIPT_FORMAT) errors.push(`format must equal ${RWP_EVIDENCE_RESOLUTION_RECEIPT_FORMAT}.`);
  if (value.version !== RWP_EVIDENCE_RESOLUTION_VERSION) errors.push(`version must equal ${RWP_EVIDENCE_RESOLUTION_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwperr:[0-9a-f]{16}$/.test(value.receiptId ?? '')) errors.push('receiptId is invalid.');
  if (!isBytes32(value.receiptDigest)) errors.push('receiptDigest must be lowercase bytes32 hex.');
  if (!isRecord(value.source)) errors.push('source must be an object.');
  if (!/^rwperes:[0-9a-f]{16}$/.test(value.source?.resolutionId ?? '')) errors.push('source.resolutionId is invalid.');
  if (!/^rwpep:[0-9a-f]{16}$/.test(value.source?.packageId ?? '')) errors.push('source.packageId is invalid.');
  if (!/^rwper:[0-9a-f]{16}$/.test(value.source?.priorReceiptId ?? '')) errors.push('source.priorReceiptId is invalid.');
  if (!/^rwpr:[0-9a-f]{16}$/.test(value.source?.requestId ?? '')) errors.push('source.requestId is invalid.');
  if (!/^rwprr:[0-9a-f]{16}$/.test(value.source?.responseId ?? '')) errors.push('source.responseId is invalid.');
  for (const field of ['resolutionDigest', 'packageDigest', 'priorReceiptDigest', 'passportDigest', 'cardDigest', 'requestDigest', 'responseDigest']) {
    if (!isBytes32(value.source?.[field])) errors.push(`source.${field} must be lowercase bytes32 hex.`);
  }
  if (!isRecord(value.receiver) || !ROLE_SET.has(value.receiver?.role)) errors.push('receiver.role is unsupported.');
  if (!isRecord(value.outcome) || !OUTCOME_SET.has(value.outcome?.status)) errors.push('outcome.status is unsupported.');
  if (!['resolved', 'unresolved'].includes(value.outcome?.deterministicStatus)) errors.push('outcome.deterministicStatus is invalid.');
  if (typeof value.outcome?.priorIssuesFullyAddressed !== 'boolean') errors.push('outcome.priorIssuesFullyAddressed must be boolean.');
  const counts = value.outcome?.counts;
  if (!isRecord(counts)) errors.push('outcome.counts must be an object.');
  for (const field of ['total', 'matched', 'mismatch', 'missing', 'notChecked', 'unsupportedAlgorithm']) {
    if (!Number.isInteger(counts?.[field]) || counts[field] < 0) errors.push(`outcome.counts.${field} must be a non-negative integer.`);
  }
  if (!Array.isArray(value.evidenceResults) || value.evidenceResults.length < 1) errors.push('evidenceResults must contain at least one item.');
  const derivedCounts = summarize(Array.isArray(value.evidenceResults) ? value.evidenceResults : []);
  if (isRecord(counts) && canonicalizeJson(counts) !== canonicalizeJson(derivedCounts)) errors.push('outcome.counts does not match evidenceResults.');
  for (const item of Array.isArray(value.evidenceResults) ? value.evidenceResults : []) {
    if (!isRecord(item) || typeof item.evidenceId !== 'string') errors.push('evidenceResults items require evidenceId.');
    if (!['redelivery', 'supplemental'].includes(item?.relation)) errors.push('evidenceResults.relation is unsupported.');
    if (!ITEM_STATUS_SET.has(item?.status)) errors.push('evidenceResults.status is unsupported.');
    if (item?.computedDigest !== undefined && !isHex(item.computedDigest)) errors.push('evidenceResults.computedDigest is invalid.');
  }
  const derivedStatus = value.outcome?.priorIssuesFullyAddressed === true && derivedCounts.total > 0 && derivedCounts.matched === derivedCounts.total ? 'resolved' : 'unresolved';
  if (value.outcome?.deterministicStatus !== derivedStatus) errors.push('outcome.deterministicStatus is inconsistent.');
  if (value.outcome?.status !== 'request_more' && value.outcome?.status !== derivedStatus) errors.push('outcome.status is inconsistent.');
  if (value.outcome?.status === 'request_more' && (typeof value.note !== 'string' || value.note.length < 1)) errors.push('request_more requires note.');
  if (value.note !== undefined && (typeof value.note !== 'string' || value.note.length < 1 || value.note.length > MAX_NOTE_LENGTH)) errors.push(`note must contain 1 to ${MAX_NOTE_LENGTH} characters when present.`);
  if (!isDateTime(value.createdAt)) errors.push('createdAt is invalid.');
  if (value.assurance !== RWP_EVIDENCE_RESOLUTION_RECEIPT_ASSURANCE) errors.push('assurance boundary is missing or changed.');

  if (resolution !== undefined) {
    const resolutionErrors = validateRwpEvidenceResolution(resolution);
    if (resolutionErrors.length > 0) errors.push(...resolutionErrors.map((error) => `Resolution: ${error}`));
    else {
      if (canonicalizeJson(value.source) !== canonicalizeJson(sourceFromResolution(resolution))) errors.push('Resolution Receipt source does not match the Resolution Package.');
      if (value.outcome?.priorIssuesFullyAddressed !== resolution.resolution.complete) errors.push('Resolution Receipt prior issue flag does not match the Resolution Package.');
      const expected = new Map(resolution.evidence.map((item) => [item.evidenceId, item]));
      if (expected.size !== value.evidenceResults?.length) errors.push('Resolution Receipt must cover every Resolution evidence record exactly once.');
    }
  }

  if (errors.length === 0) {
    const { receiptId, receiptDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (receiptDigest !== expectedDigest) errors.push('receiptDigest does not match the canonical payload.');
    if (receiptId !== `rwperr:${expectedDigest.slice(2, 18)}`) errors.push('receiptId does not match receiptDigest.');
  }
  return errors;
};

export const buildRwpEvidenceResolutionCard = (receipt) => {
  const errors = validateRwpEvidenceResolutionReceipt(receipt);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const payload = {
    format: RWP_EVIDENCE_RESOLUTION_CARD_FORMAT,
    version: RWP_EVIDENCE_RESOLUTION_VERSION,
    domain: 'trade',
    source: {
      resolutionDigest: receipt.source.resolutionDigest,
      priorReceiptDigest: receipt.source.priorReceiptDigest
    },
    receipt: {
      receiptId: receipt.receiptId,
      receiptDigest: receipt.receiptDigest,
      receiverRole: receipt.receiver.role,
      outcome: receipt.outcome.status,
      deterministicStatus: receipt.outcome.deterministicStatus,
      priorIssuesFullyAddressed: receipt.outcome.priorIssuesFullyAddressed,
      counts: receipt.outcome.counts
    },
    createdAt: receipt.createdAt,
    assurance: RWP_EVIDENCE_RESOLUTION_CARD_ASSURANCE
  };
  const cardDigest = keccakUtf8(canonicalizeJson(payload));
  return {
    ...payload,
    cardId: `rwperrc:${cardDigest.slice(2, 18)}`,
    cardDigest
  };
};

export const validateRwpEvidenceResolutionCard = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['Evidence Resolution Card root must be an object.'];
  if (value.format !== RWP_EVIDENCE_RESOLUTION_CARD_FORMAT) errors.push(`format must equal ${RWP_EVIDENCE_RESOLUTION_CARD_FORMAT}.`);
  if (value.version !== RWP_EVIDENCE_RESOLUTION_VERSION) errors.push(`version must equal ${RWP_EVIDENCE_RESOLUTION_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwperrc:[0-9a-f]{16}$/.test(value.cardId ?? '')) errors.push('cardId is invalid.');
  if (!isBytes32(value.cardDigest)) errors.push('cardDigest must be lowercase bytes32 hex.');
  if (!isBytes32(value.source?.resolutionDigest) || !isBytes32(value.source?.priorReceiptDigest)) errors.push('card source digests are invalid.');
  if (!/^rwperr:[0-9a-f]{16}$/.test(value.receipt?.receiptId ?? '')) errors.push('card receiptId is invalid.');
  if (!isBytes32(value.receipt?.receiptDigest)) errors.push('card receiptDigest is invalid.');
  if (!ROLE_SET.has(value.receipt?.receiverRole)) errors.push('card receiverRole is unsupported.');
  if (!OUTCOME_SET.has(value.receipt?.outcome)) errors.push('card outcome is unsupported.');
  if (!['resolved', 'unresolved'].includes(value.receipt?.deterministicStatus)) errors.push('card deterministicStatus is invalid.');
  if (typeof value.receipt?.priorIssuesFullyAddressed !== 'boolean') errors.push('card prior issue flag is invalid.');
  if (!isDateTime(value.createdAt)) errors.push('createdAt is invalid.');
  if (value.assurance !== RWP_EVIDENCE_RESOLUTION_CARD_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (/evidenceId|computedDigest|fileName|evidence:\/\/|party:|displayName|goodsDescription|https?:\/\/|@/i.test(canonicalizeJson(value))) {
    errors.push('Resolution Card contains a forbidden private-field marker.');
  }
  if (errors.length === 0) {
    const { cardId, cardDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (cardDigest !== expectedDigest) errors.push('cardDigest does not match the canonical payload.');
    if (cardId !== `rwperrc:${expectedDigest.slice(2, 18)}`) errors.push('cardId does not match cardDigest.');
  }
  return errors;
};

export const encodeRwpEvidenceResolutionCard = (card) => {
  const errors = validateRwpEvidenceResolutionCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(card));
  if (encoded.length > MAX_CARD_PAYLOAD_LENGTH) throw new Error('Resolution Card exceeds the bounded share-link size.');
  return encoded;
};

export const decodeRwpEvidenceResolutionCard = (payload) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_CARD_PAYLOAD_LENGTH) throw new Error('Resolution Card payload is missing or too large.');
  const card = JSON.parse(fromBase64Url(payload));
  const errors = validateRwpEvidenceResolutionCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return card;
};

export const buildRwpEvidenceResolutionCardUrl = (card, baseUrl) => {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/[^/]*$/, 'rwp-resolve.html');
  url.search = '';
  url.hash = new URLSearchParams({ resolution: encodeRwpEvidenceResolutionCard(card) }).toString();
  return url.toString();
};

export const readRwpEvidenceResolutionCardFromHash = (hash) => {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const payload = params.get('resolution');
  return payload ? decodeRwpEvidenceResolutionCard(payload) : null;
};
