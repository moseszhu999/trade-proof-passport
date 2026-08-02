import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp-graph.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../docs/rwp-case-graph.mjs', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-case-graph-v0.1.md', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/real-world-proof-case-graph.schema.json', import.meta.url), 'utf8'));
const sitemap = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');

for (const phrase of [
  'RWP Case Graph',
  'Prove the sequence.',
  'Not the secrets.',
  'Local graph, public projection.',
  'Build a Case Graph',
  'RWP JSON files',
  'Artifact JSON array',
  'Verify and build graph',
  'Download Case Graph',
  'Download Timeline Card',
  'Copy public timeline',
  'Verified timeline',
  'Current state',
  'Projection digest',
  'mixed Passport roots',
  'child events that predate their declared parents',
  'does not authenticate organizations'
]) assert.ok(page.includes(phrase), `missing graph page phrase: ${phrase}`);

for (const phrase of [
  'buildRwpCaseGraph',
  'validateRwpCaseGraph',
  'buildRwpTimelineCard',
  'validateRwpTimelineCard',
  'encodeRwpTimelineCard',
  'decodeRwpTimelineCard',
  'buildRwpTimelineCardUrl',
  'readRwpTimelineCardFromHash',
  'projects_to',
  'requests_from',
  'responds_to',
  'packages_for',
  'receives',
  'resolves_package',
  'resolves_receipt',
  'verifies_resolution',
  'chronology violation',
  'belongs to a different Passport root',
  'Duplicate graph node id'
]) assert.ok(moduleSource.includes(phrase), `missing graph module contract: ${phrase}`);

for (const phrase of [
  '# Real-World Proof Case Graph v0.1',
  'one graph',
  '= one Passport root digest',
  'child.at >= parent.at',
  'All three events remain visible',
  'later Resolution Receipt satisfied its deterministic conditions',
  'Only the Timeline Card may be encoded in a public URL',
  'DAO governance != graph truth',
  'Token balance != artifact validity',
  'later resolution != erased history'
]) assert.ok(standard.includes(phrase), `missing graph standard invariant: ${phrase}`);

assert.equal(schema.title, 'Real-World Proof Case Graph v0.1');
assert.equal(schema.$defs.graph.properties.format.const, 'real-world-proof-case-graph');
assert.equal(schema.$defs.timelineCard.properties.format.const, 'real-world-proof-timeline-card');
assert.equal(schema.$defs.graph.properties.additionalProperties, undefined);

assert.match(page, /type="file"[^>]*multiple/);
assert.match(page, /file\.text\(\)/);
assert.match(page, /downloadJson/);
assert.match(page, /navigator\.clipboard/);
assert.match(page, /buildRwpTimelineCardUrl/);
assert.match(page, /readRwpTimelineCardFromHash/);
assert.match(page, /location\.hash/);
assert.match(page, /event\.status/);
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
assert.ok(moduleSource.includes("new URLSearchParams({ timeline: encodeRwpTimelineCard(card) })"));
assert.equal(moduleSource.includes('encodeRwpCaseGraph('), false, 'private Case Graph must not have a public URL encoder');
assert.equal(moduleSource.includes('buildRwpCaseGraphUrl('), false, 'private Case Graph must not have a public URL builder');
assert.equal(moduleSource.includes('encodeProofCard('), false, 'source Proof Card must not be nested into Timeline URL');
assert.equal(moduleSource.includes('encodeRwpRequest('), false, 'source Request must not be nested into Timeline URL');
assert.equal(moduleSource.includes('encodeRwpEvidencePackage('), false, 'source Evidence Package must not be nested into Timeline URL');
assert.match(sitemap, /rwp-graph\.html/);

console.log('PASS: local RWP Case Graph surface and privacy-bounded viral Timeline Card');
