import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp-evidence.html', import.meta.url), 'utf8');
const responsePage = await readFile(new URL('../docs/rwp-respond.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../docs/rwp-evidence-package.mjs', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-evidence-package-v0.1.md', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/real-world-proof-evidence-package.schema.json', import.meta.url), 'utf8'));
const sitemap = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');

for (const phrase of [
  'Prepare an Authorized Evidence Package',
  'Deliver evidence',
  'not public secrets',
  'Local-only package builder',
  'Verified authorization chain',
  'Import complete Passport',
  'Authorized evidence records',
  'Verify Passport and list evidence',
  'Generate Evidence Package Manifest',
  'Download manifest JSON',
  'Copy package digest',
  'The manifest does not contain the source files',
  'never encoded into the page URL'
]) {
  assert.ok(page.includes(phrase), `missing evidence package page phrase: ${phrase}`);
}

for (const phrase of [
  'rwp-card.mjs',
  'rwp-request.mjs',
  'rwp-request-response.mjs',
  'rwp-evidence-package.mjs',
  'computePassportDigest',
  'buildRwpEvidencePackage',
  'verifyEvidenceFileBytes',
  "['accept','partially_accept']",
  "response.fulfillment.mode!=='authorized_off_channel'"
]) {
  assert.ok(page.includes(phrase), `missing evidence package page contract: ${phrase}`);
}

assert.doesNotMatch(page, /fetch\s*\(/);
assert.doesNotMatch(page, /XMLHttpRequest|WebSocket|sendBeacon/);
assert.doesNotMatch(page, /eth_sendTransaction|eth_sendRawTransaction/);
assert.doesNotMatch(page, /private\s*key|seed\s*phrase/i);
assert.doesNotMatch(page, /claim\s+now|buy\s+TPROOF/i);
assert.doesNotMatch(page, /buildRwpEvidencePackageUrl|encodeRwpEvidencePackage|readRwpEvidencePackageFromHash/);
assert.match(page, /URL\.createObjectURL/);
assert.match(page, /selected\.arrayBuffer\(\)/);
assert.match(page, /file\.size>5_000_000/);

for (const phrase of [
  'real-world-proof-evidence-package',
  'RWP_EVIDENCE_PACKAGE_ASSURANCE',
  'Imported Passport digest does not match',
  'accepted or partially accepted',
  'authorized_off_channel',
  'which the Response did not authorize',
  'packageDigest does not match',
  'verifyEvidenceFileBytes',
  'unsupported_algorithm'
]) {
  assert.ok(moduleSource.includes(phrase), `missing Evidence Package module contract: ${phrase}`);
}
assert.doesNotMatch(moduleSource, /eth_sendTransaction|eth_sendRawTransaction/);
assert.doesNotMatch(moduleSource, /buildRwpEvidencePackageUrl|encodeRwpEvidencePackage/);

for (const phrase of [
  '# Real-World Proof Evidence Package v0.1',
  'must not be embedded in a public URL',
  'The imported Passport digest MUST equal',
  'selected evidence record is authorized',
  'does not prove that delivery occurred',
  'A copied link or downloaded manifest is not, by itself, a contribution event'
]) {
  assert.ok(standard.includes(phrase), `missing Evidence Package standard invariant: ${phrase}`);
}

assert.equal(schema.properties.format.const, 'real-world-proof-evidence-package');
assert.equal(schema.properties.authorization.properties.fulfillmentMode.const, 'authorized_off_channel');
assert.ok(schema.properties.authorization.properties.responseDecision.enum.includes('partially_accept'));
assert.ok(schema.properties.evidence.items.properties.fileVerification.properties.status.enum.includes('mismatch'));

assert.match(responsePage, /rwp-evidence\.html/);
assert.match(responsePage, /Prepare evidence package/);
assert.match(sitemap, /rwp-evidence\.html/);

console.log('PASS: local-only authorized Evidence Package page, response entry and no-public-URL boundary');
