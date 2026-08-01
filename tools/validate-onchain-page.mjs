import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/onchain.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../docs/registry-client.mjs', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../docs/sitemap.xml', import.meta.url), 'utf8');
const manifest = JSON.parse(
  await readFile(new URL('../docs/contracts/base-sepolia-v0.1.json', import.meta.url), 'utf8')
);

assert.match(page, /Anchor and verify/);
assert.match(page, /Local privacy boundary/);
assert.match(page, /only the digest and profile hashes/);
assert.match(page, /does not prove identity, authority, legal effect, or the truth/);
assert.match(page, /Registry status is independent of TPROOF holdings/);
assert.match(page, /does not activate a Token claim, sale, market, liquidity pool/);
assert.match(page, /registry-client\.mjs/);
assert.match(page, /Request wallet anchor/);
assert.match(page, /I understand this sends an irreversible Base Sepolia transaction containing only hashes/);
assert.doesNotMatch(page, /private\s*key/i);
assert.doesNotMatch(page, /seed\s*phrase/i);
assert.doesNotMatch(page, /claim\s+now/i);
assert.doesNotMatch(page, /buy\s+TPROOF/i);

assert.match(client, /trade-proof-passport-jcs-keccak256-v0\.1/);
assert.match(client, /wallet_switchEthereumChain/);
assert.match(client, /eth_sendTransaction/);
assert.match(client, /eth_call/);
assert.match(client, /0xad1c714140ceb8ed7c5234d939a06926f5edaba2/);
assert.doesNotMatch(client, /eth_sendRawTransaction/);
assert.doesNotMatch(client, /DEPLOYER_PRIVATE_KEY/);

assert.equal(manifest.chainId, 84532);
assert.equal(manifest.chainIdHex, '0x14a34');
assert.equal(manifest.registry.address, '0xad1c714140ceb8ed7c5234d939a06926f5edaba2');
assert.equal(manifest.economicStack.token, '0xd0a60427482C2cBE1C6566772DC5838AA06DED80');
assert.equal(manifest.economicStack.status, 'deployed-testnet-inactive');
assert.equal(manifest.boundaries.publicClaimActive, false);
assert.equal(manifest.boundaries.saleActive, false);
assert.equal(manifest.boundaries.liquidityPoolActive, false);
assert.equal(manifest.boundaries.mainnetAuthorized, false);

assert.match(sitemap, /onchain\.html/);
console.log('PASS: bounded Base Sepolia anchor and verify public surface');
