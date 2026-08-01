import { keccakUtf8, stableStringify } from './season-allocation.mjs';

export const BASE_SEPOLIA = Object.freeze({
  chainId: 84532,
  chainIdHex: '0x14a34',
  name: 'Base Sepolia',
  rpcUrl: 'https://sepolia.base.org',
  explorerUrl: 'https://base-sepolia.blockscout.com'
});

export const REGISTRY_ADDRESS = '0xad1c714140ceb8ed7c5234d939a06926f5edaba2';
export const DIGEST_PROFILE_ID = 'trade-proof-passport-jcs-keccak256-v0.1';
export const ZERO_BYTES32 = `0x${'00'.repeat(32)}`;

export const SCHEMA_IDS = Object.freeze({
  Passport: 'https://github.com/moseszhu999/trade-proof-passport/schema/trade-proof-passport.schema.json',
  Response: 'https://github.com/moseszhu999/trade-proof-passport/schema/trade-proof-response.schema.json'
});

const SIGNATURES = Object.freeze({
  anchorPassport: 'anchorPassport(bytes32,bytes32,bytes32,bytes32)',
  anchorResponse: 'anchorResponse(bytes32,bytes32,bytes32,bytes32,bytes32)',
  exists: 'exists(bytes32)',
  isCurrent: 'isCurrent(bytes32)',
  getAnchor: 'getAnchor(bytes32)'
});

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const normalizeBytes32 = (value, label = 'bytes32') => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be a 0x-prefixed 32-byte hex value.`);
  }
  return value.toLowerCase();
};

export const normalizeOptionalBytes32 = (value, label = 'bytes32') => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? normalizeBytes32(trimmed, label) : ZERO_BYTES32;
};

export const classifyArtifact = (artifact) => {
  if (!isRecord(artifact)) throw new Error('Artifact root must be a JSON object.');
  if (artifact.schemaVersion !== '0.1') throw new Error('schemaVersion must equal "0.1".');
  if (typeof artifact.passportId === 'string' && artifact.passportId.length >= 3) return 'Passport';
  if (typeof artifact.responseId === 'string' && isRecord(artifact.passportReference)) return 'Response';
  throw new Error('JSON is not a supported Trade Proof Passport or Response v0.1 artifact.');
};

export const canonicalizeArtifact = (artifact) => {
  classifyArtifact(artifact);
  return stableStringify(artifact);
};

export const computeArtifactHashes = (artifact) => {
  const kind = classifyArtifact(artifact);
  const canonicalJson = canonicalizeArtifact(artifact);
  const schemaId = SCHEMA_IDS[kind];
  return Object.freeze({
    kind,
    canonicalJson,
    digest: keccakUtf8(canonicalJson),
    schemaId,
    schemaHash: keccakUtf8(schemaId),
    digestProfileId: DIGEST_PROFILE_ID,
    digestProfileHash: keccakUtf8(DIGEST_PROFILE_ID)
  });
};

const selector = (signature) => keccakUtf8(signature).slice(0, 10);
const bytes32Word = (value, label) => normalizeBytes32(value, label).slice(2);

export const encodeAnchorPassport = ({
  digest,
  schemaHash,
  digestProfileHash,
  supersedesDigest = ZERO_BYTES32
}) =>
  `${selector(SIGNATURES.anchorPassport)}${bytes32Word(digest, 'artifact digest')}${bytes32Word(
    schemaHash,
    'schema hash'
  )}${bytes32Word(digestProfileHash, 'digest profile hash')}${bytes32Word(
    supersedesDigest,
    'supersedes digest'
  )}`;

export const encodeAnchorResponse = ({
  digest,
  passportDigest,
  schemaHash,
  digestProfileHash,
  supersedesDigest = ZERO_BYTES32
}) =>
  `${selector(SIGNATURES.anchorResponse)}${bytes32Word(digest, 'artifact digest')}${bytes32Word(
    passportDigest,
    'Passport digest'
  )}${bytes32Word(schemaHash, 'schema hash')}${bytes32Word(
    digestProfileHash,
    'digest profile hash'
  )}${bytes32Word(supersedesDigest, 'supersedes digest')}`;

export const encodeExists = (digest) =>
  `${selector(SIGNATURES.exists)}${bytes32Word(digest, 'artifact digest')}`;

export const encodeIsCurrent = (digest) =>
  `${selector(SIGNATURES.isCurrent)}${bytes32Word(digest, 'artifact digest')}`;

export const encodeGetAnchor = (digest) =>
  `${selector(SIGNATURES.getAnchor)}${bytes32Word(digest, 'artifact digest')}`;

const splitWords = (value) => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]*$/.test(value)) {
    throw new Error('RPC returned invalid hex data.');
  }
  const body = value.slice(2);
  if (body.length % 64 !== 0) throw new Error('RPC return data is not word aligned.');
  return body.match(/.{64}/g) ?? [];
};

const decodeBoolean = (value) => {
  const words = splitWords(value);
  if (words.length !== 1) throw new Error('Expected one ABI boolean word.');
  return BigInt(`0x${words[0]}`) !== 0n;
};

const decodeAddress = (word) => `0x${word.slice(24)}`.toLowerCase();
const decodeUint = (word) => BigInt(`0x${word}`);
const decodeBytes32 = (word) => `0x${word}`.toLowerCase();

export const decodeAnchor = (value) => {
  const words = splitWords(value);
  if (words.length !== 10) throw new Error(`Expected 10 Anchor words, received ${words.length}.`);
  const kindValue = Number(decodeUint(words[3]));
  if (![0, 1].includes(kindValue)) throw new Error(`Unsupported onchain artifact kind: ${kindValue}`);
  return Object.freeze({
    issuer: decodeAddress(words[0]),
    anchoredAt: decodeUint(words[1]),
    revokedAt: decodeUint(words[2]),
    kind: kindValue === 0 ? 'Passport' : 'Response',
    subjectDigest: decodeBytes32(words[4]),
    schemaHash: decodeBytes32(words[5]),
    digestProfileHash: decodeBytes32(words[6]),
    supersedesDigest: decodeBytes32(words[7]),
    successorDigest: decodeBytes32(words[8]),
    revocationReasonHash: decodeBytes32(words[9])
  });
};

export const createPublicRpc = (rpcUrl = BASE_SEPOLIA.rpcUrl) => {
  let requestId = 0;
  return async (method, params = []) => {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params })
    });
    if (!response.ok) throw new Error(`Base Sepolia RPC returned HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || 'Base Sepolia RPC request failed.');
    return payload.result;
  };
};

const ethCall = (request, data) =>
  request('eth_call', [{ to: REGISTRY_ADDRESS, data }, 'latest']);

export const readAnchor = async (request, digest) => {
  const normalizedDigest = normalizeBytes32(digest, 'artifact digest');
  const exists = decodeBoolean(await ethCall(request, encodeExists(normalizedDigest)));
  if (!exists) return Object.freeze({ exists: false, digest: normalizedDigest });
  const [anchorData, currentData] = await Promise.all([
    ethCall(request, encodeGetAnchor(normalizedDigest)),
    ethCall(request, encodeIsCurrent(normalizedDigest))
  ]);
  return Object.freeze({
    exists: true,
    digest: normalizedDigest,
    current: decodeBoolean(currentData),
    anchor: decodeAnchor(anchorData)
  });
};

export const ensureBaseSepolia = async (provider) => {
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('No EIP-1193 wallet provider is available.');
  }
  const currentChain = String(await provider.request({ method: 'eth_chainId' })).toLowerCase();
  if (currentChain === BASE_SEPOLIA.chainIdHex) return;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_SEPOLIA.chainIdHex }]
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: BASE_SEPOLIA.chainIdHex,
          chainName: BASE_SEPOLIA.name,
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: [BASE_SEPOLIA.rpcUrl],
          blockExplorerUrls: [BASE_SEPOLIA.explorerUrl]
        }
      ]
    });
  }
};

export const anchorArtifact = async (
  provider,
  artifact,
  { passportDigest = '', supersedesDigest = '' } = {}
) => {
  await ensureBaseSepolia(provider);
  const accounts = await provider.request({ method: 'eth_requestAccounts' });
  const from = accounts?.[0];
  if (typeof from !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(from)) {
    throw new Error('Wallet did not return a usable EVM account.');
  }

  const hashes = computeArtifactHashes(artifact);
  const predecessor = normalizeOptionalBytes32(supersedesDigest, 'supersedes digest');
  const data =
    hashes.kind === 'Passport'
      ? encodeAnchorPassport({ ...hashes, supersedesDigest: predecessor })
      : encodeAnchorResponse({
          ...hashes,
          passportDigest: normalizeBytes32(passportDigest, 'Passport digest'),
          supersedesDigest: predecessor
        });

  const transactionHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ from, to: REGISTRY_ADDRESS, data, value: '0x0' }]
  });
  if (typeof transactionHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) {
    throw new Error('Wallet did not return a transaction hash.');
  }
  return Object.freeze({ transactionHash: transactionHash.toLowerCase(), from: from.toLowerCase(), ...hashes });
};

export const formatUnixSeconds = (value) => {
  const seconds = typeof value === 'bigint' ? value : BigInt(value);
  if (seconds === 0n) return '—';
  return new Date(Number(seconds) * 1000).toISOString();
};
