import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp.html', import.meta.url), 'utf8');
const card = await readFile(new URL('../docs/rwp-card.mjs', import.meta.url), 'utf8');
const request = await readFile(new URL('../docs/rwp-request.mjs', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-core-v0.1.md', import.meta.url), 'utf8');
const requestStandard = await readFile(new URL('../standard/real-world-proof-request-v0.1.md', import.meta.url), 'utf8');
const requestSchema = await readFile(new URL('../schema/real-world-proof-request.schema.json', import.meta.url), 'utf8');
const passportSchema = await readFile(new URL('../schema/trade-proof-passport.schema.json', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');
const createPage = await readFile(new URL('../docs/create.html', import.meta.url), 'utf8');

for (const phrase of [
  'Before RWA',
  'prove reality',
  'Your trade data stays with you',
  'The complete Passport is processed locally',
  'Generate a Viral Proof Card',
  'Copy proof link',
  'Share on X',
  'LinkedIn',
  'Recipient action',
  'Request authorized evidence',
  'Request responsible-role confirmation',
  'Request change or clarification',
  'Generate request JSON & link',
  'Create the next RWP with lineage',
  'Unsigned and self-declared',
  'Agents',
  'RWP',
  'DAO',
  'The crypto playbook',
  'TPROOF holdings and DAO votes cannot change evidence validity'
]) {
  assert.ok(page.includes(phrase), `missing RWP page phrase: ${phrase}`);
}

assert.match(page, /navigator\.share/);
assert.match(page, /twitter\.com\/intent\/tweet/);
assert.match(page, /linkedin\.com\/sharing\/share-offsite/);
assert.match(page, /rwp-card\.mjs/);
assert.match(page, /rwp-request\.mjs/);
assert.match(page, /buildRwpRequestUrl/);
assert.match(page, /buildFollowUpLineage/);
assert.match(page, /pureCardUrl=buildProofCardUrl/);
assert.match(page, /tradeProofRwpLineage/);
assert.match(page, /raw\.githubusercontent\.com\/moseszhu999\/trade-proof-passport\/main\/examples\/steel-cabinet-passport\.json/);
assert.doesNotMatch(page, /private\s*key/i);
assert.doesNotMatch(page, /seed\s*phrase/i);
assert.doesNotMatch(page, /claim\s+now/i);
assert.doesNotMatch(page, /buy\s+TPROOF/i);
assert.doesNotMatch(page, /guaranteed\s+(return|yield|price)/i);

for (const phrase of [
  'real-world-proof-card',
  'privacy-bounded card',
  'sourceDigest',
  'cardDigest',
  'confirmedRoles',
  'respondedRoles',
  'callToAction',
  'cardDigest does not match',
  'forbidden private-field marker'
]) {
  assert.ok(card.includes(phrase), `missing RWP card contract: ${phrase}`);
}
assert.doesNotMatch(card, /eth_sendTransaction|eth_sendRawTransaction/);

for (const phrase of [
  'real-world-proof-request',
  'request_authorized_evidence',
  'request_responsible_confirmation',
  'request_change',
  'RWP_REQUEST_ASSURANCE',
  'requestDigest does not match',
  'buildRwpRequestUrl',
  'readRwpRequestFromHash',
  'buildFollowUpLineage',
  'sourceRequestDigest',
  'forbidden private-field marker'
]) {
  assert.ok(request.includes(phrase), `missing RWP request contract: ${phrase}`);
}
assert.doesNotMatch(request, /eth_sendTransaction|eth_sendRawTransaction/);

for (const phrase of [
  'Before Real-World Assets, there must be Real-World Proof',
  'Trade Proof Passport is the first domain-specific carrier',
  'No provenance record without a claim and evidence reference',
  'DAO governance != real-world truth',
  'Share proofs, not secrets',
  'Page views, wallet connections, empty social posts, copied cards and self-responses are not proof contributions'
]) {
  assert.ok(standard.includes(phrase), `missing RWP standard invariant: ${phrase}`);
}

for (const phrase of [
  '# Real-World Proof Request v0.1',
  'authorized evidence',
  'responsible role',
  'unsigned_self_declared',
  'does not authenticate the requester',
  'Viral lineage',
  'reuses_pattern_from',
  'Copied links, page views, wallet connections, empty social posts and self-generated loops'
]) {
  assert.ok(requestStandard.includes(phrase), `missing RWP request standard invariant: ${phrase}`);
}

const parsedRequestSchema = JSON.parse(requestSchema);
assert.equal(parsedRequestSchema.properties.format.const, 'real-world-proof-request');
assert.ok(parsedRequestSchema.properties.requestedAction.enum.includes('request_authorized_evidence'));
assert.match(passportSchema, /"lineage"/);
assert.match(passportSchema, /"reuses_pattern_from"/);
assert.match(passportSchema, /"sourceRequestDigest"/);

assert.match(createPage, /tradeProofRwpLineage/);
assert.match(createPage, /reuses_pattern_from/);
assert.match(createPage, /Lineage records workflow reuse only/);
assert.match(sitemap, /rwp\.html/);

console.log('PASS: RWP category narrative, privacy boundary, recipient requests and useful viral lineage');
