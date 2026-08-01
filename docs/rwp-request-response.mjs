import { canonicalizeJson, encodeProofCard, validateProofCard } from './rwp-card.mjs';
import { encodeRwpRequest, validateRwpRequest } from './rwp-request.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_REQUEST_RESPONSE_FORMAT = 'real-world-proof-request-response';
export const RWP_REQUEST_RESPONSE_VERSION = '0.1';
export const RWP_REQUEST_RESPONSE_ASSURANCE =
  'This unsigned self-declared response records a bounded decision about an RWP Request. It does not authenticate the responder, disclose source evidence, create legal authority, or prove that off-channel delivery occurred.';

export const RWP_REQUEST_RESPONSE_DECISIONS = Object.freeze([
  'accept',
  'partially_accept',
  'request_clarification',
  'decline'
]);

export const RWP_REQUEST_RESPONSE_MODES = Object.freeze([
  'authorized_off_channel',
  'public_note_only',
  'none'
]);

export const RWP_REQUEST_RESPONSE_CHANNEL_HINTS = Object.freeze([
  'existing_business_channel',
  'secure_data_room',
  'encrypted_email',
  'other'
]);

const MAX_RESPONSE_PAYLOAD_LENGTH = 5000;
const MAX_NOTE_LENGTH = 280;
const DECISION_SET = new Set(RWP_REQUEST_RESPONSE_DECISIONS);
const MODE_SET = new Set(RWP_REQUEST_RESPONSE_MODES);
const CHANNEL_HINT_SET = new Set(RWP_REQUEST_RESPONSE_CHANNEL_HINTS);
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
  if (note.length > MAX_NOTE_LENGTH) throw new Error(`Public response note must be at most ${MAX_NOTE_LENGTH} characters.`);
  return note;
};

const normalizeEvidenceTypes = (values, request) => {
  const requested = new Set(request.evidenceTypes);
  const normalized = [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))].sort();
  for (const value of normalized) {
    if (!requested.has(value)) throw new Error(`Response evidence type was not requested: ${value}`);
  }
  return normalized;
};

const unsignedResponsePayload = (card, request, options = {}) => {
  const cardErrors = validateProofCard(card);
  if (cardErrors.length > 0) throw new Error(cardErrors.join(' '));
  const requestErrors = validateRwpRequest(request);
  if (requestErrors.length > 0) throw new Error(requestErrors.join(' '));
  if (request.source.passportDigest !== card.sourceDigest || request.source.cardDigest !== card.cardDigest) {
    throw new Error('RWP Request source does not match the Proof Card.');
  }

  const status = String(options.status ?? 'accept');
  if (!DECISION_SET.has(status)) throw new Error(`Unsupported response decision: ${status}`);
  const responderRole = String(options.responderRole ?? 'other');
  if (!ROLE_SET.has(responderRole)) throw new Error(`Unsupported responder role: ${responderRole}`);
  const mode = String(options.mode ?? (status === 'decline' ? 'none' : 'authorized_off_channel'));
  if (!MODE_SET.has(mode)) throw new Error(`Unsupported fulfillment mode: ${mode}`);
  const evidenceTypes = normalizeEvidenceTypes(options.evidenceTypes, request);
  const channelHint = options.channelHint ? String(options.channelHint) : undefined;
  if (channelHint && !CHANNEL_HINT_SET.has(channelHint)) throw new Error(`Unsupported channel hint: ${channelHint}`);
  const note = normalizeNote(options.note);

  if (status === 'decline') {
    if (mode !== 'none' || evidenceTypes.length > 0 || channelHint) {
      throw new Error('A declined response must use mode none and offer no evidence category or channel hint.');
    }
  }
  if (status === 'request_clarification') {
    if (mode !== 'public_note_only' || note.length === 0 || evidenceTypes.length > 0 || channelHint) {
      throw new Error('A clarification response requires a public note only and offers no evidence category or channel hint.');
    }
  }
  if (status === 'partially_accept') {
    if (mode === 'none') throw new Error('A partially accepted response requires a fulfillment mode.');
    if (request.evidenceTypes.length > 0 && (evidenceTypes.length === 0 || evidenceTypes.length === request.evidenceTypes.length)) {
      throw new Error('A partial evidence acceptance must offer a non-empty proper subset of requested evidence categories.');
    }
  }
  if (status === 'accept' && mode === 'none') throw new Error('An accepted response requires a fulfillment mode.');
  if (mode === 'authorized_off_channel' && !channelHint) throw new Error('authorized_off_channel requires a channel hint.');
  if (mode !== 'authorized_off_channel' && channelHint) throw new Error('channelHint is only allowed for authorized_off_channel.');
  if (mode === 'public_note_only' && note.length === 0) throw new Error('public_note_only requires a public note.');

  return {
    format: RWP_REQUEST_RESPONSE_FORMAT,
    version: RWP_REQUEST_RESPONSE_VERSION,
    domain: 'trade',
    source: {
      artifactType: 'RealWorldProofRequest',
      passportDigest: card.sourceDigest,
      cardDigest: card.cardDigest,
      requestId: request.requestId,
      requestDigest: request.requestDigest
    },
    decision: { status },
    responder: { role: responderRole },
    fulfillment: {
      mode,
      evidenceTypes,
      ...(channelHint ? { channelHint } : {})
    },
    ...(note ? { note } : {}),
    createdAt: new Date(options.createdAt ?? Date.now()).toISOString(),
    assurance: RWP_REQUEST_RESPONSE_ASSURANCE
  };
};

export const buildRwpRequestResponse = (card, request, options = {}) => {
  const payload = unsignedResponsePayload(card, request, options);
  const responseDigest = keccakUtf8(canonicalizeJson(payload));
  return {
    ...payload,
    responseId: `rwprr:${responseDigest.slice(2, 18)}`,
    responseDigest
  };
};

export const validateRwpRequestResponse = (response, request) => {
  const errors = [];
  if (!isRecord(response)) return ['RWP Request Response root must be an object.'];
  if (response.format !== RWP_REQUEST_RESPONSE_FORMAT) errors.push(`format must equal ${RWP_REQUEST_RESPONSE_FORMAT}.`);
  if (response.version !== RWP_REQUEST_RESPONSE_VERSION) errors.push(`version must equal ${RWP_REQUEST_RESPONSE_VERSION}.`);
  if (response.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwprr:[0-9a-f]{16}$/.test(response.responseId ?? '')) errors.push('responseId is invalid.');
  if (!isBytes32(response.responseDigest)) errors.push('responseDigest must be lowercase bytes32 hex.');
  if (!isRecord(response.source)) errors.push('source must be an object.');
  if (response.source?.artifactType !== 'RealWorldProofRequest') errors.push('source.artifactType must equal RealWorldProofRequest.');
  for (const field of ['passportDigest', 'cardDigest', 'requestDigest']) {
    if (!isBytes32(response.source?.[field])) errors.push(`source.${field} must be lowercase bytes32 hex.`);
  }
  if (!/^rwpr:[0-9a-f]{16}$/.test(response.source?.requestId ?? '')) errors.push('source.requestId is invalid.');
  if (!isRecord(response.decision) || !DECISION_SET.has(response.decision?.status)) errors.push('decision.status is unsupported.');
  if (!isRecord(response.responder) || !ROLE_SET.has(response.responder?.role)) errors.push('responder.role is unsupported.');
  if (!isRecord(response.fulfillment) || !MODE_SET.has(response.fulfillment?.mode)) errors.push('fulfillment.mode is unsupported.');
  const evidenceTypes = response.fulfillment?.evidenceTypes;
  if (!Array.isArray(evidenceTypes)) {
    errors.push('fulfillment.evidenceTypes must be an array.');
  } else if (new Set(evidenceTypes).size !== evidenceTypes.length || [...evidenceTypes].sort().join('|') !== evidenceTypes.join('|')) {
    errors.push('fulfillment.evidenceTypes must be unique and sorted.');
  }
  if (response.fulfillment?.channelHint !== undefined && !CHANNEL_HINT_SET.has(response.fulfillment.channelHint)) {
    errors.push('fulfillment.channelHint is unsupported.');
  }
  if (response.note !== undefined && (typeof response.note !== 'string' || response.note.length < 1 || response.note.length > MAX_NOTE_LENGTH)) {
    errors.push(`note must contain 1 to ${MAX_NOTE_LENGTH} characters when present.`);
  }
  if (!isDateTime(response.createdAt)) errors.push('createdAt is invalid.');
  if (response.assurance !== RWP_REQUEST_RESPONSE_ASSURANCE) errors.push('assurance boundary is missing or changed.');

  const requestErrors = validateRwpRequest(request);
  if (requestErrors.length > 0) errors.push(...requestErrors.map((error) => `request: ${error}`));
  if (requestErrors.length === 0) {
    if (
      response.source?.passportDigest !== request.source.passportDigest ||
      response.source?.cardDigest !== request.source.cardDigest ||
      response.source?.requestId !== request.requestId ||
      response.source?.requestDigest !== request.requestDigest
    ) {
      errors.push('Response source does not match the RWP Request.');
    }
    if (Array.isArray(evidenceTypes) && evidenceTypes.some((value) => !request.evidenceTypes.includes(value))) {
      errors.push('Response offers an evidence category that was not requested.');
    }
  }

  const status = response.decision?.status;
  const mode = response.fulfillment?.mode;
  const channelHint = response.fulfillment?.channelHint;
  if (status === 'decline' && (mode !== 'none' || evidenceTypes?.length > 0 || channelHint)) errors.push('Decline boundary is invalid.');
  if (status === 'request_clarification' && (mode !== 'public_note_only' || !response.note || evidenceTypes?.length > 0 || channelHint)) {
    errors.push('Clarification boundary is invalid.');
  }
  if (status === 'partially_accept' && requestErrors.length === 0 && request.evidenceTypes.length > 0) {
    if (!Array.isArray(evidenceTypes) || evidenceTypes.length === 0 || evidenceTypes.length === request.evidenceTypes.length) {
      errors.push('Partial evidence acceptance must be a non-empty proper subset.');
    }
  }
  if (status === 'accept' && mode === 'none') errors.push('Accept boundary is invalid.');
  if (mode === 'authorized_off_channel' && !channelHint) errors.push('authorized_off_channel requires channelHint.');
  if (mode !== 'authorized_off_channel' && channelHint) errors.push('channelHint is only allowed for authorized_off_channel.');
  if (mode === 'public_note_only' && !response.note) errors.push('public_note_only requires note.');

  if (/party:|evidence:\/\/|displayName|goodsDescription|"statement"|proofValue|@|https?:\/\//i.test(canonicalizeJson(response))) {
    errors.push('RWP Request Response contains a forbidden private or endpoint marker.');
  }

  if (errors.length === 0) {
    const { responseId, responseDigest, ...payload } = response;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (responseDigest !== expectedDigest) errors.push('responseDigest does not match the canonical response payload.');
    if (responseId !== `rwprr:${expectedDigest.slice(2, 18)}`) errors.push('responseId does not match responseDigest.');
  }

  return errors;
};

export const encodeRwpRequestResponse = (response, request) => {
  const errors = validateRwpRequestResponse(response, request);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(response));
  if (encoded.length > MAX_RESPONSE_PAYLOAD_LENGTH) throw new Error('RWP Request Response exceeds the bounded share-link size.');
  return encoded;
};

export const decodeRwpRequestResponse = (payload, request) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_RESPONSE_PAYLOAD_LENGTH) {
    throw new Error('RWP Request Response payload is missing or too large.');
  }
  const response = JSON.parse(fromBase64Url(payload));
  const errors = validateRwpRequestResponse(response, request);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return response;
};

export const buildRwpRequestResponseUrl = (response, request, card, baseUrl) => {
  const cardErrors = validateProofCard(card);
  if (cardErrors.length > 0) throw new Error(cardErrors.join(' '));
  const requestErrors = validateRwpRequest(request);
  if (requestErrors.length > 0) throw new Error(requestErrors.join(' '));
  if (request.source.passportDigest !== card.sourceDigest || request.source.cardDigest !== card.cardDigest) {
    throw new Error('RWP Request source does not match the Proof Card.');
  }
  const responseErrors = validateRwpRequestResponse(response, request);
  if (responseErrors.length > 0) throw new Error(responseErrors.join(' '));

  const url = new URL(baseUrl);
  url.search = '';
  url.pathname = url.pathname.replace(/[^/]*$/, 'rwp-respond.html');
  url.hash = new URLSearchParams({
    card: encodeProofCard(card),
    request: encodeRwpRequest(request),
    response: encodeRwpRequestResponse(response, request)
  }).toString();
  return url.toString();
};

export const readRwpRequestResponseFromHash = (hash, request) => {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const payload = params.get('response');
  return payload ? decodeRwpRequestResponse(payload, request) : null;
};
