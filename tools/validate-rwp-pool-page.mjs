import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp-pool.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../docs/rwp-proof-pool.mjs', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-trade-pool-v0.1.md', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/real-world-proof-trade-pool.schema.json', import.meta.url), 'utf8'));
const sitemap = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');

for (const phrase of [
  'Fork the proof.',
  'Not the secret.',
  'Proof liquidity',
  'Trade Pool v0.1',
  'A Trade Pool is a public rules object—not a shared trade database.',
  'Publish or fork a Pool',
  'Local Case Graph or Timeline Card',
  'Operator-declared roles',
  'Operator-declared evidence categories',
  'Required state gates',
  'Generate Trade Pool',
  'Fork shared Pool',
  'Copy Pool link',
  'Download Pool JSON',
  'Start independent RWP',
  'Zero source trade-data copying',
  'Pool popularity, fork count, DAO vote or Token balance cannot prove a trade fact'
]) assert.ok(page.includes(phrase), `missing Trade Pool page phrase: ${phrase}`);

for (const phrase of [
  'buildRwpProofPattern',
  'validateRwpProofPattern',
  'buildRwpTradePool',
  'validateRwpTradePool',
  'forkRwpTradePool',
  'encodeRwpTradePool',
  'decodeRwpTradePool',
  'buildRwpTradePoolUrl',
  'readRwpTradePoolFromHash',
  'operator_declared',
  'pool_operator_declared',
  'independent_rwp_only',
  'explicit_graph',
  'sequence_only',
  'forkedFromPoolDigest',
  'Forking copies public rules only'
]) assert.ok(moduleSource.includes(phrase), `missing Trade Pool module contract: ${phrase}`);

for (const phrase of [
  '# Real-World Proof Pattern and Trade Pool v0.1',
  'The Pool is not a shared trade database',
  'Derived workflow',
  'Declared requirements',
  'relationCoverage',
  'reuseMode = independent_rwp_only',
  'Forking or adopting a Pool copies only public rules',
  'Each adopter must create its own RWP objects',
  'generation = parent.generation + 1',
  'DAO vote != real-world truth',
  'Token balance != evidence validity',
  'Pool popularity != compliance',
  'Fork count != successful trade'
]) assert.ok(standard.includes(phrase), `missing Trade Pool standard invariant: ${phrase}`);

assert.equal(schema.title, 'Real-World Proof Pattern and Trade Pool v0.1');
assert.equal(schema.$defs.proofPattern.properties.format.const, 'real-world-proof-pattern');
assert.equal(schema.$defs.tradePool.properties.format.const, 'real-world-proof-trade-pool');
assert.equal(schema.$defs.tradePool.properties.publicRules.properties.reuseMode.const, 'independent_rwp_only');

assert.match(page, /type="file"/);
assert.match(page, /file\.text\(\)/);
assert.match(page, /navigator\.clipboard/);
assert.match(page, /downloadJson/);
assert.match(page, /buildRwpTradePoolUrl/);
assert.match(page, /forkRwpTradePool/);
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

assert.doesNotMatch(moduleSource, /\bfetch\s*\(/);
assert.doesNotMatch(moduleSource, /eth_sendTransaction|eth_sendRawTransaction/);
assert.ok(moduleSource.includes("new URLSearchParams({ pool: encodeRwpTradePool(pool) })"));
assert.equal(moduleSource.includes('encodeRwpCaseGraph('), false, 'private Case Graph must not have a Pool URL encoder');
assert.equal(moduleSource.includes('encodeRwpEvidencePackage('), false, 'private Evidence Package must not enter a Pool URL');
assert.equal(moduleSource.includes('encodeRwpEvidenceReceipt('), false, 'private Evidence Receipt must not enter a Pool URL');
assert.equal(moduleSource.includes('encodeRwpEvidenceResolution('), false, 'private Resolution must not enter a Pool URL');
assert.match(sitemap, /rwp-pool\.html/);

console.log('PASS: local Proof Pattern extraction, public Trade Pool sharing, fork lineage and zero source-data URL leakage');
