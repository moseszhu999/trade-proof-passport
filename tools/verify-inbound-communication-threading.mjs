#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { INBOUND_EVENT_VERSION, INBOUND_TIMELINE_VERSION, INBOUND_WORKSPACE_VERSION, MAX_EML_BYTES, appendInboundEvent, associateInboundMessage, buildInboundWorkspaceModel, createInboundEvent, createInboundTimeline, parseEml, validateInboundEvent, validateInboundTimeline } from '../docs/inbound-communication-core.mjs';

const html = await readFile(new URL('../docs/inbound-communications.html', import.meta.url), 'utf8');
const ui = await readFile(new URL('../docs/inbound-communications.mjs', import.meta.url), 'utf8');
const core = await readFile(new URL('../docs/inbound-communication-core.mjs', import.meta.url), 'utf8');
const css = await readFile(new URL('../docs/inbound-communications.css', import.meta.url), 'utf8');
const operations = await readFile(new URL('../docs/operations.html', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/inbound-communication.schema.json', import.meta.url), 'utf8'));

assert.equal(INBOUND_EVENT_VERSION, 'tradeproof.inbound-communication-event.v0.7');
assert.equal(INBOUND_TIMELINE_VERSION, 'tradeproof.inbound-communication-timeline.v0.7');
assert.equal(INBOUND_WORKSPACE_VERSION, 'tradeproof.inbound-communication-workspace.v0.7');
assert.equal(MAX_EML_BYTES, 2097152);
assert.equal(schema.title.includes('v0.7'), true);

const eml = `From: Export Team <sales@china-loong.example>\r\nTo: Aaron <aaron@example.com>\r\nSubject: Re: TradeProof request supplier-request:519243-2026\r\nDate: Mon, 03 Aug 2026 08:30:00 +0800\r\nMessage-ID: <reply-001@example.com>\r\nIn-Reply-To: <draft-001@tradeproof.local>\r\nX-TradeProof-Case-Id: trade-case:ted-search-api:519243-2026\r\nX-TradeProof-Request-Id: supplier-request:519243-2026\r\nX-TradeProof-Candidate-Id: supplier-candidate:china-loong\r\nContent-Type: multipart/mixed; boundary="mix-1"\r\n\r\n--mix-1\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nPlease confirm the installation location. We attached our catalogue and quotation. We need more time for the certificate.\r\n--mix-1\r\nContent-Type: application/json; name="tradeproof-supplier-response.json"\r\nContent-Disposition: attachment; filename="tradeproof-supplier-response.json"\r\nContent-Transfer-Encoding: base64\r\n\r\neyJzY2hlbWFWZXJzaW9uIjoidHJhZGVwcm9vZi5zdXBwbGllci1yZXNwb25zZS52MC41In0=\r\n--mix-1--\r\n`;

const parsed = parseEml(eml);
assert.equal(parsed.messageId, 'reply-001@example.com');
assert.equal(parsed.from.address, 'sales@china-loong.example');
assert.equal(parsed.bodyText.includes('Please confirm'), true);
assert.equal(parsed.attachments.length, 1);
assert.equal(parsed.attachments[0].fileName, 'tradeproof-supplier-response.json');
assert.equal(parsed.attachments[0].contentRead, false);
assert.equal(parsed.attachments[0].contentDecoded, false);
assert.equal(Object.hasOwn(parsed.attachments[0], 'content'), false);

const caseRecord = { caseId: 'trade-case:ted-search-api:519243-2026', sourceOpportunity: { recordId: '519243-2026' } };
const request = { requestId: 'supplier-request:519243-2026' };
const review = { selectedCandidateIds: ['supplier-candidate:china-loong'] };
const collection = { candidates: [{ candidateId: 'supplier-candidate:china-loong', displayName: 'China Loong Furniture' }] };
const contactBook = { contacts: [{ candidateId: 'supplier-candidate:china-loong', address: 'sales@china-loong.example' }] };
const association = associateInboundMessage(parsed, { caseRecord, request, review, collection, contactBook });
assert.equal(association.associationState, 'header_bound_unverified');
assert.equal(association.candidateId, 'supplier-candidate:china-loong');
assert.equal(association.senderIdentityVerified, false);
assert.equal(association.humanReviewRequired, true);

const event = createInboundEvent(parsed, association, '2026-08-03T01:00:00.000Z');
assert.deepEqual(validateInboundEvent(event), []);
assert.equal(event.actionCandidates.some((item) => item.actionType === 'review_evidence_metadata'), true);
assert.equal(event.actionCandidates.some((item) => item.actionType === 'review_timeline_change'), true);
assert.equal(event.actionCandidates.some((item) => item.actionType === 'prepare_clarification_response'), true);
assert.equal(event.structuredResponseSignal.state, 'attachment_metadata_suggests_structured_response');
assert.equal(event.structuredResponseSignal.structuredResponseImported, false);
assert.equal(event.boundaries.automaticReplyPerformed, false);
assert.equal(event.boundaries.formalSubmissionPerformed, false);

let timeline = createInboundTimeline(caseRecord, '2026-08-03T00:00:00.000Z');
let result = appendInboundEvent(timeline, event, '2026-08-03T01:00:01.000Z');
assert.equal(result.added, true);
timeline = result.timeline;
result = appendInboundEvent(timeline, event, '2026-08-03T01:00:02.000Z');
assert.equal(result.added, false);
assert.equal(result.timeline.events.length, 1);
assert.deepEqual(validateInboundTimeline(result.timeline), []);

const contactOnlyEml = `From: Export Team <sales@china-loong.example>\nTo: Aaron <aaron@example.com>\nSubject: Hello\n\nGeneral response.`;
const contactParsed = parseEml(contactOnlyEml);
const contactAssociation = associateInboundMessage(contactParsed, { caseRecord, request, review, collection, contactBook });
assert.equal(contactAssociation.associationState, 'contact_address_match_unverified');
assert.equal(contactAssociation.senderIdentityVerified, false);

const unmatched = associateInboundMessage(parseEml('From: unknown@other.test\nTo: a@b.test\nSubject: Other\n\nHello'), { caseRecord, request, review, collection, contactBook });
assert.equal(unmatched.associationState, 'unmatched_needs_review');
assert.equal(unmatched.humanReviewRequired, true);
assert.throws(() => parseEml('x'.repeat(MAX_EML_BYTES + 1)), /size limit/);
assert.throws(() => parseEml('From: a@b.test\nSubject: missing separator'), /separator/);

const model = buildInboundWorkspaceModel({ caseRecord, request, review, collection, contactBook, timeline });
assert.equal(model.counts.inboundEvents, 1);
assert.equal(model.counts.verifiedSenders, 0);
assert.equal(model.counts.formalSubmissions, 0);
assert.equal(model.counts.automaticReplies, 0);
assert.equal(model.boundaries.attachmentContentRead, false);
assert.equal(model.boundaries.responseAutoImported, false);
assert.equal(model.boundaries.rankingGenerated, false);
assert.equal(model.boundaries.supplierEligibilityDecided, false);

for (const marker of ['data-inbound-communication-root', 'inbound-communications.mjs', '选择 EML 文件', '身份验证 0']) assert.equal(html.includes(marker) || ui.includes(marker), true, `surface missing ${marker}`);
for (const marker of ['inbound_email_unverified', 'attachmentContentRead: false', 'automaticReplyPerformed: false', 'unmatched_needs_review']) assert.equal(core.includes(marker), true, `core missing ${marker}`);
assert.equal(operations.includes('./inbound-communications.html'), true, 'Daily operations must link inbound communications.');
assert.equal(css.includes('@media(max-width:760px)'), true);
assert.equal(/fetch\(|XMLHttpRequest|WebSocket/.test(core), false, 'Core must not perform network access.');
assert.equal(/sendMail|smtp|nodemailer|gmail|outlook|imap/i.test(core), false, 'Core must not contain inbox or send runtime.');

console.log('PASS: Inbound Communication Threading v0.7');
console.log(`Inbound events: ${model.counts.inboundEvents}`);
console.log(`Action candidates: ${model.counts.actionCandidates}`);
console.log(`Attachment metadata: ${model.counts.attachmentMetadata}`);
console.log('Sender verification: 0');
console.log('Attachment content reads/downloads: 0');
console.log('Automatic replies: 0');
console.log('Formal submissions: 0');
