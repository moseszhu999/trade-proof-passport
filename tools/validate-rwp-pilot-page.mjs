import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../docs/rwp-pilot.html', import.meta.url), 'utf8');

for (const required of [
  'External Adoption Pilot Kit',
  'local files only',
  'Use only synthetic, already-public, or explicitly authorized data.',
  'Files stay in this browser and are not uploaded by this page.',
  'full_artifact_bundle',
  'verified_adoption',
  'Proof Liquidity eligible',
  'Page views, empty forks, stars, and pull requests count as zero.',
  "from './rwp-external-adoption-pilot.mjs'",
  'buildRwpExternalAdoptionPilot',
  'validateRwpExternalAdoptionPilot',
  'Download public projection',
  'Download complete local pack'
]) {
  assert.ok(html.includes(required), `Pilot page is missing required contract text: ${required}`);
}

for (const forbidden of [
  'connect wallet',
  'Connect Wallet',
  'submit to chain',
  'financial liquidity score',
  'identity verified',
  'legal approval granted',
  'automatic attestation',
  'upload to our server'
]) {
  assert.equal(html.includes(forbidden), false, `Pilot page contains forbidden claim: ${forbidden}`);
}

assert.ok(html.includes('https://raw.githubusercontent.com/moseszhu999/trade-proof-passport/main/examples/steel-cabinet-passport.json'));
assert.ok(html.includes('pilot.publicProjection'));
assert.ok(html.includes('pilot.summary.verifiedAdoptionUnits'));
assert.ok(html.includes('pilot.summary.duplicateSubmissionsRejected'));
assert.ok(html.includes('pilot.summary.uniqueAdopterRoots'));

console.log('PASS: local-only External Adoption Pilot page, public-data warning, two-unit acceptance facts and no wallet, chain, identity or settlement claims');
