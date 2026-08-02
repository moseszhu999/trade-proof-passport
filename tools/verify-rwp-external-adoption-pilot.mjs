import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { canonicalizeJson } from '../docs/rwp-card.mjs';
import {
  RWP_EXTERNAL_ADOPTION_PILOT_ASSURANCE,
  RWP_EXTERNAL_ADOPTION_PILOT_BOUNDARIES,
  buildRwpExternalAdoptionPilot,
  validateRwpExternalAdoptionPilot
} from '../docs/rwp-external-adoption-pilot.mjs';

const basePassport = JSON.parse(
  await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8')
);

const pilot = buildRwpExternalAdoptionPilot(basePassport);
assert.deepEqual(validateRwpExternalAdoptionPilot(pilot), []);
assert.equal(pilot.pilot.syntheticByDefault, true);
assert.equal(pilot.pilot.nonNormative, true);
assert.equal(pilot.pilot.assurance, RWP_EXTERNAL_ADOPTION_PILOT_ASSURANCE);
assert.deepEqual(pilot.pilot.boundaries, [...RWP_EXTERNAL_ADOPTION_PILOT_BOUNDARIES]);
assert.equal(pilot.adoptions.length, 2);
assert.equal(pilot.summary.uniqueAdopterRoots, 2);
assert.equal(pilot.summary.verifiedAdoptionUnits, 2);
assert.equal(pilot.summary.duplicateSubmissionsRejected, 1);
assert.equal(pilot.summary.directoryEntries, 1);
assert.equal(pilot.summary.pageViewsCounted, 0);
assert.equal(pilot.summary.emptyForksCounted, 0);
assert.equal(pilot.summary.starsCounted, 0);
assert.equal(pilot.summary.pullRequestsCounted, 0);
assert.notEqual(pilot.summary.sourceRoot, pilot.summary.adopterRoots[0]);
assert.notEqual(pilot.summary.sourceRoot, pilot.summary.adopterRoots[1]);
assert.notEqual(pilot.summary.adopterRoots[0], pilot.summary.adopterRoots[1]);
for (const adoption of pilot.adoptions) {
  assert.equal(adoption.receipt.basis.observability, 'full_artifact_bundle');
  assert.equal(adoption.receipt.evaluation.adoptionStatus, 'verified_adoption');
  assert.equal(adoption.receipt.evaluation.proofLiquidityEligible, true);
  assert.equal(adoption.receipt.evaluation.checks.notSatisfied, 0);
  assert.equal(adoption.receipt.evaluation.checks.notObservable, 0);
}
assert.equal(pilot.proofLiquidity.snapshot.summary.submittedCards, 3);
assert.equal(pilot.proofLiquidity.snapshot.summary.uniqueCards, 2);
assert.equal(pilot.proofLiquidity.snapshot.summary.verifiedAdoptionUnits, 2);
assert.equal(pilot.proofLiquidity.snapshot.summary.excludedDuplicates, 1);
assert.deepEqual(
  pilot.proofLiquidity.snapshot.excluded[0].duplicateOf,
  ['card', 'receipt', 'graph', 'passport']
);
assert.equal(pilot.discovery.directory.summary.entryCount, 1);
assert.equal(pilot.discovery.directory.summary.verifiedAdoptionUnits, 2);
assert.equal(pilot.discovery.directory.curation.entriesAreEndorsements, false);
assert.equal(pilot.discovery.directory.curation.rankingProvided, false);

const rebuilt = buildRwpExternalAdoptionPilot(basePassport);
assert.equal(canonicalizeJson(rebuilt), canonicalizeJson(pilot));

const explicitAdopterOne = structuredClone(basePassport);
explicitAdopterOne.passportId = 'tpp:external:explicit:001';
explicitAdopterOne.tradeCase.caseReference = 'EXPLICIT-001';
explicitAdopterOne.createdAt = '2026-08-06T00:00:00.000Z';
explicitAdopterOne.updatedAt = '2026-08-06T00:30:00.000Z';
const explicitAdopterTwo = structuredClone(basePassport);
explicitAdopterTwo.passportId = 'tpp:external:explicit:002';
explicitAdopterTwo.tradeCase.caseReference = 'EXPLICIT-002';
explicitAdopterTwo.createdAt = '2026-08-07T00:00:00.000Z';
explicitAdopterTwo.updatedAt = '2026-08-07T00:30:00.000Z';
const explicitPilot = buildRwpExternalAdoptionPilot(
  basePassport,
  [explicitAdopterOne, explicitAdopterTwo],
  { generatedAt: '2026-08-08T00:00:00.000Z' }
);
assert.deepEqual(validateRwpExternalAdoptionPilot(explicitPilot), []);
assert.equal(explicitPilot.pilot.syntheticByDefault, false);
assert.equal(explicitPilot.summary.uniqueAdopterRoots, 2);

const duplicateRoot = structuredClone(pilot);
duplicateRoot.adoptions[1] = structuredClone(duplicateRoot.adoptions[0]);
assert.ok(
  validateRwpExternalAdoptionPilot(duplicateRoot).some((error) =>
    /Passport roots must be unique|summary|public projection/.test(error)
  )
);

const partial = structuredClone(pilot);
partial.adoptions[0].receipt.basis.observability = 'graph_only';
assert.ok(
  validateRwpExternalAdoptionPilot(partial).some((error) =>
    /full_artifact_bundle|Receipt/.test(error)
  )
);

const tamperedLiquidity = structuredClone(pilot);
tamperedLiquidity.proofLiquidity.snapshot.summary.verifiedAdoptionUnits = 99;
assert.ok(
  validateRwpExternalAdoptionPilot(tamperedLiquidity).some((error) =>
    /Proof Liquidity|two verified adoption units/.test(error)
  )
);

const publicJson = canonicalizeJson(pilot.publicProjection);
for (const forbidden of [
  'tpp:external-pilot:adopter',
  'Example Exporter Ltd.',
  'party:exporter:example',
  'evidence:purchase-order',
  'evidence://',
  'goodsDescription',
  'computedDigest',
  'secure_data_room',
  'unitPrice',
  'bankAccount'
]) {
  assert.equal(publicJson.includes(forbidden), false, `public Pilot projection leaked ${forbidden}`);
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
  assert.equal(Object.hasOwn(pilot, forbiddenOwner), false, `Pilot created forbidden owner ${forbiddenOwner}`);
}

await writeFile('/tmp/rwp-external-adoption-pilot.json', `${JSON.stringify(pilot, null, 2)}\n`);
await writeFile(
  '/tmp/rwp-external-adoption-pilot-public.json',
  `${JSON.stringify(pilot.publicProjection, null, 2)}\n`
);

console.log('PASS: two independent verified Pool adoptions, one duplicate rejection, two Proof Liquidity units and one non-ranked Directory entry');
