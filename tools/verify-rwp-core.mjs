import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { computeArtifactHashes } from '../docs/registry-client.mjs';
import {
  RWP_CARD_ASSURANCE,
  buildProofCard,
  buildProofCardUrl,
  canonicalizeJson,
  computePassportDigest,
  decodeProofCard,
  encodeProofCard,
  readProofCardFromHash,
  validateProofCard
} from '../docs/rwp-card.mjs';

const passport = JSON.parse(
  await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8')
);

assert.equal(passport.provenance.length, 4);
assert.deepEqual(
  passport.facts.map((fact) => fact.provenanceRefs.length),
  [1, 2, 1]
);
assert.ok(passport.provenance.every((item) => item.review?.reviewedBy));
assert.ok(passport.provenance.some((item) => item.extraction.method === 'agent_assisted'));
assert.ok(passport.provenance.some((item) => item.extraction.method === 'system_event'));

assert.equal(canonicalizeJson({ z: 1, a: { y: 2, b: 3 } }), '{"a":{"b":3,"y":2},"z":1}');
const digest = computePassportDigest(passport);
assert.match(digest, /^0x[0-9a-f]{64}$/);
assert.equal(digest, computePassportDigest(JSON.parse(JSON.stringify(passport))));
assert.equal(digest, computeArtifactHashes(passport).digest, 'RWP card and Registry digest profiles diverged');

const card = buildProofCard(passport, { publicLabel: 'Synthetic export proof' });
assert.equal(card.publicLabel, 'Synthetic export proof');
assert.equal(card.sourceDigest, digest);
assert.equal(card.lifecycleStatus, 'active');
assert.deepEqual(card.claims, {
  total: 3,
  evidenceBacked: 3,
  confirmed: 2,
  disputed: 0,
  revoked: 0
});
assert.deepEqual(card.evidence, { total: 4, publicSummary: 2 });
assert.deepEqual(card.provenance, { total: 4, reviewed: 4, coveredClaims: 3 });
assert.deepEqual(card.confirmations, {
  total: 3,
  confirmedRoles: ['buyer', 'inspection'],
  respondedRoles: ['buyer', 'inspection', 'logistics']
});
assert.equal(card.assurance, RWP_CARD_ASSURANCE);
assert.deepEqual(validateProofCard(card), []);

const serializedCard = canonicalizeJson(card);
for (const forbidden of [
  'Example Exporter Ltd.',
  'Example Buyer Inc.',
  'party:exporter:example',
  'evidence://private',
  '1111111111111111111111111111111111111111111111111111111111111111',
  'The purchase order covers 240',
  'Synthetic confirmation for demonstration only.'
]) {
  assert.equal(serializedCard.includes(forbidden), false, `card leaked ${forbidden}`);
}

const payload = encodeProofCard(card);
assert.ok(payload.length < 6000);
assert.deepEqual(decodeProofCard(payload), card);
const url = buildProofCardUrl(card, 'https://example.test/rwp.html?unsafe=removed#old=1');
assert.equal(new URL(url).search, '');
assert.deepEqual(readProofCardFromHash(new URL(url).hash), card);

const tampered = { ...card, publicLabel: 'Tampered label' };
assert.match(validateProofCard(tampered).join(' '), /cardDigest/);
assert.throws(() => decodeProofCard(Buffer.from(JSON.stringify(tampered)).toString('base64url')), /cardDigest/);
assert.throws(() => buildProofCard(passport, { publicLabel: 'x'.repeat(97) }), /96/);
assert.throws(() => canonicalizeJson({ value: Number.POSITIVE_INFINITY }), /non-finite/);

console.log('PASS: RWP provenance, privacy-bounded projection, Registry-aligned digest and viral card integrity');
