import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp-resolve.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../docs/rwp-evidence-resolution.mjs', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-evidence-resolution-v0.1.md', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/real-world-proof-evidence-resolution.schema.json', import.meta.url), 'utf8'));
const sitemap = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');

for (const phrase of [
  'Evidence Resolution',
  'Fix the issue.',
  'Keep the history.',
  'Append-only and local',
  'Prepare a Resolution Package',
  'Verify the Resolution',
  'Prior Evidence Package JSON file',
  'Prior Evidence Receipt JSON file',
  'Complete Passport JSON file',
  'Verify chain and list resolvable evidence',
  'Generate Resolution Package',
  'Download Resolution JSON',
  'Generate Resolution Receipt',
  'Download private Receipt JSON',
  'Copy public Resolution Card',
  'All prior issues addressed',
  'resolved / unresolved',
  'does not erase the prior mismatch'
]) {
  assert.ok(page.includes(phrase), `missing Resolution page phrase: ${phrase}`);
}

for (const phrase of [
  'buildRwpEvidenceResolution',
  'validateRwpEvidenceResolution',
  'buildRwpEvidenceResolutionReceipt',
  'buildRwpEvidenceResolutionCard',
  'buildRwpEvidenceResolutionCardUrl',
  'readRwpEvidenceResolutionCardFromHash',
  'verifyResolutionEvidenceFileBytes',
  'redelivery',
  'supplemental',
  'combined',
  'resolved',
  'unresolved',
  'request_more',
  'priorReceiptDigest',
  'resolutionDigest does not match',
  'No unresolved issue'
]) {
  assert.ok(moduleSource.includes(phrase), `missing Resolution module contract: ${phrase}`);
}

for (const phrase of [
  '# Real-World Proof Evidence Resolution v0.1',
  'It never edits or deletes the prior Evidence Package or Receipt',
  'New evidence cannot erase an earlier mismatch',
  'A supplement cannot introduce a new category',
  'resolution.complete = true',
  'does not mean the recipient received the files',
  'DAO vote != evidence resolution',
  'Token balance != file validity'
]) {
  assert.ok(standard.includes(phrase), `missing Resolution standard invariant: ${phrase}`);
}

assert.equal(schema.title, 'Real-World Proof Evidence Resolution v0.1');
assert.equal(schema.$defs.resolution.properties.format.const, 'real-world-proof-evidence-resolution');
assert.equal(schema.$defs.receipt.properties.format.const, 'real-world-proof-evidence-resolution-receipt');
assert.equal(schema.$defs.card.properties.format.const, 'real-world-proof-evidence-resolution-card');

assert.match(page, /type="file"/);
assert.match(page, /arrayBuffer\(\)/);
assert.match(page, /downloadJson/);
assert.match(page, /navigator\.clipboard/);
assert.match(page, /buildRwpEvidenceResolutionCardUrl/);
assert.match(page, /location\.hash/);
assert.doesNotMatch(page, /\bfetch\s*\(/);
assert.doesNotMatch(page, /XMLHttpRequest/);
assert.doesNotMatch(page, /WebSocket/);
assert.doesNotMatch(page, /sendBeacon/);
assert.doesNotMatch(page, /eth_sendTransaction|eth_sendRawTransaction/);
assert.doesNotMatch(page, /private\s*key/i);
assert.doesNotMatch(page, /seed\s*phrase/i);
assert.doesNotMatch(page, /claim\s+now/i);
assert.doesNotMatch(page, /buy\s+TPROOF/i);

assert.doesNotMatch(moduleSource, /eth_sendTransaction|eth_sendRawTransaction/);
assert.doesNotMatch(moduleSource, /\bfetch\s*\(/);
assert.ok(moduleSource.includes("new URLSearchParams({ resolution: encodeRwpEvidenceResolutionCard(card) })"));
assert.equal(moduleSource.includes('encodeRwpEvidenceResolution('), false, 'private Resolution Package must not have a public URL encoder');
assert.equal(moduleSource.includes('encodeRwpEvidenceResolutionReceipt('), false, 'private Resolution Receipt must not have a public URL encoder');
assert.match(sitemap, /rwp-resolve\.html/);

console.log('PASS: append-only local Evidence Resolution page and privacy-bounded public Resolution Card');
