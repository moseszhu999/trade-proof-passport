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
const page = readFileSync('docs/tokenomics.html', 'utf8');
const standard = readFileSync('standard/tproof-token-economics-v0.1.md', 'utf8');
const model = readFileSync('tokenomics/tproof-tokenomics-v0.1.json', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const sitemap = readFileSync('docs/sitemap.xml', 'utf8');

requireValues(landing, [
  './tokenomics.html',
  'Token Economics v0.1 is now public and machine-verifiable.',
  'Read Token Economics',
  'Explore Token Economics',
  '>Tokenomics<'
], 'homepage tokenomics discovery');

requireValues(page, [
  'TPROOF Token Economics v0.1',
  'TOKEN NOT LIVE',
  'MACHINE-VERIFIABLE',
  'Proof creates contribution.',
  'Contribution earns ownership eligibility.',
  '1B',
  '45%',
  '1%',
  '10,000,000 TPROOF',
  'square-root curve',
  'wallet reward = season pool',
  'Anchor a unique Passport',
  'Independent external Response',
  'Page view, wallet connection, self-response or duplicate artifact',
  'One billion tokens. No hidden mint.',
  'Token ownership does not validate evidence',
  '../standard/tproof-token-economics-v0.1.md',
  '../tokenomics/tproof-tokenomics-v0.1.json'
], 'public tokenomics content');

rejectValues(`${landing}\n${page}`, [
  'Buy TPROOF',
  'Buy $TPROOF',
  'Guaranteed return',
  'Guaranteed profit',
  'Guaranteed APY',
  'Public sale is live',
  'Claim now',
  'Price target'
], 'unsafe or false token marketing found');

requireValues(standard, [
  '# TPROOF Token Economics v0.1',
  'Proof Points',
  'Contribution Receipts',
  '1,000,000,000 TPROOF',
  'Season 0: Genesis Proof',
  '10,000,000 TPROOF',
  'square-root curve',
  'No public offer, trading admission, token claim, or liquidity action',
  'Holding TPROOF never makes a Passport'
], 'economic constitution');

requireValues(model, [
  '"status": "draft-not-live"',
  '"maxSupplyTokens": "1000000000"',
  '"postGenesisMinting": false',
  '"poolTokens": "10000000"',
  '"rewardCurve": "square-root-of-verified-points"',
  '"pageViewPoints": 0',
  '"walletConnectPoints": 0',
  '"selfResponsePoints": 0'
], 'machine-readable tokenomics');

requireValues(readme, [
  'Token economics: `https://moseszhu999.github.io/trade-proof-passport/tokenomics.html`',
  '## TPROOF economic constitution',
  'node tools/verify-tokenomics.mjs',
  'Maximum supply: 1,000,000,000 TPROOF',
  'Genesis Proof pool: 1% / 10,000,000 TPROOF',
  'Economics as code'
], 'README token economics');

if (!sitemap.includes('https://moseszhu999.github.io/trade-proof-passport/tokenomics.html')) {
  throw new Error('Tokenomics page is missing from sitemap');
}

console.log('PASS: homepage and public TPROOF economics page');
console.log('PASS: Genesis, contribution, anti-Sybil and launch boundaries');
console.log('PASS: no sale, profit, yield or claim marketing');
