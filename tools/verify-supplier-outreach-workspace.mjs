#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONTACT_BOOK_VERSION, DISCLOSURE_APPROVAL_VERSION, DISCLOSURE_CONFIRMATION_TEXT, createContactBook, createDisclosureApproval, isValidEmail, maskEmail, upsertContact, validateContactBook, validateDisclosureApproval } from '../docs/supplier-contact-core.mjs';
import { OUTREACH_DRAFT_VERSION, OUTREACH_WORKSPACE_VERSION, buildEmlExport, buildOutreachWorkspaceModel, createOutreachDraft, validateOutreachDraft } from '../docs/supplier-outreach-core.mjs';

const html = await readFile(new URL('../docs/supplier-outreach.html', import.meta.url), 'utf8');
const ui = await readFile(new URL('../docs/supplier-outreach.mjs', import.meta.url), 'utf8');
const contactCore = await readFile(new URL('../docs/supplier-contact-core.mjs', import.meta.url), 'utf8');
const core = await readFile(new URL('../docs/supplier-outreach-core.mjs', import.meta.url), 'utf8');
const css = await readFile(new URL('../docs/supplier-outreach.css', import.meta.url), 'utf8');
const operations = await readFile(new URL('../docs/operations.html', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/supplier-outreach.schema.json', import.meta.url), 'utf8'));

assert.equal(CONTACT_BOOK_VERSION, 'tradeproof.supplier-contact-book.v0.6');
assert.equal(DISCLOSURE_APPROVAL_VERSION, 'tradeproof.contact-disclosure-approval.v0.6');
assert.equal(OUTREACH_DRAFT_VERSION, 'tradeproof.supplier-outreach-draft.v0.6');
assert.equal(OUTREACH_WORKSPACE_VERSION, 'tradeproof.supplier-outreach-workspace.v0.6');
assert.equal(schema.title.includes('v0.6'), true);
assert.equal(isValidEmail('sales@example.com'), true);
assert.equal(isValidEmail('bad email'), false);
assert.equal(maskEmail('sales@example.com').includes('sales@example.com'), false);

const caseRecord = {
  caseId: 'trade-case:ted-search-api:519243-2026',
  title: 'Hospital furniture with delivery and installation',
  sourceOpportunity: { opportunityId: 'opportunity:ted:519243-2026', recordId: '519243-2026' }
};
const selectedIds = ['supplier-candidate:china-loong', 'supplier-candidate:zhaofa'];
const collection = {
  candidates: [
    { candidateId: selectedIds[0], displayName: 'China Loong Furniture' },
    { candidateId: selectedIds[1], displayName: 'Hebei Zhaofa' },
    { candidateId: 'supplier-candidate:unselected', displayName: 'Unselected Supplier' }
  ]
};
const review = { selectedCandidateIds: selectedIds };
const request = {
  requestId: 'supplier-request:519243-2026',
  selectedCandidateIds: selectedIds,
  questions: [
    { questionId: 'q1', prompt: 'Company identity' },
    { questionId: 'q2', prompt: 'Technical capability', sourceRequirementId: 'req-tech' }
  ]
};

let book = createContactBook(caseRecord, selectedIds, '2026-08-03T00:00:00.000Z');
assert.deepEqual(validateContactBook(book), []);
assert.throws(() => upsertContact(book, { candidateId: 'supplier-candidate:unselected', address: 'sales@unselected.test' }), /selected locally/);
assert.throws(() => upsertContact(book, { candidateId: selectedIds[0], address: 'not-an-email' }), /valid email/);
book = upsertContact(book, {
  candidateId: selectedIds[0],
  address: 'sales@china-loong.example',
  displayName: 'Export Team',
  organization: 'China Loong Furniture',
  sourceNote: 'Entered by holder from a business card'
}, '2026-08-03T00:01:00.000Z');
assert.deepEqual(validateContactBook(book), []);
assert.equal(book.contacts[0].sourceType, 'holder_supplied');
assert.equal(book.contacts[0].contactVerified, false);
assert.equal(book.contacts[0].scrapingPerformed, false);
assert.equal(book.contacts[0].externalLookupPerformed, false);

const preApprovalModel = buildOutreachWorkspaceModel({ caseRecord, request, collection, review, contactBook: book });
assert.equal(preApprovalModel.candidates[0].maskedAddress.includes('sales@china-loong.example'), false);
assert.equal(preApprovalModel.candidates[0].disclosedAddress, null);
assert.equal(preApprovalModel.counts.externalSends, 0);
assert.throws(() => createDisclosureApproval({ caseRecord, candidateId: selectedIds[0], contact: book.contacts[0], confirmationText: 'approve' }), /exact disclosure/);

const approval = createDisclosureApproval({
  caseRecord,
  candidateId: selectedIds[0],
  contact: book.contacts[0],
  confirmationText: DISCLOSURE_CONFIRMATION_TEXT,
  at: '2026-08-03T00:02:00.000Z'
});
assert.deepEqual(validateDisclosureApproval(approval, book.contacts[0]), []);
assert.equal(approval.externalSendApproved, false);
assert.equal(approval.externalSendPerformed, false);

const approvedModel = buildOutreachWorkspaceModel({ caseRecord, request, collection, review, contactBook: book, approvals: [approval] });
assert.equal(approvedModel.candidates[0].disclosedAddress, 'sales@china-loong.example');
assert.equal(approvedModel.candidates[1].contactState, 'missing_contact');

const draft = createOutreachDraft({
  caseRecord,
  request,
  candidate: collection.candidates[0],
  contact: book.contacts[0],
  approval,
  sender: { displayName: 'Aaron', organization: 'TradeProof', replyTo: 'aaron@example.com' },
  at: '2026-08-03T00:03:00.000Z'
});
assert.deepEqual(validateOutreachDraft(draft), []);
assert.equal(draft.externalSendApproved, false);
assert.equal(draft.externalSendPerformed, false);
assert.equal(draft.formalSubmissionPerformed, false);
assert.equal(draft.attachmentUploadPerformed, false);
assert.equal(draft.body.includes('not an award'), true);
assert.equal(draft.recipient.contactVerified, false);

const eml = buildEmlExport(draft);
assert.equal(eml.mediaType, 'message/rfc822');
assert.equal(eml.content.includes('To: Export Team <sales@china-loong.example>'), true);
assert.equal(eml.content.includes('X-TradeProof-External-Send-Performed: false'), true);
assert.equal(eml.externalSendPerformed, false);
assert.equal(eml.formalSubmissionPerformed, false);

const finalModel = buildOutreachWorkspaceModel({ caseRecord, request, collection, review, contactBook: book, approvals: [approval], drafts: [draft] });
assert.equal(finalModel.counts.selectedCandidates, 2);
assert.equal(finalModel.counts.contactsAvailable, 1);
assert.equal(finalModel.counts.disclosureApprovals, 1);
assert.equal(finalModel.counts.draftsReady, 1);
assert.equal(finalModel.counts.externalSends, 0);
assert.equal(finalModel.boundaries.automaticOutreachPerformed, false);
assert.equal(finalModel.boundaries.contactVerificationPerformed, false);
assert.equal(finalModel.boundaries.rankingGenerated, false);
assert.equal(finalModel.boundaries.supplierEligibilityDecided, false);

for (const marker of ['data-supplier-outreach-root', 'supplier-outreach.mjs', 'APPROVE CONTACT DISCLOSURE', '不会自动发送']) {
  assert.equal(html.includes(marker) || ui.includes(marker), true, `Outreach surface must contain ${marker}`);
}
for (const marker of ['holder_supplied_only', 'externalSendApproved: false', 'externalSendPerformed: false', 'buildEmlExport']) {
  assert.equal((core + contactCore).includes(marker), true, `Outreach core must contain ${marker}`);
}
assert.equal(operations.includes('./supplier-outreach.html'), true, 'Daily operations must link the outreach workspace.');
assert.equal(css.includes('@media(max-width:720px)'), true);
assert.equal(/fetch\(|XMLHttpRequest|WebSocket/.test(core + contactCore), false, 'Outreach core must not perform network access.');
assert.equal(/sendMail|smtp|nodemailer|gmail|outlook/i.test(core + contactCore), false, 'Outreach core must not contain a send runtime.');

console.log('PASS: Supplier Outreach Preparation v0.6');
console.log(`Selected candidates: ${finalModel.counts.selectedCandidates}`);
console.log(`Holder-supplied contacts: ${finalModel.counts.contactsAvailable}`);
console.log(`Disclosure approvals: ${finalModel.counts.disclosureApprovals}`);
console.log(`Local drafts ready: ${finalModel.counts.draftsReady}`);
console.log('Contact scraping / lookup: 0');
console.log('External sends: 0');
console.log('Formal submissions: 0');
console.log('Ranking / eligibility decisions: 0');
