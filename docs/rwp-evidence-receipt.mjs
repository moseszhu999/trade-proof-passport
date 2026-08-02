import { canonicalizeJson } from './rwp-card.mjs';
import { validateRwpEvidencePackage } from './rwp-evidence-package.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_EVIDENCE_RECEIPT_FORMAT = 'real-world-proof-evidence-receipt';
export const RWP_EVIDENCE_RECEIPT_VERSION = '0.1';
export const RWP_EVIDENCE_RECEIPT_ASSURANCE =
  'This unsigned self-declared receipt records a recipient-side check of an RWP Evidence Package. It does not authenticate the recipient, prove legal delivery, validate source-document content, create authority, or establish absolute real-world truth.';

export const RWP_EVIDENCE_RECEIPT_CARD_FORMAT = 'real-world-proof-evidence-receipt-card';
export const RWP_EVIDENCE_RECEIPT_CARD_ASSURANCE =
  'This privacy-bounded public card summarizes an unsigned Evidence Package Receipt. It contains no evidence identifiers, file names, source-document bytes, evidence digests, delivery endpoints, or confidential trade content.';

export const RECEIPT_OUTCOMES = Object.freeze([
  'received',
  'incomplete',
  'mismatch',
  'request_more'
]);

export const RECEIPT_ITEM_STATUSES = Object.freeze([
  'matched',
  'mismatch',
  'missing',
  'not_checked',
  'unsupported_algorithm'
]);

const OUTCOME_SET = new Set(RECEIPT_OUTCOMES);
const ITEM_STATUS_SET = new Set(RECEIPT_ITEM_STATUSES);
const ROLE_SET = new Set([
  'exporter', 'buyer', 'supplier', 'manufacturer', 'inspection', 'logistics',
  'warehouse', 'customs', 'insurance', 'legal', 'funder', 'other'
]);
const SUPPORTED_FILE_DIGESTS = Object.freeze({
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512'
});
const MAX_NOTE_LENGTH = 280;
const MAX_CARD_PAYLOAD_LENGTH = 5000;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBytes32 = (value) => /^0x[0-9a-f]{64}$/.test(value ?? '');
const isHex = (value) => typeof value === 'string' && /^[0-9a-f]+$/.test(value);
const isDateTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const bytesToHex = (bytes) => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

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
  if (note.length > MAX_NOTE_LENGTH) throw new Error(`Receipt note must be at most ${MAX_NOTE_LENGTH} characters.`);
  if (note && /https?:\/\/|www\.|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|party:|evidence:\/\/|displayName|goodsDescription|proofValue/i.test(note)) {
    throw new Error('Receipt note contains a forbidden private or endpoint marker.');
  }
  return note;
};

export const verifyReceivedEvidenceFileBytes = async (packageEvidence, input) => {
  const algorithm = String(packageEvidence?.digest?.algorithm ?? '').toLowerCase();
  const expectedDigest = String(packageEvidence?.digest?.value ?? '').toLowerCase();
  if (!algorithm || !isHex(expectedDigest)) throw new Error('Package evidence digest is missing or invalid.');
  const subtleAlgorithm = SUPPORTED_FILE_DIGESTS[algorithm];
  if (!subtleAlgorithm) return { status: 'unsupported_algorithm', algorithm };
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

const normalizeItemResult = (packageEvidence, raw) => {
  const value = isRecord(raw) ? raw : { status: 'missing' };
  const status = String(value.status ?? 'missing');
  if (!ITEM_STATUS_SET.has(status)) throw new Error(`Unsupported receipt item status: ${status}`);
  const algorithm = String(value.algorithm ?? packageEvidence.digest.algorithm).toLowerCase();
  const result = {
    evidenceId: packageEvidence.evidenceId,
    category: packageEvidence.category,
    status,
    algorithm
  };
  if (value.computedDigest !== undefined) {
    const computedDigest = String(value.computedDigest).toLowerCase();
    if (!isHex(computedDigest)) throw new Error('computedDigest must be lowercase hexadecimal.');
    result.computedDigest = computedDigest;
  }
  if ((status === 'matched' || status === 'mismatch') && !result.computedDigest) {
    throw new Error(`${status} receipt item requires computedDigest.`);
  }
  const expected = String(packageEvidence.digest.value).toLowerCase();
  if (status === 'matched' && result.computedDigest !== expected) {
    throw new Error('matched receipt item does not equal the Package evidence digest.');
  }
  if (status === 'mismatch' && result.computedDigest === expected) {
    throw new Error('mismatch receipt item unexpectedly equals the Package evidence digest.');
  }
  if ((status === 'missing' || status === 'not_checked' || status === 'unsupported_algorithm') && result.computedDigest) {
    throw new Error(`${status} receipt item cannot include computedDigest.`);
  }
  return result;
};

const summarize = (results) => {
  const counts = {
    total: results.length,
    matched: 0,
    mismatch: 0,
    missing: 0,
    notChecked: 0,
    unsupportedAlgorithm: 0
  };
  for (const item of results) {
    if (item.status === 'matched') counts.matched += 1;
    if (item.status === 'mismatch') counts.mismatch += 1;
    if (item.status === 'missing') counts.missing += 1;
    if (item.status === 'not_checked') counts.notChecked += 1;
    if (item.status === 'unsupported_algorithm') counts.unsupportedAlgorithm += 1;
  }
  return counts;
};

const deterministicOutcome = (evidencePackage, counts) => {
  if (counts.mismatch > 0) return 'mismatch';
  if (
    evidencePackage.coverage.complete === true &&
    counts.total > 0 &&
    counts.matched === counts.total
  ) return 'received';
  return 'incomplete';
};

const sourceFromPackage = (evidencePackage) => ({
  packageId: evidencePackage.packageId,
  packageDigest: evidencePackage.packageDigest,
  passportDigest: evidencePackage.source.passportDigest,
  cardDigest: evidencePackage.source.cardDigest,
  requestId: evidencePackage.source.requestId,
  requestDigest: evidencePackage.source.requestDigest,
  responseId: evidencePackage.source.responseId,
  responseDigest: evidencePackage.source.responseDigest
});

const buildUnsignedReceipt = (evidencePackage, options = {}) => {
  const packageErrors = validateRwpEvidencePackage(evidencePackage);
  if (packageErrors.length > 0) throw new Error(packageErrors.join(' '));
  const receiverRole = String(options.receiverRole ?? 'other');
  if (!ROLE_SET.has(receiverRole)) throw new Error(`Unsupported receiver role: ${receiverRole}`);
  const rawResults = isRecord(options.evidenceResults) ? options.evidenceResults : {};
  const results = evidencePackage.evidence
    .map((item) => normalizeItemResult(item, rawResults[item.evidenceId]))
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  const counts = summarize(results);
  const derived = deterministicOutcome(evidencePackage, counts);
  const requestedOutcome = options.outcome === undefined ? derived : String(options.outcome);
  if (!OUTCOME_SET.has(requestedOutcome)) throw new Error(`Unsupported receipt outcome: ${requestedOutcome}`);
  const note = normalizeNote(options.note);
  if (requestedOutcome === 'request_more') {
    if (!note) throw new Error('request_more requires a public note.');
  } else if (requestedOutcome !== derived) {
    throw new Error(`Receipt outcome must equal deterministic outcome ${derived}.`);
  }
  const createdAt = new Date(options.createdAt ?? Date.now()).toISOString();
  return {
    format: RWP_EVIDENCE_RECEIPT_FORMAT,
    version: RWP_EVIDENCE_RECEIPT_VERSION,
    domain: 'trade',
    source: sourceFromPackage(evidencePackage),
    receiver: { role: receiverRole },
    outcome: {
      status: requestedOutcome,
      deterministicStatus: derived,
      packageCoverageComplete: evidencePackage.coverage.complete,
      counts
    },
    evidenceResults: results,
    ...(note ? { note } : {}),
    createdAt,
    assurance: RWP_EVIDENCE_RECEIPT_ASSURANCE
  };
};

export const buildRwpEvidenceReceipt = (evidencePackage, options = {}) => {
  const payload = buildUnsignedReceipt(evidencePackage, options);
  const receiptDigest = keccakUtf8(canonicalizeJson(payload));
  return {
    ...payload,
    receiptId: `rwper:${receiptDigest.slice(2, 18)}`,
    receiptDigest
  };
};

const equalSource = (left, right) => canonicalizeJson(left) === canonicalizeJson(right);

export const validateRwpEvidenceReceipt = (value, evidencePackage) => {
  const errors = [];
  if (!isRecord(value)) return ['Evidence Receipt root must be an object.'];
  if (value.format !== RWP_EVIDENCE_RECEIPT_FORMAT) errors.push(`format must equal ${RWP_EVIDENCE_RECEIPT_FORMAT}.`);
  if (value.version !== RWP_EVIDENCE_RECEIPT_VERSION) errors.push(`version must equal ${RWP_EVIDENCE_RECEIPT_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwper:[0-9a-f]{16}$/.test(value.receiptId ?? '')) errors.push('receiptId is invalid.');
  if (!isBytes32(value.receiptDigest)) errors.push('receiptDigest must be lowercase bytes32 hex.');
  if (!isRecord(value.source)) errors.push('source must be an object.');
  if (!/^rwpep:[0-9a-f]{16}$/.test(value.source?.packageId ?? '')) errors.push('source.packageId is invalid.');
  if (!/^rwpr:[0-9a-f]{16}$/.test(value.source?.requestId ?? '')) errors.push('source.requestId is invalid.');
  if (!/^rwprr:[0-9a-f]{16}$/.test(value.source?.responseId ?? '')) errors.push('source.responseId is invalid.');
  for (const field of ['packageDigest', 'passportDigest', 'cardDigest', 'requestDigest', 'responseDigest']) {
    if (!isBytes32(value.source?.[field])) errors.push(`source.${field} must be lowercase bytes32 hex.`);
  }
  if (!isRecord(value.receiver) || !ROLE_SET.has(value.receiver?.role)) errors.push('receiver.role is unsupported.');
  if (!isRecord(value.outcome) || !OUTCOME_SET.has(value.outcome?.status)) errors.push('outcome.status is unsupported.');
  if (!['received', 'incomplete', 'mismatch'].includes(value.outcome?.deterministicStatus)) errors.push('outcome.deterministicStatus is invalid.');
  if (typeof value.outcome?.packageCoverageComplete !== 'boolean') errors.push('outcome.packageCoverageComplete must be boolean.');
  const counts = value.outcome?.counts;
  if (!isRecord(counts)) errors.push('outcome.counts must be an object.');
  for (const field of ['total', 'matched', 'mismatch', 'missing', 'notChecked', 'unsupportedAlgorithm']) {
    if (!Number.isInteger(counts?.[field]) || counts[field] < 0) errors.push(`outcome.counts.${field} must be a non-negative integer.`);
  }
  if (!Array.isArray(value.evidenceResults) || value.evidenceResults.length < 1) errors.push('evidenceResults must contain at least one item.');
  const evidenceIds = new Set();
  for (const item of Array.isArray(value.evidenceResults) ? value.evidenceResults : []) {
    if (!isRecord(item)) { errors.push('evidenceResults items must be objects.'); continue; }
    if (typeof item.evidenceId !== 'string' || item.evidenceId.length < 1) errors.push('evidenceResults.evidenceId is required.');
    else if (evidenceIds.has(item.evidenceId)) errors.push(`Duplicate evidenceId: ${item.evidenceId}`);
    else evidenceIds.add(item.evidenceId);
    if (typeof item.category !== 'string' || item.category.length < 1) errors.push('evidenceResults.category is required.');
    if (!ITEM_STATUS_SET.has(item.status)) errors.push('evidenceResults.status is unsupported.');
    if (typeof item.algorithm !== 'string' || item.algorithm.length < 1) errors.push('evidenceResults.algorithm is required.');
    if (item.computedDigest !== undefined && !isHex(item.computedDigest)) errors.push('evidenceResults.computedDigest is invalid.');
  }
  const derivedCounts = summarize(Array.isArray(value.evidenceResults) ? value.evidenceResults : []);
  if (isRecord(counts) && canonicalizeJson(counts) !== canonicalizeJson(derivedCounts)) errors.push('outcome.counts does not match evidenceResults.');
  const derivedStatus = value.outcome?.packageCoverageComplete === true && derivedCounts.total > 0 && derivedCounts.matched === derivedCounts.total
    ? 'received'
    : derivedCounts.mismatch > 0
      ? 'mismatch'
      : 'incomplete';
  if (value.outcome?.deterministicStatus !== derivedStatus) errors.push('outcome.deterministicStatus is inconsistent.');
  if (value.outcome?.status !== 'request_more' && value.outcome?.status !== derivedStatus) errors.push('outcome.status is inconsistent.');
  if (value.outcome?.status === 'request_more' && (typeof value.note !== 'string' || value.note.length < 1)) errors.push('request_more requires note.');
  if (value.note !== undefined && (typeof value.note !== 'string' || value.note.length < 1 || value.note.length > MAX_NOTE_LENGTH)) errors.push(`note must contain 1 to ${MAX_NOTE_LENGTH} characters when present.`);
  if (!isDateTime(value.createdAt)) errors.push('createdAt is invalid.');
  if (value.assurance !== RWP_EVIDENCE_RECEIPT_ASSURANCE) errors.push('assurance boundary is missing or changed.');

  if (evidencePackage !== undefined) {
    const packageErrors = validateRwpEvidencePackage(evidencePackage);
    if (packageErrors.length > 0) errors.push(...packageErrors.map((error) => `Evidence Package: ${error}`));
    else {
      if (!equalSource(value.source, sourceFromPackage(evidencePackage))) errors.push('Receipt source does not match the Evidence Package.');
      if (value.outcome?.packageCoverageComplete !== evidencePackage.coverage.complete) errors.push('Receipt package coverage flag does not match the Evidence Package.');
      const expected = new Map(evidencePackage.evidence.map((item) => [item.evidenceId, item]));
      if (expected.size !== evidenceIds.size) errors.push('Receipt evidenceResults must cover every Package evidence record exactly once.');
      for (const item of Array.isArray(value.evidenceResults) ? value.evidenceResults : []) {
        const source = expected.get(item.evidenceId);
        if (!source) errors.push(`Receipt references unknown Package evidence: ${item.evidenceId}`);
        else {
          if (item.category !== source.category) errors.push(`Receipt category does not match Package evidence: ${item.evidenceId}`);
          if (item.algorithm !== source.digest.algorithm) errors.push(`Receipt algorithm does not match Package evidence: ${item.evidenceId}`);
          if (item.status === 'matched' && item.computedDigest !== source.digest.value) errors.push(`Receipt matched digest does not equal Package evidence: ${item.evidenceId}`);
          if (item.status === 'mismatch' && item.computedDigest === source.digest.value) errors.push(`Receipt mismatch digest equals Package evidence: ${item.evidenceId}`);
        }
      }
    }
  }

  if (errors.length === 0) {
    const { receiptId, receiptDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (receiptDigest !== expectedDigest) errors.push('receiptDigest does not match the canonical receipt payload.');
    if (receiptId !== `rwper:${expectedDigest.slice(2, 18)}`) errors.push('receiptId does not match receiptDigest.');
  }
  return errors;
};

export const buildRwpEvidenceReceiptCard = (receipt) => {
  const errors = validateRwpEvidenceReceipt(receipt);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const payload = {
    format: RWP_EVIDENCE_RECEIPT_CARD_FORMAT,
    version: RWP_EVIDENCE_RECEIPT_VERSION,
    domain: 'trade',
    source: {
      packageDigest: receipt.source.packageDigest,
      receiptId: receipt.receiptId,
      receiptDigest: receipt.receiptDigest
    },
    receiverRole: receipt.receiver.role,
    outcome: {
      status: receipt.outcome.status,
      deterministicStatus: receipt.outcome.deterministicStatus,
      packageCoverageComplete: receipt.outcome.packageCoverageComplete,
      counts: receipt.outcome.counts
    },
    createdAt: receipt.createdAt,
    assurance: RWP_EVIDENCE_RECEIPT_CARD_ASSURANCE
  };
  const cardDigest = keccakUtf8(canonicalizeJson(payload));
  return {
    ...payload,
    cardId: `rwperc:${cardDigest.slice(2, 18)}`,
    cardDigest
  };
};

export const validateRwpEvidenceReceiptCard = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['Evidence Receipt Card root must be an object.'];
  if (value.format !== RWP_EVIDENCE_RECEIPT_CARD_FORMAT) errors.push(`format must equal ${RWP_EVIDENCE_RECEIPT_CARD_FORMAT}.`);
  if (value.version !== RWP_EVIDENCE_RECEIPT_VERSION) errors.push(`version must equal ${RWP_EVIDENCE_RECEIPT_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwperc:[0-9a-f]{16}$/.test(value.cardId ?? '')) errors.push('cardId is invalid.');
  if (!isBytes32(value.cardDigest)) errors.push('cardDigest must be lowercase bytes32 hex.');
  if (!isRecord(value.source) || !isBytes32(value.source?.packageDigest) || !isBytes32(value.source?.receiptDigest) || !/^rwper:[0-9a-f]{16}$/.test(value.source?.receiptId ?? '')) errors.push('source is invalid.');
  if (!ROLE_SET.has(value.receiverRole)) errors.push('receiverRole is unsupported.');
  if (!isRecord(value.outcome) || !OUTCOME_SET.has(value.outcome?.status)) errors.push('outcome.status is unsupported.');
  if (!['received', 'incomplete', 'mismatch'].includes(value.outcome?.deterministicStatus)) errors.push('outcome.deterministicStatus is invalid.');
  if (typeof value.outcome?.packageCoverageComplete !== 'boolean') errors.push('outcome.packageCoverageComplete must be boolean.');
  const counts = value.outcome?.counts;
  for (const field of ['total', 'matched', 'mismatch', 'missing', 'notChecked', 'unsupportedAlgorithm']) {
    if (!Number.isInteger(counts?.[field]) || counts[field] < 0) errors.push(`outcome.counts.${field} must be a non-negative integer.`);
  }
  if (!isDateTime(value.createdAt)) errors.push('createdAt is invalid.');
  if (value.assurance !== RWP_EVIDENCE_RECEIPT_CARD_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  const serialized = canonicalizeJson(value);
  if (/evidenceId|computedDigest|fileName|evidence:\/\/|party:|displayName|goodsDescription|proofValue/i.test(serialized)) errors.push('Evidence Receipt Card contains a forbidden private-field marker.');
  if (errors.length === 0) {
    const { cardId, cardDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (cardDigest !== expectedDigest) errors.push('cardDigest does not match the canonical card payload.');
    if (cardId !== `rwperc:${expectedDigest.slice(2, 18)}`) errors.push('cardId does not match cardDigest.');
  }
  return errors;
};

export const encodeRwpEvidenceReceiptCard = (card) => {
  const errors = validateRwpEvidenceReceiptCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(card));
  if (encoded.length > MAX_CARD_PAYLOAD_LENGTH) throw new Error('Evidence Receipt Card exceeds the bounded share-link size.');
  return encoded;
};

export const decodeRwpEvidenceReceiptCard = (payload) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_CARD_PAYLOAD_LENGTH) throw new Error('Evidence Receipt Card payload is missing or too large.');
  const card = JSON.parse(fromBase64Url(payload));
  const errors = validateRwpEvidenceReceiptCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return card;
};

export const buildRwpEvidenceReceiptCardUrl = (card, baseUrl) => {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/[^/]*$/, 'rwp-receive.html');
  url.search = '';
  url.hash = new URLSearchParams({ receipt: encodeRwpEvidenceReceiptCard(card) }).toString();
  return url.toString();
};

export const readRwpEvidenceReceiptCardFromHash = (hash) => {
  const payload = new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get('receipt');
  return payload ? decodeRwpEvidenceReceiptCard(payload) : null;
};
