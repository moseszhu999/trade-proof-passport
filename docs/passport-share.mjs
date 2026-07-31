const MAX_SHARE_PAYLOAD_LENGTH = 7000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pickDefined(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
      result[key] = source[key];
    }
  }
  return result;
}

export function validatePassport(passport) {
  const errors = [];

  if (!isRecord(passport)) return ['Passport root must be a JSON object.'];
  if (passport.schemaVersion !== '0.1') errors.push('schemaVersion must equal "0.1".');
  if (typeof passport.passportId !== 'string' || passport.passportId.length < 3) {
    errors.push('passportId is required.');
  }
  if (!isRecord(passport.tradeCase)) {
    errors.push('tradeCase must be an object.');
  } else {
    if (!passport.tradeCase.caseReference) errors.push('tradeCase.caseReference is required.');
    if (!passport.tradeCase.goodsDescription) errors.push('tradeCase.goodsDescription is required.');
  }

  for (const field of ['parties', 'facts', 'evidence', 'confirmations']) {
    if (!Array.isArray(passport[field])) errors.push(`${field} must be an array.`);
  }

  if (!isRecord(passport.lifecycle) || typeof passport.lifecycle.status !== 'string') {
    errors.push('lifecycle.status is required.');
  }
  if (!isRecord(passport.disclosure) || typeof passport.disclosure.profile !== 'string') {
    errors.push('disclosure.profile is required.');
  }

  return errors;
}

export function buildPublicSummary(passport) {
  const errors = validatePassport(passport);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const tradeCase = pickDefined(passport.tradeCase, [
    'caseReference',
    'goodsDescription',
    'batchReference',
    'shipmentReference',
    'quantity',
    'unit'
  ]);

  const facts = passport.facts.map((fact) => pickDefined(fact, [
    'factId',
    'type',
    'statement',
    'status',
    'version',
    'validFrom',
    'validUntil'
  ]));

  const roles = [...new Set(
    passport.parties
      .map((party) => party?.role)
      .filter((role) => typeof role === 'string' && role.length > 0)
  )];

  return {
    format: 'trade-proof-passport-public-summary',
    summaryVersion: '0.1',
    sourceSchemaVersion: passport.schemaVersion,
    passportId: passport.passportId,
    ...(passport.updatedAt ? { sourceUpdatedAt: passport.updatedAt } : {}),
    tradeCase,
    facts,
    counts: {
      parties: passport.parties.length,
      evidence: passport.evidence.length,
      confirmations: passport.confirmations.length
    },
    roles,
    lifecycle: { status: passport.lifecycle.status },
    disclosure: { profile: 'public_summary' }
  };
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

export function encodePublicSummary(summary) {
  if (!isRecord(summary) || summary.format !== 'trade-proof-passport-public-summary') {
    throw new Error('A valid public summary is required.');
  }

  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(summary)));
  if (payload.length > MAX_SHARE_PAYLOAD_LENGTH) {
    throw new Error('This public summary is too large for a bounded share link. Reduce the number or length of facts.');
  }
  return payload;
}

export function decodePublicSummary(payload) {
  if (typeof payload !== 'string' || payload.length === 0 || payload.length > MAX_SHARE_PAYLOAD_LENGTH) {
    throw new Error('The public summary link is missing or too large.');
  }

  const summary = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
  if (!isRecord(summary) || summary.format !== 'trade-proof-passport-public-summary') {
    throw new Error('The link does not contain a Trade Proof Passport public summary.');
  }
  if (summary.summaryVersion !== '0.1' || !isRecord(summary.tradeCase) || !Array.isArray(summary.facts)) {
    throw new Error('The public summary structure is not supported.');
  }
  return summary;
}

export function buildPublicSummaryUrl(passport, baseUrl) {
  const summary = buildPublicSummary(passport);
  const payload = encodePublicSummary(summary);
  const cleanBase = baseUrl.split('#')[0].split('?')[0];
  return `${cleanBase}#p=${payload}`;
}
