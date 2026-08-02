import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp-case-study.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../docs/rwp-pool-adoption-case-study.mjs', import.meta.url), 'utf8');
const caseStudy = await readFile(new URL('../docs/case-studies/rwp-pool-adoption-case-study-v0.1.md', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');

for (const marker of [
  'One adoption.',
  'Recomputed end to end.',
  'Synthetic data only.',
  'Recompute acceptance pack',
  'Download complete synthetic pack',
  'Download public digest summary',
  'Graph-only',
  'Full bundle',
  'Proof Liquidity',
  'No Attestation or Settlement owner is created.',
  'viewsCounted',
  'emptyForksCounted',
  'loadRwpPoolAdoptionCaseStudy',
  'validateRwpPoolAdoptionCaseStudy',
  'Proof Liquidity remains a verified protocol-adoption count—not financial liquidity.'
]) assert.ok(page.includes(marker), `missing Case Study page marker: ${marker}`);

for (const marker of [
  'buildRwpPoolAdoptionCaseStudy',
  'validateRwpPoolAdoptionCaseStudy',
  'loadRwpPoolAdoptionCaseStudy',
  'RWP_POOL_ADOPTION_CASE_STUDY_SOURCE_URL',
  "graphOnlyStatus: 'partial_adoption'",
  "verifiedStatus: 'verified_adoption'",
  'proofLiquidityUnits: 1',
  'duplicateSubmissionsRejected: 1',
  'viewsCounted: 0',
  'emptyForksCounted: 0',
  'no_attestation_authority',
  'no_payment_or_settlement',
  'no_chain_write'
]) assert.ok(moduleSource.includes(marker), `missing Case Study module contract: ${marker}`);

for (const invariant of [
  'Non-normative synthetic acceptance pack',
  'No new table, RPC, database, registry, identity service, Attestation owner or Settlement owner is introduced.',
  'adoptionStatus = partial_adoption',
  'proofLiquidityEligible = false',
  'adoptionStatus = verified_adoption',
  'proofLiquidityEligible = true',
  'submittedCards = 2',
  'uniqueCards = 1',
  'verifiedAdoptionUnits = 1',
  'excludedDuplicates = 1',
  'duplicate dimensions = card + receipt + graph + passport',
  'entriesAreEndorsements = false',
  'rankingProvided = false',
  'viewsCounted = 0',
  'emptyForksCounted = 0',
  'public GitHub Actions workflow, not in a private-repository CI carrier'
]) assert.ok(caseStudy.includes(invariant), `missing Case Study invariant: ${invariant}`);

for (const forbidden of [
  'indexedDB',
  'localStorage.setItem',
  'sessionStorage.setItem',
  'XMLHttpRequest',
  'WebSocket(',
  'ethereum.request',
  'sendTransaction',
  'writeContract',
  'supabase',
  'firebase',
  'walletconnect',
  'location.hash',
  'URLSearchParams(',
  'history.pushState',
  'history.replaceState'
]) assert.equal(page.includes(forbidden), false, `Case Study page contains forbidden runtime or share marker: ${forbidden}`);

for (const forbiddenOwner of [
  'caseStudyId',
  'caseStudyDigest',
  "format: 'real-world-proof-case-study'",
  'buildAttestation',
  'buildSettlement',
  'createPayment',
  'issueRwa',
  'claimToken'
]) assert.equal(moduleSource.includes(forbiddenOwner), false, `Case Study module created a forbidden owner: ${forbiddenOwner}`);

assert.ok(
  sitemap.includes('https://moseszhu999.github.io/trade-proof-passport/rwp-case-study.html'),
  'sitemap does not include the RWP Pool Adoption Case Study page'
);

console.log('PASS: public synthetic Pool Adoption Case Study surface, deterministic acceptance contract and no new authority owner');
