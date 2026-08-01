import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_CARD_FORMAT = 'real-world-proof-card';
export const RWP_CARD_VERSION = '0.1';
export const RWP_CARD_ASSURANCE =
  'This privacy-bounded card summarizes proof structure. It does not disclose source documents or prove identity, authority, legal effect, asset ownership, or absolute real-world truth.';

const MAX_CARD_PAYLOAD_LENGTH = 6000;
const ALLOWED_LIFECYCLE = new Set(['draft', 'active', 'superseded', 'expired', 'revoked']);
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

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

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

const normalizeForCanonicalJson = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON does not allow non-finite numbers.');
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeForCanonicalJson);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => {
          if (value[key] === undefined) throw new Error(`Canonical JSON does not allow undefined at ${key}.`);
          return [key, normalizeForCanonicalJson(value[key])];
        })
    );
  }
  throw new Error(`Unsupported canonical JSON value: ${typeof value}`);
};

export const canonicalizeJson = (value) => JSON.stringify(normalizeForCanonicalJson(value));

const requirePassport = (passport) => {
  if (!isRecord(passport) || passport.schemaVersion !== '0.1') {
    throw new Error('A Trade Proof Passport v0.1 object is required.');
  }
  if (typeof passport.passportId !== 'string' || passport.passportId.length < 3) {
    throw new Error('Passport passportId is required.');
  }
  if (!Array.isArray(passport.facts) || !Array.isArray(passport.evidence) || !Array.isArray(passport.confirmations)) {
    throw new Error('Passport facts, evidence and confirmations must be arrays.');
  }
  if (!isRecord(passport.lifecycle) || !ALLOWED_LIFECYCLE.has(passport.lifecycle.status)) {
    throw new Error('Passport lifecycle status is unsupported.');
  }
  if (typeof passport.updatedAt !== 'string' || Number.isNaN(Date.parse(passport.updatedAt))) {
    throw new Error('Passport updatedAt must be a valid date-time.');
  }
  return passport;
};

export const computePassportDigest = (passport) => {
  requirePassport(passport);
  return keccakUtf8(canonicalizeJson(passport));
};

const roleByPartyId = (passport) =>
  new Map(
    (Array.isArray(passport.parties) ? passport.parties : [])
      .filter((party) => isRecord(party) && typeof party.partyId === 'string' && ALLOWED_ROLES.has(party.role))
      .map((party) => [party.partyId, party.role])
  );

const countByStatus = (facts, status) => facts.filter((fact) => fact?.status === status).length;

const publicEvidenceCount = (evidence) =>
  evidence.filter((item) => item?.disclosure === 'public_summary').length;

const reviewedProvenanceCount = (provenance) =>
  provenance.filter(
    (item) => isRecord(item?.review) && typeof item.review.reviewedBy === 'string' && !Number.isNaN(Date.parse(item.review.reviewedAt))
  ).length;

const normalizePublicLabel = (value) => {
  const label = typeof value === 'string' ? value.trim() : '';
  if (label.length === 0) return 'Private trade proof';
  if (label.length > 96) throw new Error('Public label must be at most 96 characters.');
  return label;
};

const unsignedCardPayload = (passport, publicLabel) => {
  const sourceDigest = computePassportDigest(passport);
  const facts = passport.facts;
  const evidence = passport.evidence;
  const confirmations = passport.confirmations;
  const provenance = Array.isArray(passport.provenance) ? passport.provenance : [];
  const roles = roleByPartyId(passport);
  const confirmedRoles = [...new Set(
    confirmations
      .filter((item) => item?.decision === 'confirm')
      .map((item) => roles.get(item?.partyId))
      .filter(Boolean)
  )].sort();
  const respondedRoles = [...new Set(
    confirmations.map((item) => roles.get(item?.partyId)).filter(Boolean)
  )].sort();

  return {
    format: RWP_CARD_FORMAT,
    version: RWP_CARD_VERSION,
    domain: 'trade',
    publicLabel: normalizePublicLabel(publicLabel),
    sourceArtifactType: 'TradeProofPassport',
    sourceDigest,
    lifecycleStatus: passport.lifecycle.status,
    updatedAt: new Date(passport.updatedAt).toISOString(),
    claims: {
      total: facts.length,
      evidenceBacked: facts.filter((fact) => Array.isArray(fact?.evidenceRefs) && fact.evidenceRefs.length > 0).length,
      confirmed: countByStatus(facts, 'confirmed'),
      disputed: countByStatus(facts, 'disputed'),
      revoked: countByStatus(facts, 'revoked')
    },
    evidence: {
      total: evidence.length,
      publicSummary: publicEvidenceCount(evidence)
    },
    provenance: {
      total: provenance.length,
      reviewed: reviewedProvenanceCount(provenance),
      coveredClaims: facts.filter((fact) => Array.isArray(fact?.provenanceRefs) && fact.provenanceRefs.length > 0).length
    },
    confirmations: {
      total: confirmations.length,
      confirmedRoles,
      respondedRoles
    },
    assurance: RWP_CARD_ASSURANCE,
    callToAction: 'Inspect the proof pattern, request authorized evidence, then create your own Real-World Proof.'
  };
};

export const buildProofCard = (passport, options = {}) => {
  requirePassport(passport);
  const payload = unsignedCardPayload(passport, options.publicLabel);
  return {
    ...payload,
    cardDigest: keccakUtf8(canonicalizeJson(payload))
  };
};

export const validateProofCard = (card) => {
  const errors = [];
  if (!isRecord(card)) return ['Proof Card root must be an object.'];
  if (card.format !== RWP_CARD_FORMAT) errors.push(`format must equal ${RWP_CARD_FORMAT}.`);
  if (card.version !== RWP_CARD_VERSION) errors.push(`version must equal ${RWP_CARD_VERSION}.`);
  if (card.domain !== 'trade') errors.push('domain must equal trade.');
  if (typeof card.publicLabel !== 'string' || card.publicLabel.length < 1 || card.publicLabel.length > 96) {
    errors.push('publicLabel must contain 1 to 96 characters.');
  }
  if (!/^0x[0-9a-f]{64}$/.test(card.sourceDigest ?? '')) errors.push('sourceDigest must be lowercase bytes32 hex.');
  if (!/^0x[0-9a-f]{64}$/.test(card.cardDigest ?? '')) errors.push('cardDigest must be lowercase bytes32 hex.');
  if (!ALLOWED_LIFECYCLE.has(card.lifecycleStatus)) errors.push('lifecycleStatus is unsupported.');
  if (typeof card.updatedAt !== 'string' || Number.isNaN(Date.parse(card.updatedAt))) errors.push('updatedAt is invalid.');
  if (card.assurance !== RWP_CARD_ASSURANCE) errors.push('assurance boundary is missing or changed.');

  for (const group of ['claims', 'evidence', 'provenance', 'confirmations']) {
    if (!isRecord(card[group])) errors.push(`${group} must be an object.`);
  }
  for (const [group, fields] of Object.entries({
    claims: ['total', 'evidenceBacked', 'confirmed', 'disputed', 'revoked'],
    evidence: ['total', 'publicSummary'],
    provenance: ['total', 'reviewed', 'coveredClaims'],
    confirmations: ['total']
  })) {
    for (const field of fields) {
      const value = card[group]?.[field];
      if (!Number.isInteger(value) || value < 0) errors.push(`${group}.${field} must be a non-negative integer.`);
    }
  }
  for (const field of ['confirmedRoles', 'respondedRoles']) {
    const values = card.confirmations?.[field];
    if (!Array.isArray(values) || values.some((role) => !ALLOWED_ROLES.has(role))) {
      errors.push(`confirmations.${field} contains an unsupported role.`);
    } else if (new Set(values).size !== values.length || [...values].sort().join('|') !== values.join('|')) {
      errors.push(`confirmations.${field} must be unique and sorted.`);
    }
  }

  if (/party:|evidence:\/\/|sha256|displayName|goodsDescription|statement|note/i.test(canonicalizeJson(card))) {
    errors.push('Proof Card contains a forbidden private-field marker.');
  }

  if (errors.length === 0) {
    const { cardDigest, ...payload } = card;
    const expected = keccakUtf8(canonicalizeJson(payload));
    if (cardDigest !== expected) errors.push('cardDigest does not match the canonical card payload.');
  }
  return errors;
};

export const encodeProofCard = (card) => {
  const errors = validateProofCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(card));
  if (encoded.length > MAX_CARD_PAYLOAD_LENGTH) throw new Error('Proof Card exceeds the bounded share-link size.');
  return encoded;
};

export const decodeProofCard = (payload) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_CARD_PAYLOAD_LENGTH) {
    throw new Error('Proof Card payload is missing or too large.');
  }
  const card = JSON.parse(fromBase64Url(payload));
  const errors = validateProofCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return card;
};

export const buildProofCardUrl = (card, baseUrl) => {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = new URLSearchParams({ card: encodeProofCard(card) }).toString();
  return url.toString();
};

export const readProofCardFromHash = (hash) => {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const payload = params.get('card');
  return payload ? decodeProofCard(payload) : null;
};
