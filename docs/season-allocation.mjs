const MASK_64 = (1n << 64n) - 1n;
const RATE_BYTES = 136;
const ROTATION = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14
];
const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n,
  0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n,
  0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn,
  0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n,
  0x0000000080000001n, 0x8000000080008008n
];
const CLAIM_TYPE =
  'TradeProofSeasonClaim(uint256 chainId,address allocationContract,uint32 season,uint32 revision,address account,uint256 verifiedPoints,uint256 tokenAmount)';

export const REWARD_PROFILE = 'TPROOF_SQRT_VERIFIED_POINTS_V0_1';
export const ROUNDING_PROFILE =
  'sqrt-fixed-18-floor-largest-remainder-address-ascending-v0.1';
export const DEFAULT_MINIMUM_POINTS = 25n;
export const GENESIS_POOL_BASE_UNITS = 10_000_000n * 10n ** 18n;
const WEIGHT_SCALE = 10n ** 18n;

const rotateLeft64 = (value, shift) => {
  const offset = BigInt(shift);
  if (offset === 0n) return value & MASK_64;
  return ((value << offset) | (value >> (64n - offset))) & MASK_64;
};

const keccakF1600 = (state) => {
  for (const roundConstant of ROUND_CONSTANTS) {
    const column = new Array(5).fill(0n);
    const delta = new Array(5).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      column[x] =
        state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x += 1) {
      delta[x] = column[(x + 4) % 5] ^ rotateLeft64(column[(x + 1) % 5], 1);
    }
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) state[x + 5 * y] ^= delta[x];
    }

    const moved = new Array(25).fill(0n);
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        moved[y + 5 * ((2 * x + 3 * y) % 5)] =
          rotateLeft64(state[x + 5 * y], ROTATION[x + 5 * y]);
      }
    }

    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        state[x + 5 * y] =
          moved[x + 5 * y] ^
          ((~moved[(x + 1) % 5 + 5 * y]) & moved[(x + 2) % 5 + 5 * y]);
        state[x + 5 * y] &= MASK_64;
      }
    }
    state[0] ^= roundConstant;
  }
};

export const bytesToHex = (bytes) =>
  `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;

export const hexToBytes = (value, expectedBytes) => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new Error(`Invalid hex value: ${value}`);
  }
  const body = value.slice(2);
  if (body.length % 2 !== 0) throw new Error(`Hex value has odd length: ${value}`);
  const pairs = body.match(/.{2}/g) ?? [];
  const bytes = Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
  if (expectedBytes !== undefined && bytes.length !== expectedBytes) {
    throw new Error(`Expected ${expectedBytes} bytes, received ${bytes.length}`);
  }
  return bytes;
};

const concatBytes = (...chunks) => {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

export const keccak256 = (input) => {
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input);
  const padded = Array.from(bytes);
  padded.push(0x01);
  while (padded.length % RATE_BYTES !== RATE_BYTES - 1) padded.push(0);
  padded.push(0x80);

  const state = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += RATE_BYTES) {
    for (let lane = 0; lane < RATE_BYTES / 8; lane += 1) {
      let value = 0n;
      for (let byte = 0; byte < 8; byte += 1) {
        value |= BigInt(padded[offset + lane * 8 + byte]) << BigInt(byte * 8);
      }
      state[lane] ^= value;
    }
    keccakF1600(state);
  }

  const output = new Uint8Array(32);
  for (let index = 0; index < output.length; index += 1) {
    const lane = state[Math.floor(index / 8)];
    output[index] = Number((lane >> BigInt((index % 8) * 8)) & 0xffn);
  }
  return output;
};

export const keccakHex = (input) => bytesToHex(keccak256(input));
export const keccakUtf8 = (value) => keccakHex(new TextEncoder().encode(value));
export const CLAIM_TYPEHASH = keccakUtf8(CLAIM_TYPE);

const parseUnsigned = (value, label) => {
  const parsed = typeof value === 'bigint' ? value : BigInt(value);
  if (parsed < 0n) throw new Error(`${label} must be non-negative`);
  return parsed;
};

export const normalizeAddress = (value) => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Invalid EVM address: ${value}`);
  }
  const normalized = value.toLowerCase();
  if (normalized === '0x0000000000000000000000000000000000000000') {
    throw new Error('Zero address is not allowed');
  }
  return normalized;
};

const uintWord = (value, label) => {
  const parsed = parseUnsigned(value, label);
  if (parsed >= 1n << 256n) throw new Error(`${label} exceeds uint256`);
  return hexToBytes(`0x${parsed.toString(16).padStart(64, '0')}`, 32);
};

const addressWord = (address) =>
  hexToBytes(`0x${normalizeAddress(address).slice(2).padStart(64, '0')}`, 32);

const bytes32Word = (value) => hexToBytes(value, 32);

export const claimLeaf = ({
  chainId,
  allocationContract,
  season,
  revision,
  account,
  verifiedPoints,
  tokenAmountBaseUnits
}) =>
  keccakHex(
    concatBytes(
      bytes32Word(CLAIM_TYPEHASH),
      uintWord(chainId, 'chainId'),
      addressWord(allocationContract),
      uintWord(season, 'season'),
      uintWord(revision, 'revision'),
      addressWord(account),
      uintWord(verifiedPoints, 'verifiedPoints'),
      uintWord(tokenAmountBaseUnits, 'tokenAmountBaseUnits')
    )
  );

export const integerSqrt = (value) => {
  const target = parseUnsigned(value, 'sqrt input');
  if (target < 2n) return target;
  let left = 1n;
  let right = target;
  while (left <= right) {
    const middle = (left + right) >> 1n;
    const square = middle * middle;
    if (square === target) return middle;
    if (square < target) left = middle + 1n;
    else right = middle - 1n;
  }
  return right;
};

const compareHex = (left, right) => {
  const first = BigInt(left);
  const second = BigInt(right);
  return first < second ? -1 : first > second ? 1 : 0;
};

export const hashPair = (left, right) => {
  const [first, second] = compareHex(left, right) <= 0 ? [left, right] : [right, left];
  return keccakHex(concatBytes(hexToBytes(first, 32), hexToBytes(second, 32)));
};

export const buildMerkleTree = (leaves) => {
  if (!Array.isArray(leaves) || leaves.length === 0) {
    throw new Error('At least one Merkle leaf is required');
  }
  const proofs = leaves.map(() => []);
  let level = leaves.map((hash, index) => ({ hash, indices: [index] }));
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      if (right === left) {
        for (const leafIndex of left.indices) proofs[leafIndex].push(left.hash);
      } else {
        for (const leafIndex of left.indices) proofs[leafIndex].push(right.hash);
        for (const leafIndex of right.indices) proofs[leafIndex].push(left.hash);
      }
      next.push({
        hash: hashPair(left.hash, right.hash),
        indices: right === left ? [...left.indices] : [...left.indices, ...right.indices]
      });
    }
    level = next;
  }
  return { root: level[0].hash, proofs };
};

export const stableStringify = (value) => {
  const normalize = (input) => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.keys(input)
          .sort()
          .map((key) => [key, normalize(input[key])])
      );
    }
    return input;
  };
  return JSON.stringify(normalize(value));
};

export const verifyMerkleProof = (leaf, proof, root) => {
  let computed = leaf;
  for (const sibling of proof) computed = hashPair(computed, sibling);
  return computed.toLowerCase() === root.toLowerCase();
};

export const compileSeasonAllocation = (input) => {
  if (!input || typeof input !== 'object') {
    throw new Error('Allocation input must be an object');
  }
  const chainId = parseUnsigned(input.chainId, 'chainId');
  const season = parseUnsigned(input.season, 'season');
  const revision = parseUnsigned(input.revision, 'revision');
  const pool = parseUnsigned(input.poolAmountBaseUnits, 'poolAmountBaseUnits');
  const minimum = parseUnsigned(
    input.minimumEligibilityPoints ?? DEFAULT_MINIMUM_POINTS,
    'minimumEligibilityPoints'
  );
  if (pool === 0n) throw new Error('poolAmountBaseUnits must be positive');
  if (season > 0xffffffffn || revision === 0n || revision > 0xffffffffn) {
    throw new Error('season and revision must fit uint32; revision must be positive');
  }

  const allocationContract = normalizeAddress(input.allocationContract);
  const contributionContract = normalizeAddress(input.contributionContract);
  const tokenContract = normalizeAddress(input.tokenContract);
  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    throw new Error('entries must contain at least one account');
  }

  const seen = new Set();
  const eligible = [];
  const excluded = [];
  for (const rawEntry of input.entries) {
    const account = normalizeAddress(rawEntry.account);
    if (seen.has(account)) throw new Error(`Duplicate account: ${account}`);
    seen.add(account);
    const verifiedPoints = parseUnsigned(
      rawEntry.verifiedPoints,
      `verifiedPoints for ${account}`
    );
    if (verifiedPoints < minimum) {
      excluded.push({
        account,
        verifiedPoints: verifiedPoints.toString(),
        reason: 'below-minimum-points'
      });
      continue;
    }
    const sqrtWeightScaled = integerSqrt(verifiedPoints * WEIGHT_SCALE * WEIGHT_SCALE);
    eligible.push({ account, verifiedPoints, sqrtWeightScaled });
  }
  if (eligible.length === 0) throw new Error('No eligible accounts');

  eligible.sort((left, right) => compareHex(left.account, right.account));
  excluded.sort((left, right) => compareHex(left.account, right.account));
  const totalWeight = eligible.reduce((sum, entry) => sum + entry.sqrtWeightScaled, 0n);
  let allocated = 0n;
  for (const entry of eligible) {
    const numerator = pool * entry.sqrtWeightScaled;
    entry.tokenAmountBaseUnits = numerator / totalWeight;
    entry.remainder = numerator % totalWeight;
    allocated += entry.tokenAmountBaseUnits;
  }

  let leftover = pool - allocated;
  const remainderOrder = eligible
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      if (left.entry.remainder !== right.entry.remainder) {
        return left.entry.remainder > right.entry.remainder ? -1 : 1;
      }
      return compareHex(left.entry.account, right.entry.account);
    });
  for (let index = 0; leftover > 0n; index += 1, leftover -= 1n) {
    remainderOrder[index].entry.tokenAmountBaseUnits += 1n;
  }

  const leaves = eligible.map((entry) =>
    claimLeaf({
      chainId,
      allocationContract,
      season,
      revision,
      account: entry.account,
      verifiedPoints: entry.verifiedPoints,
      tokenAmountBaseUnits: entry.tokenAmountBaseUnits
    })
  );
  const { root, proofs } = buildMerkleTree(leaves);
  const entries = eligible.map((entry, index) => ({
    account: entry.account,
    verifiedPoints: entry.verifiedPoints.toString(),
    sqrtWeightScaled: entry.sqrtWeightScaled.toString(),
    tokenAmountBaseUnits: entry.tokenAmountBaseUnits.toString(),
    leaf: leaves[index],
    merkleProof: proofs[index]
  }));
  const totalAllocated = entries.reduce(
    (sum, entry) => sum + BigInt(entry.tokenAmountBaseUnits),
    0n
  );
  if (totalAllocated !== pool) throw new Error('Allocation sum does not match the pool');

  const dataset = {
    format: 'tradeproof-season-allocation',
    version: '0.1',
    status: 'draft-not-claimable',
    chainId: chainId.toString(),
    allocationContract,
    contributionContract,
    tokenContract,
    season: season.toString(),
    revision: revision.toString(),
    rewardProfile: REWARD_PROFILE,
    roundingProfile: ROUNDING_PROFILE,
    poolAmountBaseUnits: pool.toString(),
    minimumEligibilityPoints: minimum.toString(),
    eligibleAccountCount: entries.length,
    excludedAccountCount: excluded.length,
    totalEligiblePoints: eligible
      .reduce((sum, entry) => sum + entry.verifiedPoints, 0n)
      .toString(),
    totalSqrtWeightScaled: totalWeight.toString(),
    totalAllocatedBaseUnits: totalAllocated.toString(),
    merkleRoot: root,
    entries,
    excluded
  };
  const datasetDigest = keccakUtf8(stableStringify(dataset));
  return { ...dataset, datasetDigest };
};
