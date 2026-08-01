import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProofCard, canonicalizeJson, readProofCardFromHash } from '../docs/rwp-card.mjs';
import { buildRwpRequest, buildRwpRequestUrl, readRwpRequestFromHash } from '../docs/rwp-request.mjs';
import {
  RWP_REQUEST_RESPONSE_ASSURANCE,
  buildRwpRequestResponse,
  buildRwpRequestResponseUrl,
  decodeRwpRequestResponse,
  encodeRwpRequestResponse,
  readRwpRequestResponseFromHash,
  validateRwpRequestResponse
} from '../docs/rwp-request-response.mjs';

const passport = JSON.parse(
  await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8')
);
const card = buildProofCard(passport, { publicLabel: 'Synthetic export proof' });
const request = buildRwpRequest(card, {
  requestedAction: 'request_authorized_evidence',
  requesterRole: 'buyer',
  evidenceTypes: ['inspection_report', 'packing_list'],
  note: 'Please provide the minimum authorized evidence.',
  createdAt: '2026-08-02T01:00:00.000Z'
});

const requestUrl = buildRwpRequestUrl(request, card, 'https://example.test/rwp.html?unsafe=removed#old=1');
assert.equal(new URL(requestUrl).pathname, '/rwp-respond.html');
assert.deepEqual(readProofCardFromHash(new URL(requestUrl).hash), card);
assert.deepEqual(readRwpRequestFromHash(new URL(requestUrl).hash), request);

const accepted = buildRwpRequestResponse(card, request, {
  status: 'accept',
  responderRole: 'exporter',
  mode: 'authorized_off_channel',
  evidenceTypes: ['packing_list', 'inspection_report', 'inspection_report'],
  channelHint: 'existing_business_channel',
  note: 'The requested categories can be reviewed through the existing business channel.',
  createdAt: '2026-08-02T01:05:00.000Z'
});
assert.deepEqual(validateRwpRequestResponse(accepted, request), []);
assert.deepEqual(accepted.fulfillment.evidenceTypes, ['inspection_report', 'packing_list']);
assert.equal(accepted.assurance, RWP_REQUEST_RESPONSE_ASSURANCE);
assert.match(accepted.responseId, /^rwprr:[0-9a-f]{16}$/);
assert.match(accepted.responseDigest, /^0x[0-9a-f]{64}$/);
assert.deepEqual(decodeRwpRequestResponse(encodeRwpRequestResponse(accepted, request), request), accepted);

const responseUrl = buildRwpRequestResponseUrl(
  accepted,
  request,
  card,
  'https://example.test/rwp-respond.html?unsafe=removed#old=1'
);
const parsedResponseUrl = new URL(responseUrl);
assert.equal(parsedResponseUrl.pathname, '/rwp-respond.html');
assert.equal(parsedResponseUrl.search, '');
assert.deepEqual(readProofCardFromHash(parsedResponseUrl.hash), card);
assert.deepEqual(readRwpRequestFromHash(parsedResponseUrl.hash), request);
assert.deepEqual(readRwpRequestResponseFromHash(parsedResponseUrl.hash, request), accepted);

const partial = buildRwpRequestResponse(card, request, {
  status: 'partially_accept',
  responderRole: 'exporter',
  mode: 'authorized_off_channel',
  evidenceTypes: ['inspection_report'],
  channelHint: 'secure_data_room',
  createdAt: '2026-08-02T01:06:00.000Z'
});
assert.deepEqual(validateRwpRequestResponse(partial, request), []);

const clarification = buildRwpRequestResponse(card, request, {
  status: 'request_clarification',
  responderRole: 'exporter',
  mode: 'authorized_off_channel',
  evidenceTypes: ['inspection_report'],
  channelHint: 'secure_data_room',
  note: 'Please identify which inspection stage is required.',
  createdAt: '2026-08-02T01:07:00.000Z'
});
assert.deepEqual(validateRwpRequestResponse(clarification, request), []);
assert.deepEqual(clarification.fulfillment, { mode: 'public_note_only', evidenceTypes: [] });

const declined = buildRwpRequestResponse(card, request, {
  status: 'decline',
  responderRole: 'exporter',
  mode: 'authorized_off_channel',
  evidenceTypes: ['inspection_report'],
  channelHint: 'existing_business_channel',
  note: 'The requested disclosure is not authorized.',
  createdAt: '2026-08-02T01:08:00.000Z'
});
assert.deepEqual(validateRwpRequestResponse(declined, request), []);
assert.deepEqual(declined.fulfillment, { mode: 'none', evidenceTypes: [] });

const serialized = canonicalizeJson(accepted);
for (const forbidden of [
  'Example Exporter Ltd.',
  'Example Buyer Inc.',
  'party:exporter:example',
  'evidence://private',
  '1111111111111111111111111111111111111111111111111111111111111111',
  'The purchase order covers 240',
  '@example.com',
  'https://example.com'
]) {
  assert.equal(serialized.includes(forbidden), false, `response leaked ${forbidden}`);
}

assert.throws(
  () => buildRwpRequestResponse(card, request, {
    status: 'partially_accept',
    responderRole: 'exporter',
    mode: 'authorized_off_channel',
    evidenceTypes: ['inspection_report', 'packing_list'],
    channelHint: 'existing_business_channel'
  }),
  /proper subset/
);
assert.throws(
  () => buildRwpRequestResponse(card, request, {
    status: 'request_clarification',
    responderRole: 'exporter',
    mode: 'public_note_only',
    evidenceTypes: []
  }),
  /requires a public note/
);
assert.throws(
  () => buildRwpRequestResponse(card, request, {
    status: 'accept',
    responderRole: 'exporter',
    mode: 'authorized_off_channel',
    evidenceTypes: ['inspection_report'],
    channelHint: 'existing_business_channel'
  }),
  /every requested evidence category/
);
assert.throws(
  () => encodeRwpRequestResponse({ ...accepted, note: 'Changed after digest' }, request),
  /responseDigest/
);
assert.throws(
  () => buildRwpRequestResponse(card, request, {
    status: 'accept',
    responderRole: 'exporter',
    mode: 'authorized_off_channel',
    evidenceTypes: ['inspection_report', 'packing_list'],
    channelHint: 'existing_business_channel',
    note: 'Contact holder@example.com'
  }),
  /forbidden private or endpoint marker/
);

const invalidDecline = {
  ...declined,
  fulfillment: {
    mode: 'authorized_off_channel',
    evidenceTypes: ['inspection_report'],
    channelHint: 'existing_business_channel'
  }
};
assert.match(validateRwpRequestResponse(invalidDecline, request).join(' '), /Decline boundary/);

const otherRequest = buildRwpRequest(card, {
  requestedAction: 'request_change',
  requesterRole: 'buyer',
  note: 'Please clarify the status.',
  createdAt: '2026-08-02T01:10:00.000Z'
});
assert.match(validateRwpRequestResponse(accepted, otherRequest).join(' '), /source does not match/i);

console.log('PASS: RWP Request Response decisions, UI-safe normalization, strict validation, privacy and link integrity');
