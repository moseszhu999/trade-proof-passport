import { readFileSync } from 'node:fs';

const path = process.argv[2] || 'tokenomics/tproof-tokenomics-v0.1.json';
const model = JSON.parse(readFileSync(path, 'utf8'));
const fail = (message) => {
  throw new Error(`TPROOF tokenomics invalid: ${message}`);
};

if (model.specVersion !== '0.1') fail('specVersion must be 0.1');
if (model.status !== 'draft-not-live') fail('status must remain draft-not-live before launch');

const token = model.token || {};
if (token.name !== 'TradeProof' || token.symbol !== 'TPROOF') fail('token identity mismatch');
if (token.decimals !== 18) fail('decimals must be 18');
if (token.maxSupplyTokens !== '1000000000') fail('max supply must be exactly 1,000,000,000');
if (token.supplyPolicy !== 'fixed-at-genesis' || token.postGenesisMinting !== false) {
  fail('supply must be fixed at genesis with no later minting');
}
for (const field of [
  'publicSaleActive',
  'pricePromise',
  'profitOrRevenueRights',
  'tradeAssetOwnershipRights',
  'passportValidityControl'
]) {
  if (token[field] !== false) fail(`${field} must be false`);
}

if (!Array.isArray(model.allocations) || model.allocations.length !== 6) {
  fail('exactly six allocations are required');
}
const allocationBps = model.allocations.reduce((sum, item) => sum + item.basisPoints, 0);
if (allocationBps !== 10000) fail(`allocation basis points sum to ${allocationBps}, expected 10000`);
const allocationTokens = model.allocations.reduce((sum, item) => sum + BigInt(item.tokens), 0n);
if (allocationTokens !== BigInt(token.maxSupplyTokens)) {
  fail(`allocation token total is ${allocationTokens}, expected ${token.maxSupplyTokens}`);
}
const ids = new Set(model.allocations.map((item) => item.id));
if (ids.size !== model.allocations.length) fail('allocation IDs must be unique');
const community = model.allocations.find((item) => item.id === 'community_contributions');
if (!community || community.basisPoints !== 4500 || community.tokens !== '450000000') {
  fail('community allocation must remain 45% / 450,000,000 tokens');
}

const emission = model.communityEmission || {};
if (emission.allocationId !== 'community_contributions') fail('community emission source mismatch');
if (emission.durationYears !== 8 || emission.seasonLengthDays !== 90) {
  fail('community emission must use eight years and 90-day seasons');
}
if (emission.rewardCurve !== 'square-root-of-verified-points') fail('reward curve mismatch');
if (!String(emission.rewardFormula || '').includes('sqrt')) fail('reward formula must use square roots');
const genesis = emission.genesisSeason || {};
if (genesis.poolBasisPointsOfTotalSupply !== 100 || genesis.poolTokens !== '10000000') {
  fail('Genesis pool must reserve 1% / 10,000,000 tokens');
}
if (genesis.sourceAllocationId !== 'community_contributions') fail('Genesis pool source mismatch');
if (BigInt(genesis.poolTokens) > BigInt(community.tokens)) fail('Genesis pool exceeds community allocation');
if (genesis.status !== 'reserved-in-draft-not-claimable') fail('Genesis pool must not be claimable yet');

const assets = model.economicAssets || {};
if (assets.proofPoints?.transferable !== false || assets.proofPoints?.marketValue !== false) {
  fail('Proof Points must be non-transferable and have no market value');
}
if (assets.contributionReceipts?.transferable !== false) fail('Contribution Receipts must be non-transferable');
if (assets.tproof?.transferableAfterLaunch !== true) fail('TPROOF transferability must begin only after launch');

const usage = model.automaticUsageTrack || {};
const eventIds = new Set((usage.events || []).map((item) => item.id));
for (const required of [
  'anchor_unique_passport',
  'independent_external_response',
  'third_distinct_responder_role',
  'viral_reuse',
  'repeat_trade_usage'
]) {
  if (!eventIds.has(required)) fail(`missing automatic usage event ${required}`);
}
const caps = usage.caps || {};
for (const zeroField of [
  'identicalArtifactPoints',
  'selfResponsePoints',
  'pageViewPoints',
  'walletConnectPoints',
  'socialPostWithoutVerifiedActionPoints'
]) {
  if (caps[zeroField] !== 0) fail(`${zeroField} must be zero`);
}
if (!(caps.automaticPointsPerWalletPerDay > 0)) fail('daily wallet cap must be positive');
if (!(caps.automaticPointsPerWalletPairPerSeason > 0)) fail('wallet-pair season cap must be positive');

if (!Array.isArray(model.reviewedPublicGoodsTrack?.contributionClasses) ||
    model.reviewedPublicGoodsTrack.contributionClasses.length < 5) {
  fail('reviewed public-goods contribution classes are incomplete');
}
for (const contribution of model.reviewedPublicGoodsTrack.contributionClasses) {
  if (!(contribution.minimumPoints > 0) || contribution.maximumPoints < contribution.minimumPoints) {
    fail(`invalid reviewed point range for ${contribution.id}`);
  }
}

if (!Array.isArray(model.antiSybil?.principles) || model.antiSybil.principles.length < 7) {
  fail('anti-Sybil principles are incomplete');
}
if (!Array.isArray(model.tokenUtility) || model.tokenUtility.length < 6) {
  fail('token utility is incomplete');
}
if (!Array.isArray(model.permanentBoundaries) || model.permanentBoundaries.length < 6) {
  fail('permanent boundaries are incomplete');
}
const boundaries = model.permanentBoundaries.join(' ');
for (const required of ['never makes a Passport', 'no ownership of trade goods', 'no revenue share']) {
  if (!boundaries.includes(required)) fail(`missing permanent boundary: ${required}`);
}

if (model.vestingAndControls?.coreTeam?.cliffMonths !== 12 ||
    model.vestingAndControls?.coreTeam?.linearVestingMonths !== 48) {
  fail('core-team vesting must be 12-month cliff and 48-month linear vesting');
}
if (!Array.isArray(model.launchGates) || model.launchGates.length < 10) fail('launch gates are incomplete');
if (!Array.isArray(model.northStarMetrics) || model.northStarMetrics.length < 8) {
  fail('north-star metrics are incomplete');
}

console.log(`PASS: ${model.token.symbol} token economics ${model.specVersion}`);
console.log(`Max supply: ${Number(token.maxSupplyTokens).toLocaleString('en-US')} ${token.symbol}`);
console.log(`Allocations: ${allocationBps / 100}% across ${model.allocations.length} buckets`);
console.log(`Genesis pool: ${Number(genesis.poolTokens).toLocaleString('en-US')} ${token.symbol}`);
console.log(`Automatic events: ${usage.events.length}`);
console.log(`Launch gates: ${model.launchGates.length}`);
