import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp-adopt.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../docs/rwp-pool-adoption.mjs', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-pool-adoption-v0.1.md', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/real-world-proof-pool-adoption.schema.json', import.meta.url), 'utf8'));
const sitemap = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');

for (const phrase of [
  'Proof Liquidity · Adoption Receipt v0.1',
  'Count adoption.',
  'Not attention.',
  'Views and empty forks do not count.',
  'Verify Pool adoption',
  'Trade Pool JSON',
  'Independent Case Graph JSON',
  'Optional complete source artifact bundle',
  'Generate Adoption Receipt',
  'Copy Adoption Card',
  'Download private Receipt',
  'PROOF LIQUIDITY ELIGIBLE',
  'not_observable',
  'Full business artifacts stay in the browser.'
]) assert.ok(page.includes(phrase), `missing Pool adoption page phrase: ${phrase}`);

for (const phrase of [
  'buildRwpPoolAdoptionReceipt',
  'validateRwpPoolAdoptionReceipt',
  'buildRwpPoolAdoptionCard',
  'validateRwpPoolAdoptionCard',
  'buildRwpPoolAdoptionCardUrl',
  'readRwpPoolAdoptionCardFromHash',
  'verified_adoption',
  'partial_adoption',
  'not_adopted',
  'graph_only',
  'full_artifact_bundle',
  'not_observable',
  'proofLiquidityEligible',
  'Imported source artifacts do not reproduce',
  'Pool adoption requires an independent RWP root'
]) assert.ok(moduleSource.includes(phrase), `missing Pool adoption module contract: ${phrase}`);

for (const phrase of [
  '# Real-World Proof Pool Adoption Receipt v0.1',
  'adoption.graph.passportDigest != pool.proofPattern.source.passportDigest',
  'Every bounded requirement receives one of three statuses.',
  'requested but unmatched evidence',
  'one verified independent RWP adoption',
  'Proof Liquidity is not asset liquidity',
  'Fork count != Proof Liquidity',
  'DAO vote != verified adoption',
  'The full Receipt is a local download and is not encoded into a public URL.'
]) assert.ok(standard.includes(phrase), `missing Pool adoption standard invariant: ${phrase}`);

assert.equal(schema.title, 'Real-World Proof Pool Adoption v0.1');
assert.equal(schema.$defs.receipt.properties.format.const, 'real-world-proof-pool-adoption-receipt');
assert.equal(schema.$defs.card.properties.format.const, 'real-world-proof-pool-adoption-card');

assert.match(page, /type="file"/);
assert.match(page, /multiple/);
assert.match(page, /\.text\(\)/);
assert.match(page, /navigator\.clipboard/);
assert.match(page, /buildRwpPoolAdoptionCardUrl/);
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
assert.ok(moduleSource.includes("new URLSearchParams({ adoption: encodeRwpPoolAdoptionCard(card) })"));
assert.equal(moduleSource.includes('encodeRwpPoolAdoptionReceipt'), false, 'full Adoption Receipt must not have a public URL encoder');
assert.match(sitemap, /rwp-adopt\.html/);

console.log('PASS: local Pool adoption verification and privacy-bounded Proof Liquidity card');
