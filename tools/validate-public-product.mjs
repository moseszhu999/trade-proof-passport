import { readFileSync } from 'node:fs';
import {
  buildPublicSummary,
  buildPublicSummaryUrl,
  decodePublicSummary,
  encodePublicSummary,
  validatePassport
} from '../docs/passport-share.mjs';
import {
  buildResponse,
  buildResponseUrl,
  decodeResponse,
  encodeResponse,
  validateResponse
} from '../docs/passport-response.mjs';

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

const passport = JSON.parse(readFileSync('examples/steel-cabinet-passport.json', 'utf8'));
const passportErrors = validatePassport(passport);
if (passportErrors.length > 0) throw new Error(passportErrors.join(' '));

const summary = buildPublicSummary(passport);
const serializedSummary = JSON.stringify(summary);
rejectValues(serializedSummary, [
  'Example Exporter Ltd.',
  'party:exporter:example',
  'evidence://',
  '1111111111111111111111111111111111111111111111111111111111111111',
  '"digest"'
], 'Public summary leaked forbidden value');

if (summary.counts.evidence !== 4 || summary.counts.confirmations !== 3 || summary.facts.length !== 3) {
  throw new Error('Public summary counts do not match the source Passport.');
}

const summaryPayload = encodePublicSummary(summary);
const decodedSummary = decodePublicSummary(summaryPayload);
if (decodedSummary.passportId !== passport.passportId || decodedSummary.tradeCase.caseReference !== 'SC-EXPORT-001') {
  throw new Error('Public summary did not survive encode/decode round trip.');
}

const shareUrl = buildPublicSummaryUrl(passport, 'https://example.com/view.html?source=draft#old');
if (!shareUrl.startsWith('https://example.com/respond.html#p=')) {
  throw new Error('New share URLs must open the response-enabled page.');
}

const response = buildResponse(summary, {
  decision: 'request_change',
  responderRole: 'buyer',
  comment: 'Please clarify the pickup date.'
});
const responseErrors = validateResponse(response, summary);
if (responseErrors.length > 0) throw new Error(responseErrors.join(' '));
if (response.decision.status !== 'request_change' || response.responder.role !== 'buyer') {
  throw new Error('Response decision or role was not preserved.');
}

const serializedResponse = JSON.stringify(response);
rejectValues(serializedResponse, [
  'Example Exporter Ltd.',
  'party:exporter:example',
  'evidence://',
  '"digest"',
  '"displayName"',
  '"partyId"'
], 'Response leaked forbidden value');

const responsePayload = encodeResponse(response);
const decodedResponse = decodeResponse(responsePayload);
if (decodedResponse.responseId !== response.responseId || decodedResponse.passportReference.passportId !== passport.passportId) {
  throw new Error('Response did not survive encode/decode round trip.');
}

const responseUrl = buildResponseUrl(response, `https://example.com/respond.html#p=${summaryPayload}`);
const responseParams = new URLSearchParams(new URL(responseUrl).hash.slice(1));
if (!responseParams.get('p') || !responseParams.get('r')) {
  throw new Error('Response URL must carry both Passport and response payloads.');
}

for (const decision of ['confirm', 'reject', 'request_change']) {
  const candidate = buildResponse(summary, { decision, responderRole: 'inspection', comment: '' });
  if (candidate.decision.status !== decision) throw new Error(`Decision was not supported: ${decision}`);
}

const landing = readFileSync('docs/index.html', 'utf8');
const example = readFileSync('docs/example.html', 'utf8');
const builder = readFileSync('docs/create.html', 'utf8');
const viewer = readFileSync('docs/view.html', 'utf8');
const responder = readFileSync('docs/respond.html', 'utf8');
const shareModule = readFileSync('docs/passport-share.mjs', 'utf8');
const responseModule = readFileSync('docs/passport-response.mjs', 'utf8');
const responseStandard = readFileSync('standard/trade-proof-response-v0.1.md', 'utf8');
const sitemap = readFileSync('docs/sitemap.xml', 'utf8');
const robots = readFileSync('docs/robots.txt', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const contract = '0xad1c714140ceb8ed7c5234d939a06926f5edaba2';

requireValues(landing, [
  'Proof for trade.',
  'Ownership for contributors.',
  'Live on Base Sepolia',
  '$TPROOF · Not live',
  'Not a landing page pretending to be a product.',
  'Create a Passport',
  './create.html',
  './view.html',
  './respond.html',
  './example.html',
  contract,
  'No sale is active.',
  'Utility first. Contribution next. Token last.',
  'Share the project'
], 'token-native landing content');

rejectValues(landing, [
  'Guaranteed return',
  'guaranteed return',
  'Guaranteed profit',
  'guaranteed profit',
  'Buy $TPROOF now',
  'Public sale is live',
  'Guaranteed APY',
  'Earn passive income'
], 'Unsafe or false token claim found');

requireValues(example, [
  'Steel Cabinet Trade Proof Passport',
  'tpp:example:steel-cabinet:001',
  'Synthetic demonstration',
  'What this page does not prove',
  './create.html',
  './view.html'
], 'example page content');

requireValues(builder, [
  'Create a draft Passport',
  'Local-only:',
  "schemaVersion:'0.1'",
  "lifecycle:{status:'draft'}",
  'Generate and download JSON',
  'tradeProofPassportDraft',
  './view.html?source=draft',
  './example.html'
], 'builder content');

requireValues(viewer, [
  'Import a Passport JSON',
  'Create public summary link',
  'No file is uploaded.',
  'URL fragment',
  './passport-share.mjs',
  'evidence URIs',
  'party identifiers'
], 'viewer content');

requireValues(responder, [
  'Review and respond',
  'Confirm',
  'Reject',
  'Request change',
  'Generate response JSON and link',
  './passport-response.mjs',
  'unsigned and self-declared',
  'What this response does not prove'
], 'response page content');

requireValues(shareModule, [
  'buildPublicSummary',
  'encodePublicSummary',
  'decodePublicSummary',
  "format: 'trade-proof-passport-public-summary'",
  "disclosure: { profile: 'public_summary' }",
  "'respond.html'"
], 'share-module contract');

requireValues(responseModule, [
  'buildResponse',
  'encodeResponse',
  'decodeResponse',
  'buildResponseUrl',
  "type: 'unsigned_self_declared'",
  "profile: 'public_response'"
], 'response-module contract');

requireValues(responseStandard, [
  '# Trade Proof Response v0.1',
  '`confirm`',
  '`reject`',
  '`request_change`',
  'unsigned and self-declared'
], 'response standard content');

requireValues(readme, [
  'Proof for trade. Ownership for contributors.',
  contract,
  '`$TPROOF` is **not live**',
  'Token state must never determine whether a Passport or Response is valid'
], 'README product/token boundary');

requireValues(sitemap, [
  'https://moseszhu999.github.io/trade-proof-passport/',
  'https://moseszhu999.github.io/trade-proof-passport/example.html',
  'https://moseszhu999.github.io/trade-proof-passport/create.html',
  'https://moseszhu999.github.io/trade-proof-passport/view.html',
  'https://moseszhu999.github.io/trade-proof-passport/respond.html'
], 'sitemap URL');

if (!robots.includes('Sitemap: https://moseszhu999.github.io/trade-proof-passport/sitemap.xml')) {
  throw new Error('robots.txt does not reference the sitemap');
}

console.log('PASS: privacy-bounded sharing and response helpers');
console.log('PASS: token-native landing, live utility loop and Registry facts');
console.log('PASS: token not-live/no-sale boundaries and unsafe-claim guards');
