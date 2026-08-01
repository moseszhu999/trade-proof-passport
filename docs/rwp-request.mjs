import { canonicalizeJson, encodeProofCard, validateProofCard } from './rwp-card.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_REQUEST_FORMAT = 'real-world-proof-request';
export const RWP_REQUEST_VERSION = '0.1';
export const RWP_REQUEST_ASSURANCE =
  'This unsigned self-declared request identifies a requested action and source digests. It does not verify requester identity or authority, grant access, disclose evidence, or change the source proof.';

export const RWP_REQUEST_ACTIONS = Object.freeze([
  'request_authorized_evidence',
  'request_responsible_confirmation',
  'request_change'
]);

export const RWP_REQUEST_EVIDENCE_TYPES = Object.freeze([
  'bill_of_lading',
  'commercial_invoice',
  'customs_record',
  'inspection_report',
  'insurance_record',
  'logistics_event',
  'packing_list',
  'purchase_order',
  'warehouse_receipt',
  'other'
]);

const MAX_REQUEST_PAYLOAD_LENGTH = 5000;
const MAX_NOTE_LENGTH = 280;
const REQUEST_ACTION_SET = new Set(RWP_REQUEST_ACTIONS);
const EVIDENCE_TYPE_SET = new Set(RWP_REQUEST_EVIDENCE_TYPES);
const ROLE_SET = new Set([
  'exporter',
  'buyer',
  'supplier',
  'manufacturer',
  'inspection',
  'logistics',
  'warehouse',
  'customs',
  'insurance',
  'legal',
  'funder',
  'other'
]);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBytes32 = (value) => /^0x[0-9a-f]{64}$/.test(value ?? '');
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
  if (note.length > MAX_NOTE_LENGTH) throw new Error(`Public request note must be at most ${MAX_NOTE_LENGTH} characters.`);
  return note;
};

const normalizeEvidenceTypes = (values) => {
  if (!Array.isArray(values)) return [];
  const normalized = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort();
  for (const value of normalized) {
    if (!EVIDENCE_TYPE_SET.has(value)) throw new Error(`Unsupported requested evidence type: ${value}`);
  }
  return normalized;
};

const unsignedRequestPayload = (card, options = {}) => {
  const cardErrors = validateProofCard(card);
  if (cardErrors.length > 0) throw new Error(cardErrors.join(' '));

  const requestedAction = String(options.requestedAction ?? 'request_authorized_evidence');
  if (!REQUEST_ACTION_SET.has(requestedAction)) throw new Error(`Unsupported requested action: ${requestedAction}`);

  const requesterRole = String(options.requesterRole ?? 'other');
  if (!ROLE_SET.has(requesterRole)) throw new Error(`Unsupported requester role: ${requesterRole}`);

  const createdAt = new Date(options.createdAt ?? Date.now()).toISOString();
  const note = normalizeNote(options.note);

  return {
    format: RWP_REQUEST_FORMAT,
    version: RWP_REQUEST_VERSION,
    domain: 'trade',
    source: {
      artifactType: 'RealWorldProofCard',
      passportDigest: card.sourceDigest,
      cardDigest: card.cardDigest
    },
    requestedAction,
    requester: { role: requesterRole },
    evidenceTypes: normalizeEvidenceTypes(options.evidenceTypes),
    ...(note ? { note } : {}),
    createdAt,
    assurance: RWP_REQUEST_ASSURANCE
  };
};

export const buildRwpRequest = (card, options = {}) => {
  const payload = unsignedRequestPayload(card, options);
  const requestDigest = keccakUtf8(canonicalizeJson(payload));
  return {
    ...payload,
    requestId: `rwpr:${requestDigest.slice(2, 18)}`,
    requestDigest
  };
};

export const validateRwpRequest = (request) => {
  const errors = [];
  if (!isRecord(request)) return ['RWP Request root must be an object.'];
  if (request.format !== RWP_REQUEST_FORMAT) errors.push(`format must equal ${RWP_REQUEST_FORMAT}.`);
  if (request.version !== RWP_REQUEST_VERSION) errors.push(`version must equal ${RWP_REQUEST_VERSION}.`);
  if (request.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwpr:[0-9a-f]{16}$/.test(request.requestId ?? '')) errors.push('requestId is invalid.');
  if (!isBytes32(request.requestDigest)) errors.push('requestDigest must be lowercase bytes32 hex.');
  if (!isRecord(request.source)) errors.push('source must be an object.');
  if (request.source?.artifactType !== 'RealWorldProofCard') errors.push('source.artifactType must equal RealWorldProofCard.');
  if (!isBytes32(request.source?.passportDigest)) errors.push('source.passportDigest must be lowercase bytes32 hex.');
  if (!isBytes32(request.source?.cardDigest)) errors.push('source.cardDigest must be lowercase bytes32 hex.');
  if (!REQUEST_ACTION_SET.has(request.requestedAction)) errors.push('requestedAction is unsupported.');
  if (!isRecord(request.requester) || !ROLE_SET.has(request.requester?.role)) errors.push('requester.role is unsupported.');
  if (!Array.isArray(request.evidenceTypes)) {
    errors.push('evidenceTypes must be an array.');
  } else if (
    request.evidenceTypes.some((value) => !EVIDENCE_TYPE_SET.has(value)) ||
    new Set(request.evidenceTypes).size !== request.evidenceTypes.length ||
    [...request.evidenceTypes].sort().join('|') !== request.evidenceTypes.join('|')
  ) {
    errors.push('evidenceTypes must contain unique, sorted, supported values.');
  }
  if (request.note !== undefined && (typeof request.note !== 'string' || request.note.length < 1 || request.note.length > MAX_NOTE_LENGTH)) {
    errors.push(`note must contain 1 to ${MAX_NOTE_LENGTH} characters when present.`);
  }
  if (!isDateTime(request.createdAt)) errors.push('createdAt is invalid.');
  if (request.assurance !== RWP_REQUEST_ASSURANCE) errors.push('assurance boundary is missing or changed.');

  if (/party:|evidence:\/\/|displayName|goodsDescription|"statement"|proofValue/i.test(canonicalizeJson(request))) {
    errors.push('RWP Request contains a forbidden private-field marker.');
  }

  if (errors.length === 0) {
    const { requestId, requestDigest, ...payload } = request;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (requestDigest !== expectedDigest) errors.push('requestDigest does not match the canonical request payload.');
    if (requestId !== `rwpr:${expectedDigest.slice(2, 18)}`) errors.push('requestId does not match requestDigest.');
  }

  return errors;
};

export const encodeRwpRequest = (request) => {
  const errors = validateRwpRequest(request);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(request));
  if (encoded.length > MAX_REQUEST_PAYLOAD_LENGTH) throw new Error('RWP Request exceeds the bounded share-link size.');
  return encoded;
};

export const decodeRwpRequest = (payload) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_REQUEST_PAYLOAD_LENGTH) {
    throw new Error('RWP Request payload is missing or too large.');
  }
  const request = JSON.parse(fromBase64Url(payload));
  const errors = validateRwpRequest(request);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return request;
};

export const buildRwpRequestUrl = (request, card, baseUrl) => {
  const cardErrors = validateProofCard(card);
  if (cardErrors.length > 0) throw new Error(cardErrors.join(' '));
  const requestErrors = validateRwpRequest(request);
  if (requestErrors.length > 0) throw new Error(requestErrors.join(' '));
  if (request.source.passportDigest !== card.sourceDigest || request.source.cardDigest !== card.cardDigest) {
    throw new Error('RWP Request source does not match the Proof Card.');
  }

  const url = new URL(baseUrl);
  url.search = '';
  url.hash = new URLSearchParams({
    card: encodeProofCard(card),
    request: encodeRwpRequest(request)
  }).toString();
  return url.toString();
};

export const readRwpRequestFromHash = (hash) => {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const payload = params.get('request');
  return payload ? decodeRwpRequest(payload) : null;
};

export const buildFollowUpLineage = (card, options = {}) => {
  const errors = validateProofCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const requestDigest = options.requestDigest;
  if (requestDigest !== undefined && !isBytes32(requestDigest)) throw new Error('requestDigest must be lowercase bytes32 hex.');
  return {
    relation: 'reuses_pattern_from',
    sourceArtifactType: 'RealWorldProofCard',
    sourceDigest: card.sourceDigest,
    sourceCardDigest: card.cardDigest,
    ...(requestDigest ? { sourceRequestDigest: requestDigest } : {}),
    recordedAt: new Date(options.recordedAt ?? Date.now()).toISOString()
  };
};
