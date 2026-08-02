import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { canonicalizeJson } from '../docs/rwp-card.mjs';
import {
  RWP_POOL_ADOPTION_CASE_STUDY_ASSURANCE,
  RWP_POOL_ADOPTION_CASE_STUDY_BOUNDARIES,
  buildRwpPoolAdoptionCaseStudy,
  validateRwpPoolAdoptionCaseStudy
} from '../docs/rwp-pool-adoption-case-study.mjs';

const passport = JSON.parse(
  await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8')
);

const caseStudy = buildRwpPoolAdoptionCaseStudy(passport);
assert.deepEqual(validateRwpPoolAdoptionCaseStudy(caseStudy), []);
assert.equal(caseStudy.caseStudy.assurance, RWP_POOL_ADOPTION_CASE_STUDY_ASSURANCE);
assert.deepEqual(caseStudy.caseStudy.boundaries, [...RWP_POOL_ADOPTION_CASE_STUDY_BOUNDARIES]);
assert.equal(caseStudy.caseStudy.synthetic, true);
assert.equal(caseStudy.caseStudy.nonNormative, true);
assert.equal(caseStudy.summary.sourceAndAdopterRootsDiffer, true);
assert.equal(caseStudy.summary.graphOnlyStatus, 'partial_adoption');
assert.equal(caseStudy.summary.graphOnlyEligible, false);
assert.equal(caseStudy.summary.verifiedStatus, 'verified_adoption');
assert.equal(caseStudy.summary.verifiedEligible, true);
assert.equal(caseStudy.summary.proofLiquidityUnits, 1);
assert.equal(caseStudy.summary.duplicateSubmissionsRejected, 1);
assert.equal(caseStudy.summary.viewsCounted, 0);
assert.equal(caseStudy.summary.emptyForksCounted, 0);
assert.notEqual(
  caseStudy.source.graph.source.passportDigest,
  caseStudy.adoption.graph.source.passportDigest
);
assert.equal(caseStudy.adoption.graphOnly.receipt.basis.observability, 'graph_only');
assert.equal(caseStudy.adoption.verified.receipt.basis.observability, 'full_artifact_bundle');
assert.equal(caseStudy.adoption.verified.receipt.evaluation.checks.notSatisfied, 0);
assert.equal(caseStudy.adoption.verified.receipt.evaluation.checks.notObservable, 0);
assert.equal(caseStudy.proofLiquidity.snapshot.summary.submittedCards, 2);
assert.equal(caseStudy.proofLiquidity.snapshot.summary.uniqueCards, 1);
assert.equal(caseStudy.proofLiquidity.snapshot.summary.verifiedAdoptionUnits, 1);
assert.equal(caseStudy.proofLiquidity.snapshot.summary.excludedDuplicates, 1);
assert.deepEqual(
  caseStudy.proofLiquidity.snapshot.excluded[0].duplicateOf,
  ['card', 'receipt', 'graph', 'passport']
);
assert.equal(caseStudy.discovery.directory.summary.entryCount, 1);
assert.equal(caseStudy.discovery.directory.summary.verifiedAdoptionUnits, 1);
assert.equal(caseStudy.discovery.directory.curation.entriesAreEndorsements, false);
assert.equal(caseStudy.discovery.directory.curation.rankingProvided, false);

const rebuilt = buildRwpPoolAdoptionCaseStudy(passport);
assert.equal(canonicalizeJson(rebuilt), canonicalizeJson(caseStudy));

const tamperedEligibility = structuredClone(caseStudy);
tamperedEligibility.adoption.verified.receipt.evaluation.proofLiquidityEligible = false;
assert.ok(
  validateRwpPoolAdoptionCaseStudy(tamperedEligibility).some((error) =>
    /verified receipt|deterministic reconstruction|Proof Liquidity eligible/.test(error)
  )
);

const tamperedSnapshot = structuredClone(caseStudy);
tamperedSnapshot.proofLiquidity.snapshot.summary.verifiedAdoptionUnits = 99;
assert.ok(
  validateRwpPoolAdoptionCaseStudy(tamperedSnapshot).some((error) =>
    /Snapshot|one verified Proof Liquidity unit/.test(error)
  )
);

const tamperedDirectory = structuredClone(caseStudy);
tamperedDirectory.discovery.directory.summary.verifiedAdoptionUnits = 99;
assert.ok(
  validateRwpPoolAdoptionCaseStudy(tamperedDirectory).some((error) =>
    /Directory/.test(error)
  )
);

const publicProjection = {
  caseStudy: caseStudy.caseStudy,
  pool: {
    label: caseStudy.pool.manifest.label,
    scope: caseStudy.pool.manifest.scope,
    poolDigest: caseStudy.pool.manifest.poolDigest
  },
  sourceGraphDigest: caseStudy.source.graph.graphDigest,
  adopterGraphDigest: caseStudy.adoption.graph.graphDigest,
  adoptionReceiptDigest: caseStudy.adoption.verified.receipt.receiptDigest,
  adoptionCardDigest: caseStudy.adoption.verified.card.cardDigest,
  liquiditySnapshotDigest: caseStudy.proofLiquidity.snapshot.snapshotDigest,
  liquidityCardDigest: caseStudy.proofLiquidity.card.cardDigest,
  directoryDigest: caseStudy.discovery.directory.directoryDigest,
  directoryCardDigest: caseStudy.discovery.card.cardDigest,
  summary: caseStudy.summary
};
const publicJson = canonicalizeJson(publicProjection);
for (const forbidden of [
  'tpp:adopter:steel-cabinet:002',
  'Example Exporter Ltd.',
  'party:exporter:example',
  'evidence:purchase-order',
  'evidence://',
  'goodsDescription',
  'computedDigest',
  'secure_data_room'
]) {
  assert.equal(publicJson.includes(forbidden), false, `public Case Study projection leaked ${forbidden}`);
}
for (const forbiddenOwner of ['attestation', 'settlement', 'payment', 'tokenClaim', 'rwaIssuance']) {
  assert.equal(Object.hasOwn(caseStudy, forbiddenOwner), false, `Case Study created forbidden owner ${forbiddenOwner}`);
}

await writeFile(
  '/tmp/rwp-pool-adoption-case-study.json',
  `${JSON.stringify(caseStudy, null, 2)}\n`
);

console.log('PASS: reproducible synthetic Pool Adoption Case Study, verified Proof Liquidity unit, duplicate rejection and no new authority owner');
