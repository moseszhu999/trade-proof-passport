import { readFileSync } from 'node:fs';
import {
  CLAIM_TYPEHASH,
  GENESIS_POOL_BASE_UNITS,
  claimLeaf,
  compileSeasonAllocation,
  integerSqrt,
  keccakUtf8,
  verifyMerkleProof
} from '../docs/season-allocation.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expectFailure = (action, fragment) => {
  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(fragment)) {
      throw new Error(`Expected error containing "${fragment}", received "${message}"`);
    }
    return;
  }
  throw new Error(`Expected failure containing "${fragment}"`);
};

assert(
  keccakUtf8('') ===
    '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
  'Keccak-256 empty-string vector failed'
);
assert(
  keccakUtf8('abc') ===
    '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
  'Keccak-256 abc vector failed'
);
assert(/^0x[0-9a-f]{64}$/.test(CLAIM_TYPEHASH), 'Claim type hash shape failed');
assert(integerSqrt(0n) === 0n, 'sqrt(0)');
assert(integerSqrt(1n) === 1n, 'sqrt(1)');
assert(integerSqrt(2n) === 1n, 'sqrt(2) floor');
assert(integerSqrt(225n * 10n ** 36n) === 15n * 10n ** 18n, 'fixed-point sqrt');
assert(GENESIS_POOL_BASE_UNITS === 10_000_000n * 10n ** 18n, 'Genesis pool constant');

const input = JSON.parse(readFileSync('examples/genesis-proof-allocation-input.json', 'utf8'));
const output = compileSeasonAllocation(input);
assert(output.format === 'tradeproof-season-allocation', 'dataset format');
assert(output.status === 'draft-not-claimable', 'dataset status');
assert(output.eligibleAccountCount === 2, 'eligible count');
assert(output.excludedAccountCount === 1, 'excluded count');
assert(output.excluded[0].reason === 'below-minimum-points', 'minimum exclusion');
assert(output.totalEligiblePoints === '325', 'eligible Points total');
assert(output.totalAllocatedBaseUnits === input.poolAmountBaseUnits, 'pool conservation');
assert(/^0x[0-9a-f]{64}$/.test(output.merkleRoot), 'Merkle root shape');
assert(/^0x[0-9a-f]{64}$/.test(output.datasetDigest), 'dataset digest shape');

const [alice, bob] = output.entries;
assert(
  alice.account === '0x00000000000000000000000000000000000000a0',
  'entries must sort by address'
);
assert(alice.verifiedPoints === '100', 'Alice Points');
assert(alice.sqrtWeightScaled === '10000000000000000000', 'Alice sqrt weight');
assert(alice.tokenAmountBaseUnits === '4000000000000000000000000', 'Alice allocation');
assert(bob.verifiedPoints === '225', 'Bob Points');
assert(bob.sqrtWeightScaled === '15000000000000000000', 'Bob sqrt weight');
assert(bob.tokenAmountBaseUnits === '6000000000000000000000000', 'Bob allocation');
assert(alice.merkleProof.length === 1, 'Alice proof length');
assert(bob.merkleProof.length === 1, 'Bob proof length');
assert(
  verifyMerkleProof(alice.leaf, alice.merkleProof, output.merkleRoot),
  'Alice proof verification'
);
assert(
  verifyMerkleProof(bob.leaf, bob.merkleProof, output.merkleRoot),
  'Bob proof verification'
);

const rebuiltAliceLeaf = claimLeaf({
  chainId: input.chainId,
  allocationContract: input.allocationContract,
  season: input.season,
  revision: input.revision,
  account: alice.account,
  verifiedPoints: alice.verifiedPoints,
  tokenAmountBaseUnits: alice.tokenAmountBaseUnits
});
assert(rebuiltAliceLeaf === alice.leaf, 'claim leaf rebuild');

const reversedInput = { ...input, entries: [...input.entries].reverse() };
const reversed = compileSeasonAllocation(reversedInput);
assert(reversed.merkleRoot === output.merkleRoot, 'input order must not alter root');
assert(reversed.datasetDigest === output.datasetDigest, 'input order must not alter digest');

const differentRevision = claimLeaf({
  chainId: input.chainId,
  allocationContract: input.allocationContract,
  season: input.season,
  revision: '2',
  account: alice.account,
  verifiedPoints: alice.verifiedPoints,
  tokenAmountBaseUnits: alice.tokenAmountBaseUnits
});
assert(differentRevision !== alice.leaf, 'revision domain separation');

const duplicateInput = {
  ...input,
  entries: [input.entries[0], { ...input.entries[0] }]
};
expectFailure(() => compileSeasonAllocation(duplicateInput), 'Duplicate account');
expectFailure(
  () => compileSeasonAllocation({ ...input, entries: [{ ...input.entries[2], verifiedPoints: '1' }] }),
  'No eligible accounts'
);
expectFailure(
  () => compileSeasonAllocation({ ...input, allocationContract: '0x0000000000000000000000000000000000000000' }),
  'Zero address'
);

console.log('PASS: Ethereum Keccak-256 vectors');
console.log('PASS: fixed-point square-root allocation and exact pool conservation');
console.log('PASS: deterministic ordering, domain-separated leaves, Merkle proofs and dataset digest');
console.log('PASS: minimum-points, duplicate-account and zero-address guards');
