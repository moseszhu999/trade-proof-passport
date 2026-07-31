const MAX_RESPONSE_PAYLOAD_LENGTH = 3000;

const ALLOWED_DECISIONS = new Set(['confirm', 'reject', 'request_change']);
const ALLOWED_ROLES = new Set([
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

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function makeResponseId() {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `tpr:${randomPart}`;
}

export function validateResponse(response, sourceSummary) {
  const errors = [];

  if (!isRecord(response)) return ['Response root must be a JSON object.'];
  if (response.schemaVersion !== '0.1') errors.push('schemaVersion must equal "0.1".');
  if (typeof response.responseId !== 'string' || response.responseId.length < 3) {
    errors.push('responseId is required.');
  }

  if (!isRecord(response.passportReference)) {
    errors.push('passportReference must be an object.');
  } else {
    if (!response.passportReference.passportId) errors.push('passportReference.passportId is required.');
    if (!response.passportReference.caseReference) errors.push('passportReference.caseReference is required.');
    if (response.passportReference.sourceSummaryVersion !== '0.1') {
      errors.push('passportReference.sourceSummaryVersion must equal "0.1".');
    }
  }

  if (!isRecord(response.decision)) {
    errors.push('decision must be an object.');
  } else {
    if (!ALLOWED_DECISIONS.has(response.decision.status)) errors.push('decision.status is not supported.');
    if (response.decision.scope !== 'public_summary') errors.push('decision.scope must equal "public_summary".');
    if (response.decision.comment !== undefined && (
      typeof response.decision.comment !== 'string' || response.decision.comment.length > 600
    )) {
      errors.push('decision.comment must be a string of at most 600 characters.');
    }
  }

  if (!isRecord(response.responder) || !ALLOWED_ROLES.has(response.responder.role)) {
    errors.push('responder.role is not supported.');
  }
  if (typeof response.createdAt !== 'string' || Number.isNaN(Date.parse(response.createdAt))) {
    errors.push('createdAt must be an ISO date-time.');
  }
  if (
    !isRecord(response.assurance) ||
    response.assurance.type !== 'unsigned_self_declared' ||
    response.assurance.statement !== "This browser-generated response does not verify the responder's identity, authority, or signature."
  ) {
    errors.push('assurance must declare the unsigned self-declared boundary.');
  }
  if (!isRecord(response.disclosure) || response.disclosure.profile !== 'public_response') {
    errors.push('disclosure.profile must equal "public_response".');
  }

  if (sourceSummary !== undefined) {
    if (!isRecord(sourceSummary) || sourceSummary.format !== 'trade-proof-passport-public-summary') {
      errors.push('A supported source public summary is required.');
    } else if (isRecord(response.passportReference)) {
      if (response.passportReference.passportId !== sourceSummary.passportId) {
        errors.push('Response passportId does not match the source summary.');
      }
      if (response.passportReference.caseReference !== sourceSummary.tradeCase?.caseReference) {
        errors.push('Response caseReference does not match the source summary.');
      }
    }
  }

  return errors;
}

export function buildResponse(summary, input) {
  if (!isRecord(summary) || summary.format !== 'trade-proof-passport-public-summary') {
    throw new Error('A valid Trade Proof Passport public summary is required.');
  }
  if (!isRecord(input)) throw new Error('Response input is required.');
  if (!ALLOWED_DECISIONS.has(input.decision)) throw new Error('Select a supported response decision.');
  if (!ALLOWED_ROLES.has(input.responderRole)) throw new Error('Select a supported responder role.');

  const comment = typeof input.comment === 'string' ? input.comment.trim() : '';
  if (comment.length > 600) throw new Error('The public response comment is longer than 600 characters.');

  const response = {
    schemaVersion: '0.1',
    responseId: makeResponseId(),
    passportReference: {
      passportId: summary.passportId,
      caseReference: summary.tradeCase?.caseReference,
      sourceSummaryVersion: summary.summaryVersion,
      ...(summary.sourceUpdatedAt ? { sourceUpdatedAt: summary.sourceUpdatedAt } : {})
    },
    decision: {
      status: input.decision,
      scope: 'public_summary',
      ...(comment ? { comment } : {})
    },
    responder: { role: input.responderRole },
    createdAt: new Date().toISOString(),
    assurance: {
      type: 'unsigned_self_declared',
      statement: "This browser-generated response does not verify the responder's identity, authority, or signature."
    },
    disclosure: { profile: 'public_response' }
  };

  const errors = validateResponse(response, summary);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return response;
}

export function encodeResponse(response) {
  const errors = validateResponse(response);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(response)));
  if (payload.length > MAX_RESPONSE_PAYLOAD_LENGTH) {
    throw new Error('This response is too large for a bounded response link.');
  }
  return payload;
}

export function decodeResponse(payload) {
  if (typeof payload !== 'string' || payload.length === 0 || payload.length > MAX_RESPONSE_PAYLOAD_LENGTH) {
    throw new Error('The response link is missing or too large.');
  }
  const response = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
  const errors = validateResponse(response);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return response;
}

export function buildResponseUrl(response, baseUrl) {
  const payload = encodeResponse(response);
  const url = new URL(baseUrl);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (!hash.get('p')) throw new Error('The source Passport public summary is missing from this link.');
  hash.set('r', payload);
  url.search = '';
  url.hash = hash.toString();
  return url.toString();
}
