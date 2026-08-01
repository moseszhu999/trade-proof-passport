import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp-respond.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../docs/rwp-request-response.mjs', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-request-response-v0.1.md', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/real-world-proof-request-response.schema.json', import.meta.url), 'utf8'));
const requestModule = await readFile(new URL('../docs/rwp-request.mjs', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');

for (const phrase of [
  'Respond without',
  'publishing secrets',
  'Verified incoming request',
  'Holder response',
  'Accept',
  'Partially accept',
  'Request clarification',
  'Decline',
  'Authorized off-channel',
  'Generate response JSON & link',
  'Copy response link',
  'Download response JSON',
  'unsigned and self-declared',
  'No document is uploaded here',
  'No contact endpoints or confidential content'
]) {
  assert.ok(page.includes(phrase), `missing holder response page phrase: ${phrase}`);
}

for (const phrase of [
  'rwp-card.mjs',
  'rwp-request.mjs',
  'rwp-request-response.mjs',
  'buildRwpRequestResponse',
  'buildRwpRequestResponseUrl',
  'readRwpRequestResponseFromHash',
  'RWP Request source does not match the Proof Card'
]) {
  assert.ok(page.includes(phrase), `missing holder response page contract: ${phrase}`);
}

for (const phrase of [
  'real-world-proof-request-response',
  'partially_accept',
  'authorized_off_channel',
  'responseDigest does not match',
  'Complete acceptance must offer every requested evidence category',
  'forbidden private or endpoint marker',
  'buildRwpRequestResponseUrl',
  'readRwpRequestResponseFromHash'
]) {
  assert.ok(moduleSource.includes(phrase), `missing response module contract: ${phrase}`);
}

for (const phrase of [
  '# Real-World Proof Request Response v0.1',
  'The response is bound to the source Passport digest',
  'does not prove delivery',
  'non-empty proper subset',
  'Every v0.1 response is unsigned and self-declared',
  'Generating or copying a Response is not automatically a contribution event'
]) {
  assert.ok(standard.includes(phrase), `missing response standard invariant: ${phrase}`);
}

assert.equal(schema.properties.format.const, 'real-world-proof-request-response');
assert.ok(schema.properties.decision.properties.status.enum.includes('decline'));
assert.ok(schema.properties.fulfillment.properties.mode.enum.includes('authorized_off_channel'));
assert.match(requestModule, /rwp-respond\.html/);
assert.match(sitemap, /rwp-respond\.html/);

for (const unsafe of [
  /private\s*key/i,
  /seed\s*phrase/i,
  /claim\s+now/i,
  /buy\s+TPROOF/i,
  /guaranteed\s+(return|yield|price)/i,
  /eth_sendTransaction|eth_sendRawTransaction/
]) {
  assert.doesNotMatch(`${page}\n${moduleSource}`, unsafe);
}

console.log('PASS: holder-side RWP Request Response page, source binding and privacy boundaries');
