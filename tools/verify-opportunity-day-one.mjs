#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectTedOpportunities } from './collect-ted-opportunities.mjs';
import { normalizeTedNotice, validateOpportunity } from './opportunity-core.mjs';

const observedAt = '2026-08-02T11:30:00.000Z';
const fixture = 'examples/opportunity-day-one/ted-response.fixture.json';
const outputDir = await mkdtemp(join(tmpdir(), 'tradeproof-opportunity-day-one-'));
const out = join(outputDir, 'opportunities.json');
const report = join(outputDir, 'report.md');

const collection = await collectTedOpportunities({
  fixture,
  limit: 10,
  since: '20260801',
  observedAt,
  out,
  report
});

assert.equal(collection.schemaVersion, 'tradeproof.opportunity-collection.v0.1');
assert.equal(collection.counts.observed, 3);
assert.equal(collection.counts.uniqueOpportunities, 2);
assert.equal(collection.counts.duplicateObservationsRejected, 1);
assert.equal(collection.counts.requiresEligibilityReview, 2);
assert.equal(collection.opportunities[0].participation.chinaSupplierEligibility, 'unknown');
assert.match(collection.opportunities[0].opportunityDigest, /^sha256:[0-9a-f]{64}$/);
assert.deepEqual(validateOpportunity(collection.opportunities[0]), []);

const raw = JSON.parse(await readFile(fixture, 'utf8')).notices[0];
const first = normalizeTedNotice(raw, { observedAt });
const second = normalizeTedNotice(raw, { observedAt });
assert.equal(first.opportunityDigest, second.opportunityDigest, 'same observation must be deterministic');

const markdown = await readFile(report, 'utf8');
assert.match(markdown, /Unique opportunities: 2/);
assert.match(markdown, /These are source observations, not verified buyer endorsements/);

console.log('PASS: Day-one source registry, TED normalization, deterministic digest, dedupe and report boundaries');
console.log(`Fixture output: ${out}`);
