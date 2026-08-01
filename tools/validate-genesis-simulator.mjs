import { readFileSync } from 'node:fs';

const requireValues = (source, values, label) => {
  for (const value of values) {
    if (!source.includes(value)) throw new Error(`Missing ${label}: ${value}`);
  }
};

const rejectValues = (source, values, label) => {
  for (const value of values) {
    if (source.includes(value)) throw new Error(`${label}: ${value}`);
  }
};

const landing = readFileSync('docs/index.html', 'utf8');
const tokenomics = readFileSync('docs/tokenomics.html', 'utf8');
const simulator = readFileSync('docs/genesis.html', 'utf8');
const compiler = readFileSync('docs/season-allocation.mjs', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const sitemap = readFileSync('docs/sitemap.xml', 'utf8');
const workflow = readFileSync('.github/workflows/validate.yml', 'utf8');

requireValues(simulator, [
  'Genesis Proof Simulator',
  'SIMULATION ONLY · TOKEN NOT LIVE',
  '10,000,000 TPROOF',
  '0 database dependency',
  'Compile allocation →',
  'Download dataset JSON',
  'No eligibility or claim is created here.',
  './season-allocation.mjs',
  'compileSeasonAllocation',
  'MERKLE + DATASET',
  'No claim or sale is active.'
], 'Genesis simulator surface');

requireValues(compiler, [
  "export const REWARD_PROFILE = 'TPROOF_SQRT_VERIFIED_POINTS_V0_1'",
  'sqrt-fixed-18-floor-largest-remainder-address-ascending-v0.1',
  'CLAIM_TYPEHASH',
  'export const keccak256',
  'export const claimLeaf',
  'export const integerSqrt',
  'export const buildMerkleTree',
  'export const stableStringify',
  'export const compileSeasonAllocation',
  "status: 'draft-not-claimable'",
  "reason: 'below-minimum-points'"
], 'allocation compiler contract');

requireValues(landing, [
  './genesis.html',
  'Simulate Genesis Proof',
  '>Genesis<',
  '>Genesis Simulator<'
], 'homepage Genesis discovery');

requireValues(tokenomics, [
  './genesis.html',
  'Run Genesis simulator',
  'Simulate the allocation →'
], 'tokenomics Genesis discovery');

requireValues(readme, [
  'Genesis Proof simulator: `https://moseszhu999.github.io/trade-proof-passport/genesis.html`',
  'node tools/verify-season-allocation.mjs',
  'node tools/compile-season-allocation.mjs examples/genesis-proof-allocation-input.json',
  'docs/season-allocation.mjs',
  'docs/genesis.html',
  'Public allocation data, not a private eligibility database'
], 'README allocation compiler documentation');

if (!sitemap.includes('https://moseszhu999.github.io/trade-proof-passport/genesis.html')) {
  throw new Error('Genesis simulator is missing from sitemap');
}

requireValues(workflow, [
  'node tools/verify-season-allocation.mjs',
  'node tools/verify-season-allocation-cast.mjs',
  'node tools/validate-genesis-simulator.mjs',
  'examples/genesis-proof-allocation-output.json'
], 'allocation CI gates');

rejectValues(`${landing}\n${tokenomics}\n${simulator}\n${readme}`, [
  'Buy TPROOF',
  'Buy $TPROOF',
  'Guaranteed return',
  'Guaranteed profit',
  'Guaranteed APY',
  'Public sale is live',
  'Claim now',
  'Claim your TPROOF',
  'Price target'
], 'unsafe or false Genesis marketing found');

console.log('PASS: Genesis Proof simulator, homepage and tokenomics discovery');
console.log('PASS: public deterministic compiler and Merkle/Keccak contracts');
console.log('PASS: simulation-only, no-sale and no-claim boundaries');
