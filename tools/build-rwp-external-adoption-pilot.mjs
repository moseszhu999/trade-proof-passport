import { readFile, writeFile } from 'node:fs/promises';
import {
  buildRwpExternalAdoptionPilot,
  validateRwpExternalAdoptionPilot
} from '../docs/rwp-external-adoption-pilot.mjs';

const [sourcePath, adopterOnePath, adopterTwoPath, outputPath = '/tmp/rwp-external-adoption-pilot.json'] = process.argv.slice(2);
if (!sourcePath || !adopterOnePath || !adopterTwoPath) {
  console.error('Usage: node tools/build-rwp-external-adoption-pilot.mjs <source-passport.json> <adopter-one-passport.json> <adopter-two-passport.json> [output.json]');
  process.exit(1);
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const [sourcePassport, adopterOne, adopterTwo] = await Promise.all([
  readJson(sourcePath),
  readJson(adopterOnePath),
  readJson(adopterTwoPath)
]);

const pilot = buildRwpExternalAdoptionPilot(sourcePassport, [adopterOne, adopterTwo], {
  generatedAt: new Date().toISOString()
});
const errors = validateRwpExternalAdoptionPilot(pilot);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
await writeFile(outputPath, `${JSON.stringify(pilot, null, 2)}\n`);
console.log(`PASS: wrote validated External Adoption Pilot to ${outputPath}`);
