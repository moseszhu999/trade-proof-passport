import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  BASE_SEPOLIA,
  DIGEST_PROFILE_ID,
  REGISTRY_ADDRESS,
  SCHEMA_IDS,
  ZERO_BYTES32,
  canonicalizeArtifact,
  classifyArtifact,
  computeArtifactHashes,
  decodeAnchor,
  encodeAnchorPassport,
  encodeAnchorResponse,
  encodeExists,
  encodeGetAnchor,
  encodeIsCurrent,
  normalizeBytes32,
  readAnchor
} from '../docs/registry-client.mjs';
import { keccakUtf8 } from '../docs/season-allocation.mjs';

const passport = JSON.parse(
  await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8')
);

assert.equal(BASE_SEPOLIA.chainId, 84532);
assert.equal(BASE_SEPOLIA.chainIdHex, '0x14a34');
assert.equal(REGISTRY_ADDRESS, '0xad1c714140ceb8ed7c5234d939a06926f5edaba2');
assert.equal(classifyArtifact(passport), 'Passport');
assert.equal(
  canonicalizeArtifact({ schemaVersion: '0.1', passportId: 'tpp:test', b: 1, a: 2 }),
  '{"a":2,"b":1,"passportId":"tpp:test","schemaVersion":"0.1"}'
);

const first = computeArtifactHashes(passport);
const second = computeArtifactHashes(JSON.parse(JSON.stringify(passport)));
assert.deepEqual(first, second);
assert.equal(first.kind, 'Passport');
assert.equal(first.schemaId, SCHEMA_IDS.Passport);
assert.equal(first.schemaHash, keccakUtf8(SCHEMA_IDS.Passport));
assert.equal(first.digestProfileHash, keccakUtf8(DIGEST_PROFILE_ID));
assert.match(first.digest, /^0x[0-9a-f]{64}$/);
assert.doesNotThrow(() => JSON.parse(first.canonicalJson));

const castSelector = (signature) =>
  execFileSync('cast', ['sig', signature], { encoding: 'utf8' }).trim().toLowerCase();

const passportData = encodeAnchorPassport({
  digest: first.digest,
  schemaHash: first.schemaHash,
  digestProfileHash: first.digestProfileHash
});
assert.equal(passportData.slice(0, 10), castSelector('anchorPassport(bytes32,bytes32,bytes32,bytes32)'));
assert.equal(passportData.length, 2 + 8 + 64 * 4);
assert.ok(passportData.endsWith(ZERO_BYTES32.slice(2)));

const response = {
  schemaVersion: '0.1',
  responseId: 'tpr:test',
  passportReference: {
    passportId: passport.passportId,
    caseReference: passport.tradeCase.caseReference,
    sourceSummaryVersion: '0.1'
  },
  decision: { status: 'confirm', scope: 'public_summary' },
  responder: { role: 'buyer' },
  createdAt: '2026-08-01T00:00:00.000Z',
  assurance: {
    type: 'unsigned_self_declared',
    statement: "This browser-generated response does not verify the responder's identity, authority, or signature."
  },
  disclosure: { profile: 'public_response' }
};
const responseHashes = computeArtifactHashes(response);
assert.equal(responseHashes.kind, 'Response');
assert.equal(responseHashes.schemaId, SCHEMA_IDS.Response);
const responseData = encodeAnchorResponse({
  ...responseHashes,
  passportDigest: first.digest
});
assert.equal(
  responseData.slice(0, 10),
  castSelector('anchorResponse(bytes32,bytes32,bytes32,bytes32,bytes32)')
);
assert.equal(responseData.length, 2 + 8 + 64 * 5);

assert.equal(encodeExists(first.digest).slice(0, 10), castSelector('exists(bytes32)'));
assert.equal(encodeIsCurrent(first.digest).slice(0, 10), castSelector('isCurrent(bytes32)'));
assert.equal(encodeGetAnchor(first.digest).slice(0, 10), castSelector('getAnchor(bytes32)'));
assert.equal(normalizeBytes32(first.digest.toUpperCase().replace('0X', '0x')), first.digest);
assert.throws(() => normalizeBytes32('0x01'), /32-byte/);

const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const bytes32Word = (value) => normalizeBytes32(value).slice(2);
const issuer = '0x1111111111111111111111111111111111111111';
const anchorResult = `0x${[
  issuer.slice(2).padStart(64, '0'),
  word(1_785_574_510n),
  word(0n),
  word(0n),
  bytes32Word(ZERO_BYTES32),
  bytes32Word(first.schemaHash),
  bytes32Word(first.digestProfileHash),
  bytes32Word(ZERO_BYTES32),
  bytes32Word(ZERO_BYTES32),
  bytes32Word(ZERO_BYTES32)
].join('')}`;
const decoded = decodeAnchor(anchorResult);
assert.equal(decoded.issuer, issuer);
assert.equal(decoded.anchoredAt, 1_785_574_510n);
assert.equal(decoded.kind, 'Passport');
assert.equal(decoded.schemaHash, first.schemaHash);

const boolWord = (value) => `0x${word(value ? 1n : 0n)}`;
const fakeRequest = async (method, params) => {
  assert.equal(method, 'eth_call');
  assert.equal(params[0].to, REGISTRY_ADDRESS);
  const data = params[0].data;
  if (data.startsWith(castSelector('exists(bytes32)'))) return boolWord(true);
  if (data.startsWith(castSelector('isCurrent(bytes32)'))) return boolWord(true);
  if (data.startsWith(castSelector('getAnchor(bytes32)'))) return anchorResult;
  throw new Error(`Unexpected call data: ${data}`);
};
const record = await readAnchor(fakeRequest, first.digest);
assert.equal(record.exists, true);
assert.equal(record.current, true);
assert.equal(record.anchor.issuer, issuer);

const absent = await readAnchor(async () => boolWord(false), first.digest);
assert.deepEqual(absent, { exists: false, digest: first.digest });

console.log('PASS: deterministic TradeProof Registry client, ABI encoding and read model');
