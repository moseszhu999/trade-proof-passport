import { canonicalizeJson, computePassportDigest, validateProofCard } from './rwp-card.mjs';
import { validateRwpRequest } from './rwp-request.mjs';
import { validateRwpRequestResponse } from './rwp-request-response.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_EVIDENCE_PACKAGE_FORMAT = 'real-world-proof-evidence-package';
export const RWP_EVIDENCE_PACKAGE_VERSION = '0.1';
export const RWP_EVIDENCE_PACKAGE_ASSURANCE =
  'This holder-generated manifest identifies evidence records selected for an authorized off-channel workflow. It does not contain source files, prove delivery, authenticate either party, create legal authority, or establish absolute real-world truth.';

export const FILE_VERIFICATION_STATUSES = Object.freeze([
  'not_checked',
  'matched',
  'mismatch',
  'unsupported_algorithm'
]);

const VERIFICATION_STATUS_SET = new Set(FILE_VERIFICATION_STATUSES);
const SUPPORTED_FILE_DIGESTS = Object.freeze({
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512'
});
const DISCLOSURE_SET = new Set(['private', 'shared', 'public_summary']);
const DECISION_SET = new Set(['accept', 'partially_accept']);
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBytes32 = (value) => /^0x[0-9a-f]{64}$/.test(value ?? '');
const isDateTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isHex = (value) => typeof value === 'string' && /^[0-9a-f]+$/.test(value);

export const evidenceCategoryForType = (value) => {
  const type = String(value ?? '').trim().toLowerCase();
  const exact = new Set([
    'bill_of_lading',
    'commercial_invoice',
    'customs_record',
    'insurance_record',
    'packing_list',
    'purchase_order',
    'warehouse_receipt'
  ]);
  if (exact.has(type)) return type;
  if (type === 'inspection_report' || type === 'inspection_summary') return 'inspection_report';
  if (type === 'logistics_event' || type === 'logistics_status_record') return 'logistics_event';
  return 'other';
};

const bytesToHex = (bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

export const verifyEvidenceFileBytes = async (evidence, input) => {
  if (!isRecord(evidence?.digest) || typeof evidence.digest.algorithm !== 'string' || !isHex(String(evidence.digest.value ?? '').toLowerCase())) {
    throw new Error('Evidence digest is missing or invalid.');
  }
  const algorithm = evidence.digest.algorithm.toLowerCase();
  const expectedDigest = evidence.digest.value.toLowerCase();
  const subtleAlgorithm = SUPPORTED_FILE_DIGESTS[algorithm];
  if (!subtleAlgorithm) {
    return { status: 'unsupported_algorithm', algorithm };
  }
  const bytes = input instanceof ArrayBuffer
    ? input
    : ArrayBuffer.isView(input)
      ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
      : null;
  if (!bytes) throw new Error('File verification requires an ArrayBuffer or typed array.');
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable in this environment.');
  const computedDigest = bytesToHex(await globalThis.crypto.subtle.digest(subtleAlgorithm, bytes));
  return {
    status: computedDigest === expectedDigest ? 'matched' : 'mismatch',
    algorithm,
    computedDigest
  };
};

const normalizeVerification = (value, evidence) => {
  const verification = isRecord(value) ? value : { status: 'not_checked' };
  const status = String(verification.status ?? 'not_checked');
  if (!VERIFICATION_STATUS_SET.has(status)) throw new Error(`Unsupported file verification status: ${status}`);
  const algorithm = String(verification.algorithm ?? evidence.digest.algorithm).toLowerCase();
  const result = { status, algorithm };
  if (verification.computedDigest !== undefined) {
    const computedDigest = String(verification.computedDigest).toLowerCase();
    if (!isHex(computedDigest)) throw new Error('computedDigest must be lowercase hexadecimal.');
    result.computedDigest = computedDigest;
  }
  if ((status === 'matched' || status === 'mismatch') && !result.computedDigest) {
    throw new Error(`${status} file verification requires computedDigest.`);
  }
  if (status === 'matched' && result.computedDigest !== String(evidence.digest.value).toLowerCase()) {
    throw new Error('matched file verification does not equal the Passport evidence digest.');
  }
  if (status === 'mismatch' && result.computedDigest === String(evidence.digest.value).toLowerCase()) {
    throw new Error('mismatch file verification unexpectedly equals the Passport evidence digest.');
  }
  return result;
};

const assertSourceChain = (passport, card, request, response) => {
  const cardErrors = validateProofCard(card);
  if (cardErrors.length > 0) throw new Error(cardErrors.join(' '));
  const requestErrors = validateRwpRequest(request);
  if (requestErrors.length > 0) throw new Error(requestErrors.join(' '));
  const responseErrors = validateRwpRequestResponse(response, request);
  if (responseErrors.length > 0) throw new Error(responseErrors.join(' '));
  if (request.source.passportDigest !== card.sourceDigest || request.source.cardDigest !== card.cardDigest) {
    throw new Error('RWP Request source does not match the Proof Card.');
  }
  if (response.source.passportDigest !== card.sourceDigest || response.source.cardDigest !== card.cardDigest) {
    throw new Error('RWP Request Response source does not match the Proof Card.');
  }
  const passportDigest = computePassportDigest(passport);
  if (passportDigest !== card.sourceDigest) {
    throw new Error('Imported Passport digest does not match the Proof Card sourceDigest.');
  }
  if (!DECISION_SET.has(response.decision.status)) {
    throw new Error('An Evidence Package requires an accepted or partially accepted RWP Request Response.');
  }
  if (response.fulfillment.mode !== 'authorized_off_channel') {
    throw new Error('An Evidence Package requires authorized_off_channel fulfillment.');
  }
  if (!Array.isArray(response.fulfillment.evidenceTypes) || response.fulfillment.evidenceTypes.length === 0) {
    throw new Error('The RWP Request Response authorizes no evidence category.');
  }
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

const buildUnsignedPackage = (passport, card, request, response, options = {}) => {
  assertSourceChain(passport, card, request, response);
  const selectedIds = [...new Set((Array.isArray(options.evidenceIds) ? options.evidenceIds : []).map(String))].sort();
  if (selectedIds.length === 0) throw new Error('Select at least one Passport evidence record.');
  const allowedCategories = [...response.fulfillment.evidenceTypes].sort();
  const allowedSet = new Set(allowedCategories);
  const records = evidenceById(passport);
  const roles = roleByPartyId(passport);
  const verifications = isRecord(options.fileVerifications) ? options.fileVerifications : {};

  const evidence = selectedIds.map((evidenceId) => {
    const record = records.get(evidenceId);
    if (!record) throw new Error(`Unknown Passport evidence record: ${evidenceId}`);
    const category = evidenceCategoryForType(record.type);
    if (!allowedSet.has(category)) {
      throw new Error(`Evidence ${evidenceId} maps to category ${category}, which the Response did not authorize.`);
    }
    if (!isRecord(record.digest) || typeof record.digest.algorithm !== 'string' || !isHex(String(record.digest.value ?? '').toLowerCase())) {
      throw new Error(`Evidence ${evidenceId} has an invalid digest.`);
    }
    if (!DISCLOSURE_SET.has(record.disclosure)) throw new Error(`Evidence ${evidenceId} has an invalid disclosure state.`);
    const issuerRole = record.issuedBy ? roles.get(record.issuedBy) : undefined;
    return {
      evidenceId,
      category,
      type: String(record.type),
      digest: {
        algorithm: String(record.digest.algorithm).toLowerCase(),
        value: String(record.digest.value).toLowerCase()
      },
      disclosure: record.disclosure,
      ...(isDateTime(record.issuedAt) ? { issuedAt: new Date(record.issuedAt).toISOString() } : {}),
      ...(issuerRole ? { issuerRole } : {}),
      fileVerification: normalizeVerification(verifications[evidenceId], record)
    };
  });

  const includedCategories = [...new Set(evidence.map((item) => item.category))].sort();
  const missingCategories = allowedCategories.filter((category) => !includedCategories.includes(category));
  const createdAt = new Date(options.createdAt ?? Date.now()).toISOString();

  return {
    format: RWP_EVIDENCE_PACKAGE_FORMAT,
    version: RWP_EVIDENCE_PACKAGE_VERSION,
    domain: 'trade',
    source: {
      passportDigest: card.sourceDigest,
      cardDigest: card.cardDigest,
      requestId: request.requestId,
      requestDigest: request.requestDigest,
      responseId: response.responseId,
      responseDigest: response.responseDigest
    },
    authorization: {
      responseDecision: response.decision.status,
      fulfillmentMode: response.fulfillment.mode,
      channelHint: response.fulfillment.channelHint,
      requesterRole: request.requester.role,
      responderRole: response.responder.role
    },
    coverage: {
      allowedCategories,
      includedCategories,
      missingCategories,
      complete: missingCategories.length === 0
    },
    evidence,
    createdAt,
    assurance: RWP_EVIDENCE_PACKAGE_ASSURANCE
  };
};

export const buildRwpEvidencePackage = (passport, card, request, response, options = {}) => {
  const payload = buildUnsignedPackage(passport, card, request, response, options);
  const packageDigest = keccakUtf8(canonicalizeJson(payload));
  return {
    ...payload,
    packageId: `rwpep:${packageDigest.slice(2, 18)}`,
    packageDigest
  };
};

export const validateRwpEvidencePackage = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['Evidence Package root must be an object.'];
  if (value.format !== RWP_EVIDENCE_PACKAGE_FORMAT) errors.push(`format must equal ${RWP_EVIDENCE_PACKAGE_FORMAT}.`);
  if (value.version !== RWP_EVIDENCE_PACKAGE_VERSION) errors.push(`version must equal ${RWP_EVIDENCE_PACKAGE_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwpep:[0-9a-f]{16}$/.test(value.packageId ?? '')) errors.push('packageId is invalid.');
  if (!isBytes32(value.packageDigest)) errors.push('packageDigest must be lowercase bytes32 hex.');
  if (!isRecord(value.source)) errors.push('source must be an object.');
  for (const field of ['passportDigest', 'cardDigest', 'requestDigest', 'responseDigest']) {
    if (!isBytes32(value.source?.[field])) errors.push(`source.${field} must be lowercase bytes32 hex.`);
  }
  if (!/^rwpr:[0-9a-f]{16}$/.test(value.source?.requestId ?? '')) errors.push('source.requestId is invalid.');
  if (!/^rwprr:[0-9a-f]{16}$/.test(value.source?.responseId ?? '')) errors.push('source.responseId is invalid.');
  if (!isRecord(value.authorization)) errors.push('authorization must be an object.');
  if (!DECISION_SET.has(value.authorization?.responseDecision)) errors.push('authorization.responseDecision is unsupported.');
  if (value.authorization?.fulfillmentMode !== 'authorized_off_channel') errors.push('authorization.fulfillmentMode must equal authorized_off_channel.');
  if (typeof value.authorization?.channelHint !== 'string' || value.authorization.channelHint.length < 1) errors.push('authorization.channelHint is required.');
  if (typeof value.authorization?.requesterRole !== 'string' || typeof value.authorization?.responderRole !== 'string') errors.push('authorization roles are required.');
  if (!isRecord(value.coverage)) errors.push('coverage must be an object.');
  for (const field of ['allowedCategories', 'includedCategories', 'missingCategories']) {
    const list = value.coverage?.[field];
    if (!Array.isArray(list) || list.some((item) => typeof item !== 'string') || new Set(list).size !== list.length || [...list].sort().join('|') !== list.join('|')) {
      errors.push(`coverage.${field} must contain unique sorted strings.`);
    }
  }
  const expectedMissing = (value.coverage?.allowedCategories ?? []).filter((item) => !(value.coverage?.includedCategories ?? []).includes(item));
  if (Array.isArray(value.coverage?.missingCategories) && expectedMissing.join('|') !== value.coverage.missingCategories.join('|')) errors.push('coverage.missingCategories is inconsistent.');
  if (value.coverage?.complete !== (expectedMissing.length === 0)) errors.push('coverage.complete is inconsistent.');
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) errors.push('evidence must contain at least one record.');
  const evidenceIds = new Set();
  for (const item of Array.isArray(value.evidence) ? value.evidence : []) {
    if (!isRecord(item)) { errors.push('evidence records must be objects.'); continue; }
    if (typeof item.evidenceId !== 'string' || item.evidenceId.length < 1) errors.push('evidence.evidenceId is required.');
    else if (evidenceIds.has(item.evidenceId)) errors.push(`Duplicate evidenceId: ${item.evidenceId}`);
    else evidenceIds.add(item.evidenceId);
    if (!(value.coverage?.allowedCategories ?? []).includes(item.category)) errors.push(`Evidence category is not authorized: ${item.category}`);
    if (typeof item.type !== 'string' || item.type.length < 1) errors.push('evidence.type is required.');
    if (!isRecord(item.digest) || typeof item.digest.algorithm !== 'string' || !isHex(item.digest.value ?? '')) errors.push('evidence.digest is invalid.');
    if (!DISCLOSURE_SET.has(item.disclosure)) errors.push('evidence.disclosure is invalid.');
    if (!isRecord(item.fileVerification) || !VERIFICATION_STATUS_SET.has(item.fileVerification?.status)) errors.push('evidence.fileVerification.status is invalid.');
    if (item.fileVerification?.computedDigest !== undefined && !isHex(item.fileVerification.computedDigest)) errors.push('evidence.fileVerification.computedDigest is invalid.');
  }
  const derivedIncluded = [...new Set((Array.isArray(value.evidence) ? value.evidence : []).map((item) => item?.category).filter(Boolean))].sort();
  if (Array.isArray(value.coverage?.includedCategories) && derivedIncluded.join('|') !== value.coverage.includedCategories.join('|')) errors.push('coverage.includedCategories does not match evidence records.');
  if (!isDateTime(value.createdAt)) errors.push('createdAt is invalid.');
  if (value.assurance !== RWP_EVIDENCE_PACKAGE_ASSURANCE) errors.push('assurance boundary is missing or changed.');

  if (errors.length === 0) {
    const { packageId, packageDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (packageDigest !== expectedDigest) errors.push('packageDigest does not match the canonical package payload.');
    if (packageId !== `rwpep:${expectedDigest.slice(2, 18)}`) errors.push('packageId does not match packageDigest.');
  }
  return errors;
};
