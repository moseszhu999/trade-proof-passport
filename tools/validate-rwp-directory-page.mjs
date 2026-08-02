import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp-directory.html', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-pool-directory-v0.1.md', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/real-world-proof-pool-directory.schema.json', import.meta.url), 'utf8'));

for (const marker of [
  'Fork discovery.',
  'Not authority.',
  'A Directory is a discovery manifest—not an endorsement list.',
  'Generate Directory',
  'Fork imported Directory',
  'Copy Directory Card link',
  'Download complete Directory',
  'Shared Directory Card verified.',
  'a complete Manifest is required',
  'entriesAreEndorsements',
  'rankingProvided',
  'open_self_declared',
  'buildRwpPoolDirectoryCardUrl',
  'readRwpPoolDirectoryCardFromHash',
  'DAO may publish or fork a Directory'
]) assert.ok(page.includes(marker), `missing Directory page boundary: ${marker}`);

for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket(',
  'indexedDB',
  'localStorage.setItem',
  'ethereum.request',
  'sendTransaction',
  'writeContract',
  'supabase',
  'firebase',
  'walletconnect'
]) assert.equal(page.includes(forbidden), false, `Directory page contains forbidden runtime marker: ${forbidden}`);

for (const invariant of [
  'open_self_declared',
  'entriesAreEndorsements = false',
  'rankingProvided = false',
  'poolDigest ascending',
  'Pool ID must be unique',
  'Pool digest must be unique',
  'generation = parent.generation + 1',
  'forkedFromDirectoryDigest = parent.directoryDigest',
  'Directory inclusion != endorsement',
  'Directory position != ranking',
  'at most 12 Pool entries',
  'complete Manifest is downloaded as JSON',
  'public Directory Card'
]) assert.ok(standard.includes(invariant), `missing Directory standard invariant: ${invariant}`);

assert.equal(schema.$defs.directory.properties.format.const, 'real-world-proof-pool-directory');
assert.equal(schema.$defs.directoryCard.properties.format.const, 'real-world-proof-pool-directory-card');
assert.equal(schema.$defs.directory.properties.entries.maxItems, 12);
assert.equal(schema.$defs.directory.properties.directoryId.pattern, '^rwpdir:[0-9a-f]{16}$');
assert.equal(schema.$defs.directoryCard.properties.cardId.pattern, '^rwpdircard:[0-9a-f]{16}$');
assert.equal(schema.$defs.curation.properties.mode.const, 'open_self_declared');
assert.equal(schema.$defs.curation.properties.entriesAreEndorsements.const, false);
assert.equal(schema.$defs.curation.properties.rankingProvided.const, false);
assert.ok(schema.$defs.summary.required.includes('verifiedAdoptionUnits'));
assert.ok(schema.$defs.projectedEntry.properties.liquidity.$ref.includes('liquidityProjection'));

console.log('PASS: local open Pool Directory builder, verifiable Fork lineage and privacy-bounded unranked discovery surface');
