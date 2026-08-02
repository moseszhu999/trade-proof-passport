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

export const RWP_POOL_ADOPTION_CASE_STUDY_VERSION = '0.1';
export const RWP_POOL_ADOPTION_CASE_STUDY_SOURCE_URL =
  'https://raw.githubusercontent.com/moseszhu999/trade-proof-passport/main/examples/steel-cabinet-passport.json';

export const RWP_POOL_ADOPTION_CASE_STUDY_ASSURANCE =
  'This non-normative synthetic acceptance pack reproduces the existing RWP Pool, Case Graph, Adoption Receipt, Adoption Card, Proof Liquidity Snapshot and open Directory rules. It adds no attestation authority, settlement state, identity proof, score, ranking, Token entitlement, RWA issuance or chain write.';

export const RWP_POOL_ADOPTION_CASE_STUDY_BOUNDARIES = Object.freeze([
  'no_central_database',
  'no_ranking_or_reputation_score',
  'no_automatic_identity_authentication',
  'no_attestation_authority',
  'no_payment_or_settlement',
  'no_rwa_or_token_claim',
  'no_chain_write'
]);

const clone = (value) =>
  typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

const buildChain = (passport, label, times) => {
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

const sameCanonicalValue = (left, right) =>
  canonicalizeJson(left) === canonicalizeJson(right);

const appendErrors = (errors, prefix, values) => {
  for (const value of values) errors.push(`${prefix}: ${value}`);
};

export const buildRwpPoolAdoptionCaseStudy = (basePassport) => {
  if (!basePassport || typeof basePassport !== 'object' || Array.isArray(basePassport)) {
    throw new Error('A complete synthetic Trade Proof Passport is required.');
  }

  const sourcePassport = clone(basePassport);
  const source = buildChain(sourcePassport, 'Source Pool workflow', {
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
    label: 'Independent Shipment Evidence Pool',
    scope: 'workflow',
    summary: 'A public workflow requiring matched purchase-order and inspection evidence.',
    createdAt: '2026-08-01T00:30:00.000Z'
  });

  const adopterPassport = clone(basePassport);
  adopterPassport.passportId = 'tpp:adopter:steel-cabinet:002';
  adopterPassport.tradeCase.caseReference = 'SC-ADOPTER-002';
  adopterPassport.createdAt = '2026-08-02T00:00:00.000Z';
  adopterPassport.updatedAt = '2026-08-02T00:30:00.000Z';
  const adopter = buildChain(adopterPassport, 'Independent adopter workflow', {
    request: '2026-08-02T01:00:00.000Z',
    response: '2026-08-02T01:05:00.000Z',
    package: '2026-08-02T01:10:00.000Z',
    receipt: '2026-08-02T01:20:00.000Z'
  });

  const graphOnlyReceipt = buildRwpPoolAdoptionReceipt(pool, adopter.graph, {
    createdAt: '2026-08-02T01:29:00.000Z'
  });
  const graphOnlyCard = buildRwpPoolAdoptionCard(graphOnlyReceipt, pool, adopter.graph);

  const verifiedReceipt = buildRwpPoolAdoptionReceipt(pool, adopter.graph, {
    artifacts: adopter.artifacts,
    createdAt: '2026-08-02T01:30:00.000Z'
  });
  const verifiedCard = buildRwpPoolAdoptionCard(verifiedReceipt, pool, adopter.graph);

  const submittedCards = [verifiedCard, clone(verifiedCard)];
  const snapshot = buildRwpProofLiquiditySnapshot(submittedCards);
  const liquidityCard = buildRwpProofLiquidityCard(snapshot);

  const directory = buildRwpPoolDirectory(
    [
      {
        pool,
        liquidityCard,
        curatorNote: 'Synthetic acceptance case: one independent full-artifact adoption and one rejected duplicate submission.'
      }
    ],
    {
      label: 'RWP Pool Adoption Acceptance Directory',
      scope: 'community',
      summary: 'A non-normative reproducible case study of verified Pool adoption.',
      generation: 0
    }
  );
  const directoryCard = buildRwpPoolDirectoryCard(directory);

  return {
    caseStudy: {
      name: 'Independent Shipment Evidence Pool adoption',
      version: RWP_POOL_ADOPTION_CASE_STUDY_VERSION,
      synthetic: true,
      nonNormative: true,
      generatedAt: '2026-08-02T02:00:00.000Z',
      assurance: RWP_POOL_ADOPTION_CASE_STUDY_ASSURANCE,
      boundaries: [...RWP_POOL_ADOPTION_CASE_STUDY_BOUNDARIES]
    },
    source: {
      artifacts: source.artifacts,
      graph: source.graph
    },
    pool: {
      pattern,
      manifest: pool
    },
    adoption: {
      artifacts: adopter.artifacts,
      graph: adopter.graph,
      graphOnly: {
        receipt: graphOnlyReceipt,
        card: graphOnlyCard
      },
      verified: {
        receipt: verifiedReceipt,
        card: verifiedCard
      }
    },
    proofLiquidity: {
      submittedCards,
      snapshot,
      card: liquidityCard
    },
    discovery: {
      directory,
      card: directoryCard
    },
    summary: {
      sourceAndAdopterRootsDiffer:
        source.graph.source.passportDigest !== adopter.graph.source.passportDigest,
      graphOnlyStatus: graphOnlyReceipt.evaluation.adoptionStatus,
      graphOnlyEligible: graphOnlyReceipt.evaluation.proofLiquidityEligible,
      verifiedStatus: verifiedReceipt.evaluation.adoptionStatus,
      verifiedEligible: verifiedReceipt.evaluation.proofLiquidityEligible,
      proofLiquidityUnits: snapshot.summary.verifiedAdoptionUnits,
      duplicateSubmissionsRejected: snapshot.summary.excludedDuplicates,
      directoryEntries: directory.summary.entryCount,
      viewsCounted: 0,
      emptyForksCounted: 0
    }
  };
};

export const validateRwpPoolAdoptionCaseStudy = (value) => {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['RWP Pool Adoption Case Study must be an object.'];
  }

  const meta = value.caseStudy;
  if (!meta || typeof meta !== 'object') errors.push('caseStudy metadata is required.');
  if (meta?.version !== RWP_POOL_ADOPTION_CASE_STUDY_VERSION) errors.push('caseStudy.version is invalid.');
  if (meta?.synthetic !== true || meta?.nonNormative !== true) errors.push('Case Study must remain synthetic and non-normative.');
  if (meta?.assurance !== RWP_POOL_ADOPTION_CASE_STUDY_ASSURANCE) errors.push('Case Study assurance boundary is missing or changed.');
  if (!sameCanonicalValue(meta?.boundaries, RWP_POOL_ADOPTION_CASE_STUDY_BOUNDARIES)) errors.push('Case Study boundaries are missing or reordered.');

  const sourceGraph = value.source?.graph;
  const adopterGraph = value.adoption?.graph;
  const pool = value.pool?.manifest;
  const pattern = value.pool?.pattern;

  appendErrors(errors, 'source graph', validateRwpCaseGraph(sourceGraph));
  appendErrors(errors, 'adopter graph', validateRwpCaseGraph(adopterGraph));
  appendErrors(errors, 'pool', validateRwpTradePool(pool));

  try {
    const rebuiltSourceGraph = buildRwpCaseGraph(value.source?.artifacts);
    if (!sameCanonicalValue(rebuiltSourceGraph, sourceGraph)) errors.push('Source artifacts do not rebuild the exact source Case Graph.');
  } catch (error) {
    errors.push(`source artifacts: ${error.message}`);
  }
  try {
    const rebuiltAdopterGraph = buildRwpCaseGraph(value.adoption?.artifacts);
    if (!sameCanonicalValue(rebuiltAdopterGraph, adopterGraph)) errors.push('Adopter artifacts do not rebuild the exact adopter Case Graph.');
  } catch (error) {
    errors.push(`adopter artifacts: ${error.message}`);
  }

  if (sourceGraph?.source?.passportDigest === adopterGraph?.source?.passportDigest) {
    errors.push('Source and adopter Passport roots must differ.');
  }
  if (!sameCanonicalValue(pool?.proofPattern, pattern)) errors.push('Pool must embed the exact Case Study Proof Pattern.');

  const graphOnlyReceipt = value.adoption?.graphOnly?.receipt;
  const graphOnlyCard = value.adoption?.graphOnly?.card;
  const verifiedReceipt = value.adoption?.verified?.receipt;
  const verifiedCard = value.adoption?.verified?.card;
  appendErrors(errors, 'graph-only receipt', validateRwpPoolAdoptionReceipt(graphOnlyReceipt, pool, adopterGraph));
  appendErrors(errors, 'graph-only card', validateRwpPoolAdoptionCard(graphOnlyCard));
  appendErrors(errors, 'verified receipt', validateRwpPoolAdoptionReceipt(verifiedReceipt, pool, adopterGraph));
  appendErrors(errors, 'verified card', validateRwpPoolAdoptionCard(verifiedCard));

  if (graphOnlyReceipt?.basis?.observability !== 'graph_only') errors.push('Graph-only receipt must use graph_only observability.');
  if (graphOnlyReceipt?.evaluation?.adoptionStatus !== 'partial_adoption') errors.push('Graph-only receipt must remain partial_adoption.');
  if (graphOnlyReceipt?.evaluation?.proofLiquidityEligible !== false) errors.push('Graph-only receipt must not be Proof Liquidity eligible.');
  if (verifiedReceipt?.basis?.observability !== 'full_artifact_bundle') errors.push('Verified receipt must use full_artifact_bundle observability.');
  if (verifiedReceipt?.evaluation?.adoptionStatus !== 'verified_adoption') errors.push('Verified receipt must be verified_adoption.');
  if (verifiedReceipt?.evaluation?.proofLiquidityEligible !== true) errors.push('Verified receipt must be Proof Liquidity eligible.');

  try {
    const rebuiltGraphOnlyReceipt = buildRwpPoolAdoptionReceipt(pool, adopterGraph, {
      createdAt: graphOnlyReceipt.createdAt
    });
    if (!sameCanonicalValue(rebuiltGraphOnlyReceipt, graphOnlyReceipt)) errors.push('Graph-only Receipt does not match deterministic reconstruction.');
    const rebuiltGraphOnlyCard = buildRwpPoolAdoptionCard(rebuiltGraphOnlyReceipt, pool, adopterGraph);
    if (!sameCanonicalValue(rebuiltGraphOnlyCard, graphOnlyCard)) errors.push('Graph-only Card does not match deterministic reconstruction.');
  } catch (error) {
    errors.push(`graph-only reconstruction: ${error.message}`);
  }

  try {
    const rebuiltVerifiedReceipt = buildRwpPoolAdoptionReceipt(pool, adopterGraph, {
      artifacts: value.adoption?.artifacts,
      createdAt: verifiedReceipt.createdAt
    });
    if (!sameCanonicalValue(rebuiltVerifiedReceipt, verifiedReceipt)) errors.push('Verified Receipt does not match deterministic reconstruction.');
    const rebuiltVerifiedCard = buildRwpPoolAdoptionCard(rebuiltVerifiedReceipt, pool, adopterGraph);
    if (!sameCanonicalValue(rebuiltVerifiedCard, verifiedCard)) errors.push('Verified Card does not match deterministic reconstruction.');
  } catch (error) {
    errors.push(`verified reconstruction: ${error.message}`);
  }

  const snapshot = value.proofLiquidity?.snapshot;
  const liquidityCard = value.proofLiquidity?.card;
  appendErrors(errors, 'Proof Liquidity Snapshot', validateRwpProofLiquiditySnapshot(snapshot));
  appendErrors(errors, 'Proof Liquidity Card', validateRwpProofLiquidityCard(liquidityCard));
  try {
    const rebuiltSnapshot = buildRwpProofLiquiditySnapshot(value.proofLiquidity?.submittedCards);
    if (!sameCanonicalValue(rebuiltSnapshot, snapshot)) errors.push('Proof Liquidity Snapshot does not match deterministic reconstruction.');
    const rebuiltLiquidityCard = buildRwpProofLiquidityCard(rebuiltSnapshot);
    if (!sameCanonicalValue(rebuiltLiquidityCard, liquidityCard)) errors.push('Proof Liquidity Card does not match deterministic reconstruction.');
  } catch (error) {
    errors.push(`Proof Liquidity reconstruction: ${error.message}`);
  }

  if (snapshot?.summary?.verifiedAdoptionUnits !== 1) errors.push('Case Study must produce exactly one verified Proof Liquidity unit.');
  if (snapshot?.summary?.excludedDuplicates !== 1) errors.push('Case Study must reject exactly one duplicate submission.');

  const directory = value.discovery?.directory;
  const directoryCard = value.discovery?.card;
  appendErrors(errors, 'Directory', validateRwpPoolDirectory(directory));
  appendErrors(errors, 'Directory Card', validateRwpPoolDirectoryCard(directoryCard));
  if (directory?.entries?.length !== 1) errors.push('Case Study Directory must contain exactly one Pool.');
  if (directory?.summary?.verifiedAdoptionUnits !== 1) errors.push('Case Study Directory must report exactly one verified adoption unit.');
  if (directory?.entries?.[0]?.pool?.poolDigest !== pool?.poolDigest) errors.push('Directory does not contain the Case Study Pool.');
  if (directory?.entries?.[0]?.liquidityCard?.cardDigest !== liquidityCard?.cardDigest) errors.push('Directory does not contain the matching Liquidity Card.');
  try {
    const rebuiltDirectoryCard = buildRwpPoolDirectoryCard(directory);
    if (!sameCanonicalValue(rebuiltDirectoryCard, directoryCard)) errors.push('Directory Card does not match deterministic reconstruction.');
  } catch (error) {
    errors.push(`Directory Card reconstruction: ${error.message}`);
  }

  const expectedSummary = {
    sourceAndAdopterRootsDiffer: true,
    graphOnlyStatus: 'partial_adoption',
    graphOnlyEligible: false,
    verifiedStatus: 'verified_adoption',
    verifiedEligible: true,
    proofLiquidityUnits: 1,
    duplicateSubmissionsRejected: 1,
    directoryEntries: 1,
    viewsCounted: 0,
    emptyForksCounted: 0
  };
  if (!sameCanonicalValue(value.summary, expectedSummary)) errors.push('Case Study summary does not match the fixed acceptance result.');

  return errors;
};

export const loadRwpPoolAdoptionCaseStudy = async (
  fetchImpl = globalThis.fetch,
  sourceUrl = RWP_POOL_ADOPTION_CASE_STUDY_SOURCE_URL
) => {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  const response = await fetchImpl(sourceUrl);
  if (!response?.ok) throw new Error('Synthetic Passport could not be loaded.');
  return buildRwpPoolAdoptionCaseStudy(await response.json());
};
