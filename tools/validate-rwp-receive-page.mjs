import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../docs/rwp-receive.html', import.meta.url), 'utf8');
const moduleSource = await readFile(new URL('../docs/rwp-evidence-receipt.mjs', import.meta.url), 'utf8');
const standard = await readFile(new URL('../standard/real-world-proof-evidence-receipt-v0.1.md', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/real-world-proof-evidence-receipt.schema.json', import.meta.url), 'utf8'));

for (const phrase of [
  'Verify what',
  'you received',
  'No file is uploaded',
  'Import Package Manifest',
  'Check received files',
  'Use deterministic result',
  'Request more evidence or clarification',
  'Generate Receipt',
  'Download private Receipt JSON',
  'Copy public Receipt Card link',
  'Shared Evidence Receipt Card',
  'aggregate results only',
  'matched digest proves byte equality'
]) assert.ok(page.includes(phrase), `missing Evidence Receipt page phrase: ${phrase}`);

for (const phrase of [
  'validateRwpEvidencePackage',
  'buildRwpEvidenceReceipt',
  'verifyReceivedEvidenceFileBytes',
  'buildRwpEvidenceReceiptCard',
  'buildRwpEvidenceReceiptCardUrl',
  'readRwpEvidenceReceiptCardFromHash',
  'file.arrayBuffer()',
  'navigator.clipboard.writeText',
  'downloadJson'
]) assert.ok(page.includes(phrase), `missing Evidence Receipt page contract: ${phrase}`);

assert.doesNotMatch(page, /\bfetch\s*\(/);
assert.doesNotMatch(page, /XMLHttpRequest|WebSocket|sendBeacon/);
assert.doesNotMatch(page, /eth_sendTransaction|eth_sendRawTransaction|wallet_switchEthereumChain/);
assert.doesNotMatch(page, /private\s*key|seed\s*phrase/i);
assert.doesNotMatch(page, /claim\s+now|buy\s+TPROOF|guaranteed\s+(return|yield|price)/i);
assert.doesNotMatch(page, /encodeRwpEvidenceReceipt\s*\(/);

for (const phrase of [
  'real-world-proof-evidence-receipt',
  'real-world-proof-evidence-receipt-card',
  'received',
  'incomplete',
  'mismatch',
  'request_more',
  'deterministicOutcome',
  'verifyReceivedEvidenceFileBytes',
  'receiptDigest does not match',
  'Evidence Receipt Card contains a forbidden private-field marker',
  'buildRwpEvidenceReceiptCardUrl'
]) assert.ok(moduleSource.includes(phrase), `missing Evidence Receipt module contract: ${phrase}`);

assert.doesNotMatch(moduleSource, /eth_sendTransaction|eth_sendRawTransaction/);
assert.doesNotMatch(moduleSource, /export const encodeRwpEvidenceReceipt\s*=/);

for (const phrase of [
  '# Real-World Proof Evidence Receipt v0.1',
  'matched',
  'received',
  'incomplete',
  'mismatch',
  'request_more',
  'The complete Receipt MUST NOT be encoded into a public URL',
  'Public Receipt Card',
  'copied link != delivery',
  'Token balance != evidence validity'
]) assert.ok(standard.includes(phrase), `missing Evidence Receipt standard invariant: ${phrase}`);

assert.equal(schema.properties.format.const, 'real-world-proof-evidence-receipt');
assert.ok(schema.properties.outcome.properties.status.enum.includes('request_more'));
assert.ok(schema.properties.evidenceResults.items.properties.status.enum.includes('mismatch'));

console.log('PASS: local Evidence Receipt verification and privacy-bounded public card surface');
