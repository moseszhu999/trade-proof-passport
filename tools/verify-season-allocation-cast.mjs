import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  CLAIM_TYPEHASH,
  compileSeasonAllocation,
  hashPair
} from '../docs/season-allocation.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const cast = (...arguments_) =>
  execFileSync('cast', arguments_, { encoding: 'utf8' }).trim().toLowerCase();

const input = JSON.parse(readFileSync('examples/genesis-proof-allocation-input.json', 'utf8'));
const output = compileSeasonAllocation(input);

for (const entry of output.entries) {
  const encoded = cast(
    'abi-encode',
    'claim(bytes32,uint256,address,uint32,uint32,address,uint256,uint256)',
    CLAIM_TYPEHASH,
    input.chainId,
    input.allocationContract,
    input.season,
    input.revision,
    entry.account,
    entry.verifiedPoints,
    entry.tokenAmountBaseUnits
  );
  const solidityLeaf = cast('keccak', encoded);
  assert(solidityLeaf === entry.leaf, `Solidity ABI leaf mismatch for ${entry.account}`);
}

const [first, second] = output.entries.map((entry) => entry.leaf);
const ordered = BigInt(first) < BigInt(second) ? [first, second] : [second, first];
const packedPair = `0x${ordered.map((value) => value.slice(2)).join('')}`;
const solidityRoot = cast('keccak', packedPair);
assert(solidityRoot === hashPair(first, second), 'sorted pair hash differs from cast');
assert(solidityRoot === output.merkleRoot, 'Merkle root differs from cast');

console.log('PASS: browser claim leaves match Solidity abi.encode + keccak256');
console.log('PASS: browser sorted-pair Merkle root matches Foundry cast');
