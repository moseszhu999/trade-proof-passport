import { canonicalizeJson } from './rwp-card.mjs';
import {
  RWP_POOL_ADOPTION_CARD_FORMAT,
  validateRwpPoolAdoptionCard
} from './rwp-pool-adoption.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_PROOF_LIQUIDITY_SNAPSHOT_FORMAT = 'real-world-proof-liquidity-snapshot';
export const RWP_PROOF_LIQUIDITY_CARD_FORMAT = 'real-world-proof-liquidity-snapshot-card';
export const RWP_PROOF_LIQUIDITY_VERSION = '0.1';

export const RWP_PROOF_LIQUIDITY_SNAPSHOT_ASSURANCE =
  'This deterministic snapshot aggregates validated public Pool Adoption Cards for one Trade Pool. One proof-liquidity unit requires one unique independent Passport root with a full-artifact verified adoption. Duplicate Passport, Graph, Receipt or Adoption Card submissions do not increase the unit count. This is not financial liquidity, identity verification, legal approval, credit scoring, Token entitlement, or proof of absolute truth.';

export const RWP_PROOF_LIQUIDITY_CARD_ASSURANCE =
  'This privacy-bounded public card summarizes one deterministic Proof Liquidity Snapshot. It exposes aggregate verified-adoption counts and the Snapshot digest only. It does not expose adopter identities, Passport IDs, Evidence IDs, source files, evidence digests, trade facts, delivery endpoints, or confidential business content.';

const MAX_INPUT_CARDS = 50;
const MAX_SHARE_PAYLOAD_LENGTH = 7000;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isBytes32 = (value) => /^0x[0-9a-f]{64}$/.test(value ?? '');
const isDateTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const safeInteger = (value) => Number.isInteger(value) && value >= 0;
const forbiddenPrivateMarker = (value) =>
  /party:|evidence:\/\/|"evidenceId"|"fileName"|"displayName"|"goodsDescription"|"computedDigest"|"deliveryEndpoint"|"passportId"|"statement"|"proofValue"|bankAccount|unitPrice/i.test(value);

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

const compareCards = (left, right) =>
  left.source.passportDigest.localeCompare(right.source.passportDigest) ||
  left.source.graphDigest.localeCompare(right.source.graphDigest) ||
  left.source.receiptDigest.localeCompare(right.source.receiptDigest) ||
  left.cardDigest.localeCompare(right.cardDigest);

const normalizeCards = (cards) => {
  if (!Array.isArray(cards) || cards.length < 1) throw new Error('At least one Pool Adoption Card is required.');
  if (cards.length > MAX_INPUT_CARDS) throw new Error(`A Proof Liquidity Snapshot accepts at most ${MAX_INPUT_CARDS} Adoption Cards.`);
  const normalized = cards.map((card) => structuredClone(card));
  for (const card of normalized) {
    const errors = validateRwpPoolAdoptionCard(card);
    if (errors.length > 0) throw new Error(errors.join(' '));
  }
  normalized.sort(compareCards);
  return normalized;
};

const assertSinglePool = (cards) => {
  const first = cards[0];
  for (const card of cards) {
    if (card.source.poolId !== first.source.poolId || card.source.poolDigest !== first.source.poolDigest) {
      throw new Error('All Adoption Cards in one Proof Liquidity Snapshot must reference the same Trade Pool.');
    }
    if (
      card.pool.label !== first.pool.label ||
      card.pool.scope !== first.pool.scope ||
      card.pool.generation !== first.pool.generation
    ) throw new Error('Adoption Card Pool metadata is inconsistent.');
  }
  return {
    poolId: first.source.poolId,
    poolDigest: first.source.poolDigest,
    label: first.pool.label,
    scope: first.pool.scope,
    generation: first.pool.generation
  };
};

const classifyCards = (cards) => {
  const seen = {
    cardDigest: new Set(),
    receiptDigest: new Set(),
    graphDigest: new Set(),
    passportDigest: new Set()
  };
  const included = [];
  const excluded = [];
  for (const card of cards) {
    const duplicateOf = [];
    if (seen.cardDigest.has(card.cardDigest)) duplicateOf.push('card');
    if (seen.receiptDigest.has(card.source.receiptDigest)) duplicateOf.push('receipt');
    if (seen.graphDigest.has(card.source.graphDigest)) duplicateOf.push('graph');
    if (seen.passportDigest.has(card.source.passportDigest)) duplicateOf.push('passport');
    if (duplicateOf.length > 0) {
      excluded.push({
        cardId: card.cardId,
        cardDigest: card.cardDigest,
        reason: 'duplicate_submission',
        duplicateOf
      });
      continue;
    }
    seen.cardDigest.add(card.cardDigest);
    seen.receiptDigest.add(card.source.receiptDigest);
    seen.graphDigest.add(card.source.graphDigest);
    seen.passportDigest.add(card.source.passportDigest);
    included.push({
      cardId: card.cardId,
      cardDigest: card.cardDigest,
      receiptDigest: card.source.receiptDigest,
      graphDigest: card.source.graphDigest,
      passportDigest: card.source.passportDigest,
      createdAt: card.createdAt,
      adoptionStatus: card.adoptionStatus,
      proofLiquidityEligible: card.proofLiquidityEligible,
      observability: card.observability,
      currentState: card.currentState
    });
  }
  return { included, excluded };
};

const summarize = (cards, included, excluded) => {
  const verified = included.filter((item) =>
    item.proofLiquidityEligible === true &&
    item.adoptionStatus === 'verified_adoption' &&
    item.observability === 'full_artifact_bundle'
  );
  const partial = included.filter((item) => item.adoptionStatus === 'partial_adoption');
  const notAdopted = included.filter((item) => item.adoptionStatus === 'not_adopted');
  const timestamps = included.map((item) => item.createdAt).sort();
  return {
    submittedCards: cards.length,
    uniqueCards: included.length,
    verifiedAdoptionUnits: verified.length,
    partialAdoptions: partial.length,
    notAdopted: notAdopted.length,
    excludedDuplicates: excluded.length,
    fullArtifactVerified: verified.length,
    firstAdoptionAt: timestamps[0],
    lastAdoptionAt: timestamps.at(-1)
  };
};

const buildSnapshotPayload = (inputCards) => {
  const cards = normalizeCards(inputCards);
  const pool = assertSinglePool(cards);
  const { included, excluded } = classifyCards(cards);
  const summary = summarize(cards, included, excluded);
  return {
    format: RWP_PROOF_LIQUIDITY_SNAPSHOT_FORMAT,
    version: RWP_PROOF_LIQUIDITY_VERSION,
    domain: 'trade',
    pool,
    inputs: { adoptionCards: cards },
    included,
    excluded,
    summary,
    projectedAt: summary.lastAdoptionAt,
    assurance: RWP_PROOF_LIQUIDITY_SNAPSHOT_ASSURANCE
  };
};

export const buildRwpProofLiquiditySnapshot = (cards) => {
  const payload = buildSnapshotPayload(cards);
  const snapshotDigest = keccakUtf8(canonicalizeJson(payload));
  return {
    ...payload,
    snapshotId: `rwppls:${snapshotDigest.slice(2, 18)}`,
    snapshotDigest
  };
};

export const validateRwpProofLiquiditySnapshot = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Proof Liquidity Snapshot root must be an object.'];
  if (value.format !== RWP_PROOF_LIQUIDITY_SNAPSHOT_FORMAT) errors.push(`format must equal ${RWP_PROOF_LIQUIDITY_SNAPSHOT_FORMAT}.`);
  if (value.version !== RWP_PROOF_LIQUIDITY_VERSION) errors.push(`version must equal ${RWP_PROOF_LIQUIDITY_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwppls:[0-9a-f]{16}$/.test(value.snapshotId ?? '')) errors.push('snapshotId is invalid.');
  if (!isBytes32(value.snapshotDigest)) errors.push('snapshotDigest is invalid.');
  if (!isRecord(value.pool) || !/^rwppool:[0-9a-f]{16}$/.test(value.pool?.poolId ?? '')) errors.push('pool metadata is invalid.');
  if (!isBytes32(value.pool?.poolDigest)) errors.push('pool.poolDigest is invalid.');
  if (!Array.isArray(value.inputs?.adoptionCards) || value.inputs.adoptionCards.length < 1 || value.inputs.adoptionCards.length > MAX_INPUT_CARDS) errors.push('inputs.adoptionCards is invalid.');
  if (!Array.isArray(value.included)) errors.push('included must be an array.');
  if (!Array.isArray(value.excluded)) errors.push('excluded must be an array.');
  if (!isRecord(value.summary)) errors.push('summary is required.');
  else {
    for (const field of ['submittedCards', 'uniqueCards', 'verifiedAdoptionUnits', 'partialAdoptions', 'notAdopted', 'excludedDuplicates', 'fullArtifactVerified']) {
      if (!safeInteger(value.summary[field])) errors.push(`summary.${field} is invalid.`);
    }
    if (!isDateTime(value.summary.firstAdoptionAt) || !isDateTime(value.summary.lastAdoptionAt)) errors.push('summary adoption dates are invalid.');
  }
  if (!isDateTime(value.projectedAt) || value.projectedAt !== value.summary?.lastAdoptionAt) errors.push('projectedAt must equal summary.lastAdoptionAt.');
  if (value.assurance !== RWP_PROOF_LIQUIDITY_SNAPSHOT_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (forbiddenPrivateMarker(canonicalizeJson({ pool: value.pool, included: value.included, excluded: value.excluded, summary: value.summary }))) {
    errors.push('Proof Liquidity Snapshot public projection contains a forbidden private-field marker.');
  }
  if (errors.length === 0) {
    try {
      const rebuilt = buildRwpProofLiquiditySnapshot(value.inputs.adoptionCards);
      if (canonicalizeJson(value) !== canonicalizeJson(rebuilt)) errors.push('Snapshot does not match deterministic reconstruction from Adoption Cards.');
    } catch (error) {
      errors.push(error.message);
    }
  }
  return errors;
};

export const buildRwpProofLiquidityCard = (snapshot) => {
  const errors = validateRwpProofLiquiditySnapshot(snapshot);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const payload = {
    format: RWP_PROOF_LIQUIDITY_CARD_FORMAT,
    version: RWP_PROOF_LIQUIDITY_VERSION,
    domain: 'trade',
    source: {
      snapshotId: snapshot.snapshotId,
      snapshotDigest: snapshot.snapshotDigest,
      poolId: snapshot.pool.poolId,
      poolDigest: snapshot.pool.poolDigest
    },
    pool: {
      label: snapshot.pool.label,
      scope: snapshot.pool.scope,
      generation: snapshot.pool.generation
    },
    units: {
      verifiedAdoptionUnits: snapshot.summary.verifiedAdoptionUnits,
      uniqueCards: snapshot.summary.uniqueCards,
      excludedDuplicates: snapshot.summary.excludedDuplicates,
      partialAdoptions: snapshot.summary.partialAdoptions,
      notAdopted: snapshot.summary.notAdopted
    },
    firstAdoptionAt: snapshot.summary.firstAdoptionAt,
    lastAdoptionAt: snapshot.summary.lastAdoptionAt,
    assurance: RWP_PROOF_LIQUIDITY_CARD_ASSURANCE
  };
  const cardDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, cardId: `rwpplcard:${cardDigest.slice(2, 18)}`, cardDigest };
};

export const validateRwpProofLiquidityCard = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Proof Liquidity Card root must be an object.'];
  if (value.format !== RWP_PROOF_LIQUIDITY_CARD_FORMAT) errors.push(`format must equal ${RWP_PROOF_LIQUIDITY_CARD_FORMAT}.`);
  if (value.version !== RWP_PROOF_LIQUIDITY_VERSION) errors.push(`version must equal ${RWP_PROOF_LIQUIDITY_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwpplcard:[0-9a-f]{16}$/.test(value.cardId ?? '')) errors.push('cardId is invalid.');
  if (!isBytes32(value.cardDigest)) errors.push('cardDigest is invalid.');
  if (!isRecord(value.source) || !/^rwppls:[0-9a-f]{16}$/.test(value.source?.snapshotId ?? '')) errors.push('source is invalid.');
  for (const field of ['snapshotDigest', 'poolDigest']) if (!isBytes32(value.source?.[field])) errors.push(`source.${field} is invalid.`);
  if (!/^rwppool:[0-9a-f]{16}$/.test(value.source?.poolId ?? '')) errors.push('source.poolId is invalid.');
  if (!isRecord(value.pool) || typeof value.pool?.label !== 'string' || value.pool.label.length < 1 || value.pool.label.length > 96) errors.push('pool metadata is invalid.');
  if (!['trade_corridor', 'industry', 'workflow', 'other'].includes(value.pool?.scope)) errors.push('pool.scope is invalid.');
  if (!safeInteger(value.pool?.generation)) errors.push('pool.generation is invalid.');
  if (!isRecord(value.units)) errors.push('units is required.');
  else for (const field of ['verifiedAdoptionUnits', 'uniqueCards', 'excludedDuplicates', 'partialAdoptions', 'notAdopted']) if (!safeInteger(value.units[field])) errors.push(`units.${field} is invalid.`);
  if (!isDateTime(value.firstAdoptionAt) || !isDateTime(value.lastAdoptionAt)) errors.push('adoption dates are invalid.');
  if (value.assurance !== RWP_PROOF_LIQUIDITY_CARD_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (forbiddenPrivateMarker(canonicalizeJson(value))) errors.push('Proof Liquidity Card contains a forbidden private-field marker.');
  if (errors.length === 0) {
    const { cardId, cardDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (cardDigest !== expectedDigest) errors.push('cardDigest does not match the canonical public card payload.');
    if (cardId !== `rwpplcard:${expectedDigest.slice(2, 18)}`) errors.push('cardId does not match cardDigest.');
  }
  return errors;
};

export const encodeRwpProofLiquidityCard = (card) => {
  const errors = validateRwpProofLiquidityCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(card));
  if (encoded.length > MAX_SHARE_PAYLOAD_LENGTH) throw new Error('Proof Liquidity Card exceeds the bounded share-link size.');
  return encoded;
};

export const decodeRwpProofLiquidityCard = (payload) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_SHARE_PAYLOAD_LENGTH) throw new Error('Proof Liquidity Card payload is missing or too large.');
  const card = JSON.parse(fromBase64Url(payload));
  const errors = validateRwpProofLiquidityCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return card;
};

export const buildRwpProofLiquidityCardUrl = (card, baseUrl) => {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/[^/]*$/, 'rwp-liquidity.html');
  url.search = '';
  url.hash = new URLSearchParams({ liquidity: encodeRwpProofLiquidityCard(card) }).toString();
  return url.toString();
};

export const readRwpProofLiquidityCardFromHash = (hash) => {
  const payload = new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get('liquidity');
  return payload ? decodeRwpProofLiquidityCard(payload) : null;
};
