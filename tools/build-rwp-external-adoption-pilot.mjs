import { readFile, writeFile } from 'node:fs/promises';
import {
  buildRwpExternalAdoptionPilot,
  validateRwpExternalAdoptionPilot
} from '../docs/rwp-external-adoption-pilot.mjs';

const [
  sourcePath,
  adopterOnePath,
  adopterTwoPath,
  outputPath = '/tmp/rwp-external-adoption-pilot.json',
  projectionPath = '/tmp/rwp-external-adoption-pilot-public.json'
] = process.argv.slice(2);

if (!sourcePath || !adopterOnePath || !adopterTwoPath) {
  console.error(
    'Usage: node tools/build-rwp-external-adoption-pilot.mjs <source-passport.json> <adopter-one-passport.json> <adopter-two-passport.json> [pilot-output.json] [public-projection-output.json]'
  );
  process.exit(1);
}

if (outputPath === projectionPath) {
  console.error('Pilot output and public projection output must use different paths.');
  process.exit(1);
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [sourcePassport, adopterOne, adopterTwo] = await Promise.all([
  readJson(sourcePath),
  readJson(adopterOnePath),
  readJson(adopterTwoPath)
]);

const pilot = buildRwpExternalAdoptionPilot(
  sourcePassport,
  [adopterOne, adopterTwo],
  { generatedAt: new Date().toISOString() }
);
const errors = validateRwpExternalAdoptionPilot(pilot);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

await Promise.all([
  writeFile(outputPath, `${JSON.stringify(pilot, null, 2)}\n`),
  writeFile(
    projectionPath,
    `${JSON.stringify(pilot.publicProjection, null, 2)}\n`
  )
]);

console.log(`PASS: wrote validated External Adoption Pilot to ${outputPath}`);
console.log(`PASS: wrote exact public projection to ${projectionPath}`);
