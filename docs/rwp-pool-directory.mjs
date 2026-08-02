import { canonicalizeJson } from './rwp-card.mjs';
import { validateRwpTradePool } from './rwp-proof-pool.mjs';
import { validateRwpProofLiquidityCard } from './rwp-proof-liquidity.mjs';
import { keccakUtf8 } from './season-allocation.mjs';

export const RWP_POOL_DIRECTORY_FORMAT = 'real-world-proof-pool-directory';
export const RWP_POOL_DIRECTORY_CARD_FORMAT = 'real-world-proof-pool-directory-card';
export const RWP_POOL_DIRECTORY_VERSION = '0.1';
export const RWP_POOL_DIRECTORY_SCOPES = Object.freeze([
  'community',
  'trade_corridor',
  'industry',
  'workflow',
  'other'
]);

export const RWP_POOL_DIRECTORY_ASSURANCE =
  'This open self-declared Directory curates validated public Trade Pools and optional matching Proof Liquidity Cards. Inclusion is not endorsement, ranking, legal approval, identity verification, credit scoring, Token entitlement, RWA issuance, or proof of absolute real-world truth.';

export const RWP_POOL_DIRECTORY_CARD_ASSURANCE =
  'This privacy-bounded public Directory Card projects Pool labels, scopes, generations, canonical digests, optional aggregate Proof Liquidity summaries, and Directory lineage only. It does not contain source Passports, participant identities, Evidence IDs, files, evidence digests, trade facts, delivery endpoints, or confidential business content.';

const DIRECTORY_SCOPE_SET = new Set(RWP_POOL_DIRECTORY_SCOPES);
const MAX_ENTRIES = 12;
const MAX_LABEL_LENGTH = 96;
const MAX_SUMMARY_LENGTH = 280;
const MAX_NOTE_LENGTH = 160;
const MAX_CARD_PAYLOAD_LENGTH = 22000;
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

const normalizeText = (value, field, maximum, { required = false } = {}) => {
  const text = String(value ?? '').trim();
  if (required && text.length < 1) throw new Error(`${field} is required.`);
  if (text.length > maximum) throw new Error(`${field} must be at most ${maximum} characters.`);
  if (forbiddenPrivateMarker(text)) throw new Error(`${field} contains a forbidden private-field marker.`);
  return text;
};

const assertLiquidityMatchesPool = (card, pool) => {
  const errors = validateRwpProofLiquidityCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  if (card.source.poolId !== pool.poolId || card.source.poolDigest !== pool.poolDigest) {
    throw new Error('Proof Liquidity Card does not reference the Directory entry Trade Pool.');
  }
  if (
    card.pool.label !== pool.label ||
    card.pool.scope !== pool.scope ||
    card.pool.generation !== pool.lineage.generation
  ) throw new Error('Proof Liquidity Card Pool metadata does not match the Directory entry Trade Pool.');
};

const normalizeEntries = (inputEntries) => {
  if (!Array.isArray(inputEntries) || inputEntries.length < 1) throw new Error('A Pool Directory requires at least one entry.');
  if (inputEntries.length > MAX_ENTRIES) throw new Error(`A Pool Directory accepts at most ${MAX_ENTRIES} entries.`);
  const entries = inputEntries.map((input) => {
    const pool = structuredClone(input?.pool ?? input);
    const poolErrors = validateRwpTradePool(pool);
    if (poolErrors.length > 0) throw new Error(poolErrors.join(' '));
    const liquidityCard = input?.liquidityCard ? structuredClone(input.liquidityCard) : undefined;
    if (liquidityCard) assertLiquidityMatchesPool(liquidityCard, pool);
    const curatorNote = normalizeText(input?.curatorNote, 'curatorNote', MAX_NOTE_LENGTH);
    return {
      pool,
      ...(liquidityCard ? { liquidityCard } : {}),
      ...(curatorNote ? { curatorNote } : {})
    };
  });
  entries.sort((left, right) => left.pool.poolDigest.localeCompare(right.pool.poolDigest));
  const poolIds = new Set();
  const poolDigests = new Set();
  for (const entry of entries) {
    if (poolIds.has(entry.pool.poolId)) throw new Error(`Duplicate Pool ID in Directory: ${entry.pool.poolId}`);
    if (poolDigests.has(entry.pool.poolDigest)) throw new Error(`Duplicate Pool digest in Directory: ${entry.pool.poolDigest}`);
    poolIds.add(entry.pool.poolId);
    poolDigests.add(entry.pool.poolDigest);
  }
  return entries;
};

const observedAt = (entry) => {
  const dates = [entry.pool.createdAt];
  if (entry.liquidityCard) dates.push(entry.liquidityCard.lastAdoptionAt);
  return dates.sort().at(-1);
};

const summarizeEntries = (entries) => {
  const scopes = Object.fromEntries(['trade_corridor', 'industry', 'workflow', 'other'].map((scope) => [scope, 0]));
  let poolsWithLiquidity = 0;
  let verifiedAdoptionUnits = 0;
  let uniqueAdoptionCards = 0;
  let excludedDuplicates = 0;
  let partialAdoptions = 0;
  let notAdopted = 0;
  for (const entry of entries) {
    scopes[entry.pool.scope] += 1;
    if (entry.liquidityCard) {
      poolsWithLiquidity += 1;
      verifiedAdoptionUnits += entry.liquidityCard.units.verifiedAdoptionUnits;
      uniqueAdoptionCards += entry.liquidityCard.units.uniqueCards;
      excludedDuplicates += entry.liquidityCard.units.excludedDuplicates;
      partialAdoptions += entry.liquidityCard.units.partialAdoptions;
      notAdopted += entry.liquidityCard.units.notAdopted;
    }
  }
  const poolDates = entries.map((entry) => entry.pool.createdAt).sort();
  const observedDates = entries.map(observedAt).sort();
  return {
    entryCount: entries.length,
    poolsWithLiquidity,
    poolsWithoutLiquidity: entries.length - poolsWithLiquidity,
    verifiedAdoptionUnits,
    uniqueAdoptionCards,
    excludedDuplicates,
    partialAdoptions,
    notAdopted,
    scopes,
    firstPoolCreatedAt: poolDates[0],
    lastObservedAt: observedDates.at(-1)
  };
};

const buildDirectoryPayload = (inputEntries, options = {}) => {
  const entries = normalizeEntries(inputEntries);
  const scope = String(options.scope ?? 'community');
  if (!DIRECTORY_SCOPE_SET.has(scope)) throw new Error(`Unsupported Directory scope: ${scope}`);
  const generation = Number(options.generation ?? 0);
  if (!safeInteger(generation)) throw new Error('lineage.generation must be a non-negative integer.');
  const forkedFromDirectoryDigest = options.forkedFromDirectoryDigest;
  if (forkedFromDirectoryDigest !== undefined && !isBytes32(forkedFromDirectoryDigest)) {
    throw new Error('lineage.forkedFromDirectoryDigest is invalid.');
  }
  if (generation === 0 && forkedFromDirectoryDigest !== undefined) throw new Error('A generation-zero Directory cannot declare a parent.');
  if (generation > 0 && !isBytes32(forkedFromDirectoryDigest)) throw new Error('A forked Directory requires lineage.forkedFromDirectoryDigest.');
  const label = normalizeText(options.label ?? 'Open RWP Pool Directory', 'label', MAX_LABEL_LENGTH, { required: true });
  const summaryText = normalizeText(options.summary, 'summary', MAX_SUMMARY_LENGTH);
  const summary = summarizeEntries(entries);
  return {
    format: RWP_POOL_DIRECTORY_FORMAT,
    version: RWP_POOL_DIRECTORY_VERSION,
    domain: 'trade',
    label,
    scope,
    ...(summaryText ? { description: summaryText } : {}),
    curation: {
      mode: 'open_self_declared',
      entriesAreEndorsements: false,
      rankingProvided: false
    },
    lineage: {
      generation,
      ...(forkedFromDirectoryDigest ? { forkedFromDirectoryDigest } : {})
    },
    entries,
    summary,
    projectedAt: summary.lastObservedAt,
    assurance: RWP_POOL_DIRECTORY_ASSURANCE
  };
};

export const buildRwpPoolDirectory = (entries, options = {}) => {
  const payload = buildDirectoryPayload(entries, options);
  const directoryDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, directoryId: `rwpdir:${directoryDigest.slice(2, 18)}`, directoryDigest };
};

export const forkRwpPoolDirectory = (directory, options = {}) => {
  const errors = validateRwpPoolDirectory(directory);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return buildRwpPoolDirectory(options.entries ?? directory.entries, {
    label: options.label ?? `${directory.label} fork`,
    scope: options.scope ?? directory.scope,
    summary: options.summary ?? directory.description,
    generation: directory.lineage.generation + 1,
    forkedFromDirectoryDigest: directory.directoryDigest
  });
};

export const validateRwpPoolDirectory = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Pool Directory root must be an object.'];
  if (value.format !== RWP_POOL_DIRECTORY_FORMAT) errors.push(`format must equal ${RWP_POOL_DIRECTORY_FORMAT}.`);
  if (value.version !== RWP_POOL_DIRECTORY_VERSION) errors.push(`version must equal ${RWP_POOL_DIRECTORY_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwpdir:[0-9a-f]{16}$/.test(value.directoryId ?? '')) errors.push('directoryId is invalid.');
  if (!isBytes32(value.directoryDigest)) errors.push('directoryDigest is invalid.');
  if (typeof value.label !== 'string' || value.label.length < 1 || value.label.length > MAX_LABEL_LENGTH) errors.push('label is invalid.');
  if (!DIRECTORY_SCOPE_SET.has(value.scope)) errors.push('scope is unsupported.');
  if (value.description !== undefined && (typeof value.description !== 'string' || value.description.length < 1 || value.description.length > MAX_SUMMARY_LENGTH)) errors.push('description is invalid.');
  if (!isRecord(value.curation) || value.curation?.mode !== 'open_self_declared' || value.curation?.entriesAreEndorsements !== false || value.curation?.rankingProvided !== false) errors.push('curation boundary is invalid.');
  if (!isRecord(value.lineage) || !safeInteger(value.lineage?.generation)) errors.push('lineage.generation is invalid.');
  if (value.lineage?.forkedFromDirectoryDigest !== undefined && !isBytes32(value.lineage.forkedFromDirectoryDigest)) errors.push('lineage.forkedFromDirectoryDigest is invalid.');
  if (value.lineage?.generation === 0 && value.lineage?.forkedFromDirectoryDigest !== undefined) errors.push('generation zero cannot declare a parent Directory.');
  if (value.lineage?.generation > 0 && !isBytes32(value.lineage?.forkedFromDirectoryDigest)) errors.push('forked Directories require lineage.forkedFromDirectoryDigest.');
  if (!Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > MAX_ENTRIES) errors.push(`entries must contain 1 to ${MAX_ENTRIES} items.`);
  for (const entry of Array.isArray(value.entries) ? value.entries : []) {
    const poolErrors = validateRwpTradePool(entry?.pool);
    if (poolErrors.length > 0) errors.push(...poolErrors.map((error) => `entry.pool: ${error}`));
    if (entry?.liquidityCard !== undefined) {
      const cardErrors = validateRwpProofLiquidityCard(entry.liquidityCard);
      if (cardErrors.length > 0) errors.push(...cardErrors.map((error) => `entry.liquidityCard: ${error}`));
      if (poolErrors.length === 0 && cardErrors.length === 0) {
        try { assertLiquidityMatchesPool(entry.liquidityCard, entry.pool); }
        catch (error) { errors.push(error.message); }
      }
    }
    if (entry?.curatorNote !== undefined && (typeof entry.curatorNote !== 'string' || entry.curatorNote.length < 1 || entry.curatorNote.length > MAX_NOTE_LENGTH)) errors.push('entry.curatorNote is invalid.');
  }
  const entries = Array.isArray(value.entries) ? value.entries : [];
  const sorted = [...entries].sort((left, right) => String(left?.pool?.poolDigest).localeCompare(String(right?.pool?.poolDigest)));
  if (canonicalizeJson(sorted) !== canonicalizeJson(entries)) errors.push('entries must use canonical poolDigest order.');
  const poolIds = entries.map((entry) => entry?.pool?.poolId);
  const poolDigests = entries.map((entry) => entry?.pool?.poolDigest);
  if (new Set(poolIds).size !== poolIds.length) errors.push('entries contain duplicate Pool IDs.');
  if (new Set(poolDigests).size !== poolDigests.length) errors.push('entries contain duplicate Pool digests.');
  if (!isRecord(value.summary)) errors.push('summary is required.');
  else {
    for (const field of ['entryCount', 'poolsWithLiquidity', 'poolsWithoutLiquidity', 'verifiedAdoptionUnits', 'uniqueAdoptionCards', 'excludedDuplicates', 'partialAdoptions', 'notAdopted']) if (!safeInteger(value.summary[field])) errors.push(`summary.${field} is invalid.`);
    if (!isRecord(value.summary.scopes)) errors.push('summary.scopes is required.');
    else for (const scope of ['trade_corridor', 'industry', 'workflow', 'other']) if (!safeInteger(value.summary.scopes[scope])) errors.push(`summary.scopes.${scope} is invalid.`);
    if (!isDateTime(value.summary.firstPoolCreatedAt) || !isDateTime(value.summary.lastObservedAt)) errors.push('summary dates are invalid.');
  }
  if (!isDateTime(value.projectedAt) || value.projectedAt !== value.summary?.lastObservedAt) errors.push('projectedAt must equal summary.lastObservedAt.');
  if (value.assurance !== RWP_POOL_DIRECTORY_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (forbiddenPrivateMarker(canonicalizeJson(value))) errors.push('Pool Directory contains a forbidden private-field marker.');
  if (errors.length === 0) {
    try {
      const rebuilt = buildRwpPoolDirectory(value.entries, {
        label: value.label,
        scope: value.scope,
        summary: value.description,
        generation: value.lineage.generation,
        forkedFromDirectoryDigest: value.lineage.forkedFromDirectoryDigest
      });
      if (canonicalizeJson(value) !== canonicalizeJson(rebuilt)) errors.push('Directory does not match deterministic reconstruction from entries.');
    } catch (error) { errors.push(error.message); }
  }
  return errors;
};

const projectEntry = (entry) => ({
  poolId: entry.pool.poolId,
  poolDigest: entry.pool.poolDigest,
  patternDigest: entry.pool.proofPattern.patternDigest,
  label: entry.pool.label,
  scope: entry.pool.scope,
  generation: entry.pool.lineage.generation,
  ...(entry.curatorNote ? { curatorNote: entry.curatorNote } : {}),
  ...(entry.liquidityCard ? {
    liquidity: {
      cardId: entry.liquidityCard.cardId,
      cardDigest: entry.liquidityCard.cardDigest,
      snapshotId: entry.liquidityCard.source.snapshotId,
      snapshotDigest: entry.liquidityCard.source.snapshotDigest,
      verifiedAdoptionUnits: entry.liquidityCard.units.verifiedAdoptionUnits,
      uniqueCards: entry.liquidityCard.units.uniqueCards,
      excludedDuplicates: entry.liquidityCard.units.excludedDuplicates,
      partialAdoptions: entry.liquidityCard.units.partialAdoptions,
      notAdopted: entry.liquidityCard.units.notAdopted,
      firstAdoptionAt: entry.liquidityCard.firstAdoptionAt,
      lastAdoptionAt: entry.liquidityCard.lastAdoptionAt
    }
  } : {})
});

export const buildRwpPoolDirectoryCard = (directory) => {
  const errors = validateRwpPoolDirectory(directory);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const payload = {
    format: RWP_POOL_DIRECTORY_CARD_FORMAT,
    version: RWP_POOL_DIRECTORY_VERSION,
    domain: 'trade',
    source: {
      directoryId: directory.directoryId,
      directoryDigest: directory.directoryDigest
    },
    directory: {
      label: directory.label,
      scope: directory.scope,
      ...(directory.description ? { description: directory.description } : {}),
      generation: directory.lineage.generation,
      ...(directory.lineage.forkedFromDirectoryDigest ? { forkedFromDirectoryDigest: directory.lineage.forkedFromDirectoryDigest } : {})
    },
    entries: directory.entries.map(projectEntry),
    summary: structuredClone(directory.summary),
    projectedAt: directory.projectedAt,
    assurance: RWP_POOL_DIRECTORY_CARD_ASSURANCE
  };
  const cardDigest = keccakUtf8(canonicalizeJson(payload));
  return { ...payload, cardId: `rwpdircard:${cardDigest.slice(2, 18)}`, cardDigest };
};

export const validateRwpPoolDirectoryCard = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP Pool Directory Card root must be an object.'];
  if (value.format !== RWP_POOL_DIRECTORY_CARD_FORMAT) errors.push(`format must equal ${RWP_POOL_DIRECTORY_CARD_FORMAT}.`);
  if (value.version !== RWP_POOL_DIRECTORY_VERSION) errors.push(`version must equal ${RWP_POOL_DIRECTORY_VERSION}.`);
  if (value.domain !== 'trade') errors.push('domain must equal trade.');
  if (!/^rwpdircard:[0-9a-f]{16}$/.test(value.cardId ?? '')) errors.push('cardId is invalid.');
  if (!isBytes32(value.cardDigest)) errors.push('cardDigest is invalid.');
  if (!isRecord(value.source) || !/^rwpdir:[0-9a-f]{16}$/.test(value.source?.directoryId ?? '')) errors.push('source.directoryId is invalid.');
  if (!isBytes32(value.source?.directoryDigest)) errors.push('source.directoryDigest is invalid.');
  if (!isRecord(value.directory) || typeof value.directory?.label !== 'string' || value.directory.label.length < 1 || value.directory.label.length > MAX_LABEL_LENGTH) errors.push('directory metadata is invalid.');
  if (!DIRECTORY_SCOPE_SET.has(value.directory?.scope)) errors.push('directory.scope is invalid.');
  if (!safeInteger(value.directory?.generation)) errors.push('directory.generation is invalid.');
  if (value.directory?.forkedFromDirectoryDigest !== undefined && !isBytes32(value.directory.forkedFromDirectoryDigest)) errors.push('directory.forkedFromDirectoryDigest is invalid.');
  if (!Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > MAX_ENTRIES) errors.push(`entries must contain 1 to ${MAX_ENTRIES} projections.`);
  for (const entry of Array.isArray(value.entries) ? value.entries : []) {
    if (!/^rwppool:[0-9a-f]{16}$/.test(entry?.poolId ?? '')) errors.push('entry.poolId is invalid.');
    for (const field of ['poolDigest', 'patternDigest']) if (!isBytes32(entry?.[field])) errors.push(`entry.${field} is invalid.`);
    if (typeof entry?.label !== 'string' || entry.label.length < 1 || entry.label.length > 96) errors.push('entry.label is invalid.');
    if (!['trade_corridor', 'industry', 'workflow', 'other'].includes(entry?.scope)) errors.push('entry.scope is invalid.');
    if (!safeInteger(entry?.generation)) errors.push('entry.generation is invalid.');
    if (entry?.curatorNote !== undefined && (typeof entry.curatorNote !== 'string' || entry.curatorNote.length < 1 || entry.curatorNote.length > MAX_NOTE_LENGTH)) errors.push('entry.curatorNote is invalid.');
    if (entry?.liquidity !== undefined) {
      if (!isRecord(entry.liquidity) || !/^rwpplcard:[0-9a-f]{16}$/.test(entry.liquidity?.cardId ?? '')) errors.push('entry.liquidity.cardId is invalid.');
      if (!/^rwppls:[0-9a-f]{16}$/.test(entry.liquidity?.snapshotId ?? '')) errors.push('entry.liquidity.snapshotId is invalid.');
      for (const field of ['cardDigest', 'snapshotDigest']) if (!isBytes32(entry.liquidity?.[field])) errors.push(`entry.liquidity.${field} is invalid.`);
      for (const field of ['verifiedAdoptionUnits', 'uniqueCards', 'excludedDuplicates', 'partialAdoptions', 'notAdopted']) if (!safeInteger(entry.liquidity?.[field])) errors.push(`entry.liquidity.${field} is invalid.`);
      if (!isDateTime(entry.liquidity?.firstAdoptionAt) || !isDateTime(entry.liquidity?.lastAdoptionAt)) errors.push('entry.liquidity adoption dates are invalid.');
    }
  }
  const entries = Array.isArray(value.entries) ? value.entries : [];
  const sorted = [...entries].sort((left, right) => String(left?.poolDigest).localeCompare(String(right?.poolDigest)));
  if (canonicalizeJson(sorted) !== canonicalizeJson(entries)) errors.push('entries must use canonical poolDigest order.');
  if (!isRecord(value.summary)) errors.push('summary is required.');
  if (!isDateTime(value.projectedAt) || value.projectedAt !== value.summary?.lastObservedAt) errors.push('projectedAt must equal summary.lastObservedAt.');
  if (value.assurance !== RWP_POOL_DIRECTORY_CARD_ASSURANCE) errors.push('assurance boundary is missing or changed.');
  if (forbiddenPrivateMarker(canonicalizeJson(value))) errors.push('Pool Directory Card contains a forbidden private-field marker.');
  if (errors.length === 0) {
    const { cardId, cardDigest, ...payload } = value;
    const expectedDigest = keccakUtf8(canonicalizeJson(payload));
    if (cardDigest !== expectedDigest) errors.push('cardDigest does not match the canonical Directory Card payload.');
    if (cardId !== `rwpdircard:${expectedDigest.slice(2, 18)}`) errors.push('cardId does not match cardDigest.');
  }
  return errors;
};

export const encodeRwpPoolDirectoryCard = (card) => {
  const errors = validateRwpPoolDirectoryCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  const encoded = toBase64Url(canonicalizeJson(card));
  if (encoded.length > MAX_CARD_PAYLOAD_LENGTH) throw new Error('RWP Pool Directory Card exceeds the bounded share-link size.');
  return encoded;
};

export const decodeRwpPoolDirectoryCard = (payload) => {
  if (typeof payload !== 'string' || payload.length < 1 || payload.length > MAX_CARD_PAYLOAD_LENGTH) throw new Error('RWP Pool Directory Card payload is missing or too large.');
  const card = JSON.parse(fromBase64Url(payload));
  const errors = validateRwpPoolDirectoryCard(card);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return card;
};

export const buildRwpPoolDirectoryCardUrl = (card, baseUrl) => {
  const url = new URL(baseUrl);
  url.pathname = url.pathname.replace(/[^/]*$/, 'rwp-directory.html');
  url.search = '';
  url.hash = new URLSearchParams({ directory: encodeRwpPoolDirectoryCard(card) }).toString();
  return url.toString();
};

export const readRwpPoolDirectoryCardFromHash = (hash) => {
  const payload = new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get('directory');
  return payload ? decodeRwpPoolDirectoryCard(payload) : null;
};
