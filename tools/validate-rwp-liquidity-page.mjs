import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../docs/rwp-liquidity.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../docs/rwp-proof-liquidity.mjs', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-liquidity-v0.1.md', import.meta.url), 'utf8');

for (const required of [
  'Proof Liquidity v0.1',
  'Count proof.',
  'Not attention.',
  'Generate Snapshot',
  'Copy Snapshot Card',
  'Download complete Snapshot',
  'verifiedAdoptionUnits',
  'excludedDuplicates',
  'buildRwpProofLiquiditySnapshot',
  'buildRwpProofLiquidityCard',
  'readRwpProofLiquidityCardFromHash',
  'A shared Card does not contain the complete Snapshot',
  'No individual adopter digest entered the URL'
]) assert.ok(html.includes(required), `missing Proof Liquidity page invariant: ${required}`);

for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'sendTransaction',
  'eth_sendTransaction',
  'supabase',
  'firebase',
  'localStorage.setItem',
  'sessionStorage.setItem'
]) assert.equal(html.includes(forbidden), false, `Proof Liquidity page introduced forbidden runtime: ${forbidden}`);

assert.ok(html.includes('type="file"'));
assert.ok(html.includes('multiple'));
assert.ok(html.includes('URL.createObjectURL'));
assert.ok(html.includes('navigator.clipboard.writeText'));
assert.ok(moduleSource.includes("url.hash = new URLSearchParams({ liquidity:"));
assert.ok(moduleSource.includes("url.pathname = url.pathname.replace(/[^/]*$/, 'rwp-liquidity.html')"));
assert.equal(moduleSource.includes('adoptionCards: snapshot.inputs.adoptionCards'), false, 'public Snapshot Card must not include source Adoption Cards');

for (const required of [
  'One verified proof-liquidity unit',
  'unique Passport root',
  'duplicate submissions never increase',
  'does not require a central index',
  'Snapshot proves only the exact card set',
  'page view',
  'empty Pool fork',
  'Token balance != Proof Liquidity'
]) assert.ok(standard.includes(required), `missing Proof Liquidity standard invariant: ${required}`);

console.log('PASS: local duplicate-resistant Proof Liquidity Snapshot page and privacy-bounded public Card');
