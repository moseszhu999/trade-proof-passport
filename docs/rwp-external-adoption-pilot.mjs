import { buildProofCard, canonicalizeJson } from './rwp-card.mjs';
import { buildRwpRequest } from './rwp-request.mjs';
import { buildRwpRequestResponse } from './rwp-request-response.mjs';
import { buildRwpEvidencePackage } from './rwp-evidence-package.mjs';
import { buildRwpEvidenceReceipt } from './rwp-evidence-receipt.mjs';
import { buildRwpCaseGraph, validateRwpCaseGraph } from './rwp-case-graph.mjs';
import {
  buildRwpProofPattern,
  buildRwpTradePool,
  validateRwpTradePool
} from './rwp-proof-pool.mjs';
import {
  buildRwpPoolAdoptionCard,
  buildRwpPoolAdoptionReceipt,
  validateRwpPoolAdoptionCard,
  validateRwpPoolAdoptionReceipt
} from './rwp-pool-adoption.mjs';
import {
  buildRwpProofLiquidityCard,
  buildRwpProofLiquiditySnapshot,
  validateRwpProofLiquidityCard,
  validateRwpProofLiquiditySnapshot
} from './rwp-proof-liquidity.mjs';
import {
  buildRwpPoolDirectory,
  buildRwpPoolDirectoryCard,
  validateRwpPoolDirectory,
  validateRwpPoolDirectoryCard
} from './rwp-pool-directory.mjs';

export const RWP_EXTERNAL_ADOPTION_PILOT_VERSION = '0.1';
export const RWP_EXTERNAL_ADOPTION_PILOT_ASSURANCE =
  'This non-normative pilot pack proves that two independently rooted RWP workflows can satisfy one public Trade Pool through existing Case Graph, Pool Adoption Receipt, Adoption Card, Proof Liquidity Snapshot and open Directory rules. It does not authenticate identities, create reputation, establish legal compliance, authorize financing, settle payments, issue RWAs or Tokens, or write to a chain.';

export const RWP_EXTERNAL_ADOPTION_PILOT_BOUNDARIES = Object.freeze([
  'local_file_processing_only',
  'public_or_explicitly_authorized_data_only',
  'no_central_database',
  'no_identity_authentication',
  'no_attestation_authority',
  'no_ranking_or_reputation_score',
  'no_payment_or_settlement',
  'no_rwa_or_token_claim',
  'no_wallet_or_chain_write'
]);

const clone = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sameCanonicalValue = (left, right) => canonicalizeJson(left) === canonicalizeJson(right);
const appendErrors = (errors, prefix, values) => {
  for (const value of values) errors.push(`${prefix}: ${value}`);
};

const buildWorkflowChain = (passport, label, times) => {
  const card = buildProofCard(passport, { publicLabel: label });
  const request = buildRwpRequest(card, {
    requestedAction: 'request_authorized_evidence',
    requesterRole: 'buyer',
    evidenceTypes: ['inspection_report', 'purchase_order'],
    note: 'Please provide the minimum authorized evidence.',
    createdAt: times.request
  });
  const response = buildRwpRequestResponse(card, request, {
    status: 'accept',
    responderRole: 'exporter',
    mode: 'authorized_off_channel',
    evidenceTypes: ['inspection_report', 'purchase_order'],
    channelHint: 'secure_data_room',
    createdAt: times.response
  });
  const evidencePackage = buildRwpEvidencePackage(passport, card, request, response, {
    evidenceIds: ['evidence:purchase-order', 'evidence:inspection-summary'],
    createdAt: times.package
  });
  const evidenceResults = Object.fromEntries(
    evidencePackage.evidence.map((item) => [
      item.evidenceId,
      {
        status: 'matched',
        algorithm: item.digest.algorithm,
        computedDigest: item.digest.value
      }
    ])
  );
  const receipt = buildRwpEvidenceReceipt(evidencePackage, {
    receiverRole: 'buyer',
    evidenceResults,
    createdAt: times.receipt
  });
  const artifacts = [passport, card, request, response, evidencePackage, receipt];
  const graph = buildRwpCaseGraph(artifacts);
  return { artifacts, graph };
};

const defaultAdopterPassport = (basePassport, index) => {
  const passport = clone(basePassport);
  const suffix = String(index + 1).padStart(3, '0');
  passport.passportId = `tpp:external-pilot:adopter:${suffix}`;
  if (isRecord(passport.tradeCase)) passport.tradeCase.caseReference = `RWP-PILOT-${suffix}`;
  passport.createdAt = `2026-08-0${index + 2}T00:00:00.000Z`;
  passport.updatedAt = `2026-08-0${index + 2}T00:30:00.000Z`;
  return passport;
};

const defaultTimes = (index) => {
  const day = String(index + 2).padStart(2, '0');
  return {
    request: `2026-08-${day}T01:00:00.000Z`,
    response: `2026-08-${day}T01:05:00.000Z`,
    package: `2026-08-${day}T01:10:00.000Z`,
    receipt: `2026-08-${day}T01:20:00.000Z`,
    adoption: `2026-08-${day}T01:30:00.000Z`
  };
};

const publicAdoptionProjection = (adoption) => ({
  graphId: adoption.graph.graphId,
  graphDigest: adoption.graph.graphDigest,
  passportDigest: adoption.graph.source.passportDigest,
  receiptId: adoption.receipt.receiptId,
  receiptDigest: adoption.receipt.receiptDigest,
  cardId: adoption.card.cardId,
  cardDigest: adoption.card.cardDigest,
  adoptionStatus: adoption.receipt.evaluation.adoptionStatus,
  proofLiquidityEligible: adoption.receipt.evaluation.proofLiquidityEligible,
  observability: adoption.receipt.basis.observability
});

export const buildRwpExternalAdoptionPilot = (
  sourcePassport,
  adopterPassports = [],
  options = {}
) => {
  if (!isRecord(sourcePassport)) throw new Error('A complete source Trade Proof Passport is required.');
  if (!Array.isArray(adopterPassports)) throw new Error('adopterPassports must be an array.');
  if (adopterPassports.length !== 0 && adopterPassports.length !== 2) {
    throw new Error('External Adoption Pilot v0.1 requires exactly two adopter Passports.');
  }

  const source = buildWorkflowChain(clone(sourcePassport), 'External adoption pilot source workflow', {
    request: '2026-08-01T00:00:00.000Z',
    response: '2026-08-01T00:05:00.000Z',
    package: '2026-08-01T00:10:00.000Z',
    receipt: '2026-08-01T00:20:00.000Z'
  });
  const pattern = buildRwpProofPattern(source.graph, {
    roles: ['buyer', 'exporter'],
    evidenceCategories: ['inspection_report', 'purchase_order'],
    statusGates: ['evidence_received']
  });
  const pool = buildRwpTradePool(pattern, {
    label: options.poolLabel ?? 'External Shipment Evidence Pilot Pool',
    scope: 'workflow',
    summary:
      options.poolSummary ??
      'A public workflow requiring matched purchase-order and inspection evidence from independently rooted RWP cases.',
    createdAt: options.poolCreatedAt ?? '2026-08-01T00:30:00.000Z'
  });

  const effectiveAdopters = adopterPassports.length === 2
    ? adopterPassports.map(clone)
    : [defaultAdopterPassport(sourcePassport, 0), defaultAdopterPassport(sourcePassport, 1)];

  const adoptions = effectiveAdopters.map((passport, index) => {
    const times = defaultTimes(index);
    const workflow = buildWorkflowChain(passport, `Independent adopter workflow ${index + 1}`, times);
    const receipt = buildRwpPoolAdoptionReceipt(pool, workflow.graph, {
      artifacts: workflow.artifacts,
      createdAt: times.adoption
    });
    const card = buildRwpPoolAdoptionCard(receipt, pool, workflow.graph);
    return {
      sequence: index + 1,
      artifacts: workflow.artifacts,
      graph: workflow.graph,
      receipt,
      card,
      publicProjection: publicAdoptionProjection({ ...workflow, receipt, card })
    };
  });

  const submittedCards = [adoptions[0].card, adoptions[1].card, clone(adoptions[1].card)];
  const snapshot = buildRwpProofLiquiditySnapshot(submittedCards);
  const liquidityCard = buildRwpProofLiquidityCard(snapshot);
  const directory = buildRwpPoolDirectory(
    [
      {
        pool,
        liquidityCard,
        curatorNote:
          'External Adoption Pilot v0.1: two independent full-artifact verified adoption units and one rejected duplicate submission.'
      }
    ],
    {
      label: 'RWP External Adoption Pilot Directory',
      scope: 'community',
      summary: 'A non-ranked directory entry backed by two independently rooted verified Pool adoptions.',
      generation: 0
    }
  );
  const directoryCard = buildRwpPoolDirectoryCard(directory);

  return {
    pilot: {
      name: 'RWP External Adoption Pilot Kit',
      version: RWP_EXTERNAL_ADOPTION_PILOT_VERSION,
      syntheticByDefault: adopterPassports.length === 0,
      nonNormative: true,
      generatedAt: options.generatedAt ?? '2026-08-04T02:00:00.000Z',
      assurance: RWP_EXTERNAL_ADOPTION_PILOT_ASSURANCE,
      boundaries: [...RWP_EXTERNAL_ADOPTION_PILOT_BOUNDARIES]
    },
    source: {
      artifacts: source.artifacts,
      graph: source.graph
    },
    pool: {
      pattern,
      manifest: pool
    },
    adoptions,
    proofLiquidity: {
      submittedCards,
      snapshot,
      card: liquidityCard
    },
    discovery: {
      directory,
      card: directoryCard
    },
    publicProjection: {
      pool: {
        poolId: pool.poolId,
        poolDigest: pool.poolDigest,
        patternId: pattern.patternId,
        patternDigest: pattern.patternDigest,
        label: pool.label,
        scope: pool.scope
      },
      sourceGraphDigest: source.graph.graphDigest,
      adoptions: adoptions.map((item) => item.publicProjection),
      proofLiquidity: {
        snapshotId: snapshot.snapshotId,
        snapshotDigest: snapshot.snapshotDigest,
        cardId: liquidityCard.cardId,
        cardDigest: liquidityCard.cardDigest,
        verifiedAdoptionUnits: snapshot.summary.verifiedAdoptionUnits,
        excludedDuplicates: snapshot.summary.excludedDuplicates
      },
      directory: {
        directoryId: directory.directoryId,
        directoryDigest: directory.directoryDigest,
        cardId: directoryCard.cardId,
        cardDigest: directoryCard.cardDigest,
        entryCount: directory.summary.entryCount,
        verifiedAdoptionUnits: directory.summary.verifiedAdoptionUnits
      },
      assurance: RWP_EXTERNAL_ADOPTION_PILOT_ASSURANCE,
      boundaries: [...RWP_EXTERNAL_ADOPTION_PILOT_BOUNDARIES]
    },
    summary: {
      sourceRoot: source.graph.source.passportDigest,
      adopterRoots: adoptions.map((item) => item.graph.source.passportDigest),
      uniqueAdopterRoots: new Set(adoptions.map((item) => item.graph.source.passportDigest)).size,
      verifiedAdoptionUnits: snapshot.summary.verifiedAdoptionUnits,
      duplicateSubmissionsRejected: snapshot.summary.excludedDuplicates,
      directoryEntries: directory.summary.entryCount,
      pageViewsCounted: 0,
      emptyForksCounted: 0,
      starsCounted: 0,
      pullRequestsCounted: 0
    }
  };
};

export const validateRwpExternalAdoptionPilot = (value) => {
  const errors = [];
  if (!isRecord(value)) return ['RWP External Adoption Pilot must be an object.'];

  const meta = value.pilot;
  if (!isRecord(meta)) errors.push('pilot metadata is required.');
  if (meta?.version !== RWP_EXTERNAL_ADOPTION_PILOT_VERSION) errors.push('pilot.version is invalid.');
  if (meta?.nonNormative !== true) errors.push('Pilot must remain non-normative.');
  if (meta?.assurance !== RWP_EXTERNAL_ADOPTION_PILOT_ASSURANCE) errors.push('Pilot assurance boundary is missing or changed.');
  if (!sameCanonicalValue(meta?.boundaries, RWP_EXTERNAL_ADOPTION_PILOT_BOUNDARIES)) {
    errors.push('Pilot boundaries are missing or reordered.');
  }

  const sourceGraph = value.source?.graph;
  const pool = value.pool?.manifest;
  const pattern = value.pool?.pattern;
  appendErrors(errors, 'source graph', validateRwpCaseGraph(sourceGraph));
  appendErrors(errors, 'pool', validateRwpTradePool(pool));

  try {
    const rebuiltSourceGraph = buildRwpCaseGraph(value.source?.artifacts);
    if (!sameCanonicalValue(rebuiltSourceGraph, sourceGraph)) {
      errors.push('Source artifacts do not rebuild the exact source Case Graph.');
    }
  } catch (error) {
    errors.push(`source artifacts: ${error.message}`);
  }
  if (!sameCanonicalValue(pool?.proofPattern, pattern)) {
    errors.push('Pool must embed the exact Pilot Proof Pattern.');
  }

  if (!Array.isArray(value.adoptions) || value.adoptions.length !== 2) {
    errors.push('Pilot must contain exactly two adoption units.');
  }
  const adopterRoots = [];
  for (const [index, adoption] of (value.adoptions ?? []).entries()) {
    const prefix = `adoption ${index + 1}`;
    const graph = adoption?.graph;
    const receipt = adoption?.receipt;
    const card = adoption?.card;
    appendErrors(errors, `${prefix} graph`, validateRwpCaseGraph(graph));
    appendErrors(errors, `${prefix} receipt`, validateRwpPoolAdoptionReceipt(receipt, pool, graph));
    appendErrors(errors, `${prefix} card`, validateRwpPoolAdoptionCard(card));

    try {
      const rebuiltGraph = buildRwpCaseGraph(adoption?.artifacts);
      if (!sameCanonicalValue(rebuiltGraph, graph)) {
        errors.push(`${prefix} artifacts do not rebuild the exact Case Graph.`);
      }
    } catch (error) {
      errors.push(`${prefix} artifacts: ${error.message}`);
    }

    if (graph?.source?.passportDigest === sourceGraph?.source?.passportDigest) {
      errors.push(`${prefix} must use an independent Passport root.`);
    }
    if (graph?.source?.passportDigest) adopterRoots.push(graph.source.passportDigest);
    if (receipt?.basis?.observability !== 'full_artifact_bundle') {
      errors.push(`${prefix} must use full_artifact_bundle observability.`);
    }
    if (receipt?.evaluation?.adoptionStatus !== 'verified_adoption') {
      errors.push(`${prefix} must be verified_adoption.`);
    }
    if (receipt?.evaluation?.proofLiquidityEligible !== true) {
      errors.push(`${prefix} must be Proof Liquidity eligible.`);
    }
    if (receipt?.evaluation?.checks?.notSatisfied !== 0) {
      errors.push(`${prefix} must have zero notSatisfied checks.`);
    }
    if (receipt?.evaluation?.checks?.notObservable !== 0) {
      errors.push(`${prefix} must have zero notObservable checks.`);
    }

    try {
      const rebuiltReceipt = buildRwpPoolAdoptionReceipt(pool, graph, {
        artifacts: adoption?.artifacts,
        createdAt: receipt?.createdAt
      });
      if (!sameCanonicalValue(rebuiltReceipt, receipt)) {
        errors.push(`${prefix} Receipt does not match deterministic reconstruction.`);
      }
      const rebuiltCard = buildRwpPoolAdoptionCard(rebuiltReceipt, pool, graph);
      if (!sameCanonicalValue(rebuiltCard, card)) {
        errors.push(`${prefix} Card does not match deterministic reconstruction.`);
      }
      if (!sameCanonicalValue(publicAdoptionProjection(adoption), adoption?.publicProjection)) {
        errors.push(`${prefix} public projection does not match canonical digests.`);
      }
    } catch (error) {
      errors.push(`${prefix} reconstruction: ${error.message}`);
    }
  }
  if (new Set(adopterRoots).size !== 2) {
    errors.push('Pilot adopter Passport roots must be unique.');
  }

  const snapshot = value.proofLiquidity?.snapshot;
  const liquidityCard = value.proofLiquidity?.card;
  appendErrors(errors, 'Proof Liquidity Snapshot', validateRwpProofLiquiditySnapshot(snapshot));
  appendErrors(errors, 'Proof Liquidity Card', validateRwpProofLiquidityCard(liquidityCard));
  try {
    const rebuiltSnapshot = buildRwpProofLiquiditySnapshot(value.proofLiquidity?.submittedCards);
    if (!sameCanonicalValue(rebuiltSnapshot, snapshot)) {
      errors.push('Proof Liquidity Snapshot does not match deterministic reconstruction.');
    }
    const rebuiltCard = buildRwpProofLiquidityCard(rebuiltSnapshot);
    if (!sameCanonicalValue(rebuiltCard, liquidityCard)) {
      errors.push('Proof Liquidity Card does not match deterministic reconstruction.');
    }
  } catch (error) {
    errors.push(`Proof Liquidity reconstruction: ${error.message}`);
  }
  if (snapshot?.summary?.submittedCards !== 3) errors.push('Pilot must submit exactly three Adoption Cards.');
  if (snapshot?.summary?.uniqueCards !== 2) errors.push('Pilot must retain exactly two unique Adoption Cards.');
  if (snapshot?.summary?.verifiedAdoptionUnits !== 2) errors.push('Pilot must produce exactly two verified adoption units.');
  if (snapshot?.summary?.excludedDuplicates !== 1) errors.push('Pilot must reject exactly one duplicate submission.');

  const directory = value.discovery?.directory;
  const directoryCard = value.discovery?.card;
  appendErrors(errors, 'Directory', validateRwpPoolDirectory(directory));
  appendErrors(errors, 'Directory Card', validateRwpPoolDirectoryCard(directoryCard));
  if (directory?.summary?.entryCount !== 1) errors.push('Pilot Directory must contain exactly one Pool entry.');
  if (directory?.summary?.verifiedAdoptionUnits !== 2) {
    errors.push('Pilot Directory must report exactly two verified adoption units.');
  }
  if (directory?.curation?.entriesAreEndorsements !== false) {
    errors.push('Pilot Directory entries must not be endorsements.');
  }
  if (directory?.curation?.rankingProvided !== false) {
    errors.push('Pilot Directory must not provide ranking.');
  }

  const expectedSummary = {
    sourceRoot: sourceGraph?.source?.passportDigest,
    adopterRoots,
    uniqueAdopterRoots: new Set(adopterRoots).size,
    verifiedAdoptionUnits: snapshot?.summary?.verifiedAdoptionUnits,
    duplicateSubmissionsRejected: snapshot?.summary?.excludedDuplicates,
    directoryEntries: directory?.summary?.entryCount,
    pageViewsCounted: 0,
    emptyForksCounted: 0,
    starsCounted: 0,
    pullRequestsCounted: 0
  };
  if (!sameCanonicalValue(value.summary, expectedSummary)) {
    errors.push('Pilot summary does not match canonical aggregate facts.');
  }

  const expectedPublicProjection = {
    pool: {
      poolId: pool?.poolId,
      poolDigest: pool?.poolDigest,
      patternId: pattern?.patternId,
      patternDigest: pattern?.patternDigest,
      label: pool?.label,
      scope: pool?.scope
    },
    sourceGraphDigest: sourceGraph?.graphDigest,
    adoptions: (value.adoptions ?? []).map((item) => publicAdoptionProjection(item)),
    proofLiquidity: {
      snapshotId: snapshot?.snapshotId,
      snapshotDigest: snapshot?.snapshotDigest,
      cardId: liquidityCard?.cardId,
      cardDigest: liquidityCard?.cardDigest,
      verifiedAdoptionUnits: snapshot?.summary?.verifiedAdoptionUnits,
      excludedDuplicates: snapshot?.summary?.excludedDuplicates
    },
    directory: {
      directoryId: directory?.directoryId,
      directoryDigest: directory?.directoryDigest,
      cardId: directoryCard?.cardId,
      cardDigest: directoryCard?.cardDigest,
      entryCount: directory?.summary?.entryCount,
      verifiedAdoptionUnits: directory?.summary?.verifiedAdoptionUnits
    },
    assurance: RWP_EXTERNAL_ADOPTION_PILOT_ASSURANCE,
    boundaries: [...RWP_EXTERNAL_ADOPTION_PILOT_BOUNDARIES]
  };
  if (!sameCanonicalValue(value.publicProjection, expectedPublicProjection)) {
    errors.push('Public projection does not match canonical pilot digests and aggregates.');
  }

  for (const forbiddenOwner of [
    'attestation',
    'identityVerification',
    'reputation',
    'ranking',
    'payment',
    'settlement',
    'tokenClaim',
    'rwaIssuance',
    'walletOperation',
    'chainWrite'
  ]) {
    if (Object.hasOwn(value, forbiddenOwner)) errors.push(`Pilot created forbidden owner ${forbiddenOwner}.`);
  }

  return errors;
};
