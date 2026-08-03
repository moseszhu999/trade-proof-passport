import { isValidEmail, validateDisclosureApproval } from './supplier-contact-core.mjs';

export const OUTREACH_DRAFT_VERSION = 'tradeproof.supplier-outreach-draft.v0.6';
export const OUTREACH_WORKSPACE_VERSION = 'tradeproof.supplier-outreach-workspace.v0.6';

const text = (value) => String(value ?? '').trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const safeId = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'draft';
const nowIso = (value) => value ?? new Date().toISOString();
const candidateName = (candidate) => text(candidate?.displayName) || text(candidate?.candidateId) || 'Supplier';

export function createOutreachDraft({ caseRecord, request, candidate, contact, approval, sender = {}, at }) {
  const approvalErrors = validateDisclosureApproval(approval, contact);
  if (approvalErrors.length) throw new Error(approvalErrors.join('; '));
  if (!request || !(request.selectedCandidateIds ?? []).includes(candidate?.candidateId)) throw new Error('candidate is not included in the local response request');
  if (contact.candidateId !== candidate.candidateId) throw new Error('contact candidate mismatch');
  const questionCount = request.questions?.length ?? 0;
  const confirmedCount = (request.questions ?? []).filter((item) => item.sourceRequirementId).length;
  const subject = `Supplier information request – ${text(caseRecord?.sourceOpportunity?.recordId) || text(caseRecord?.title) || 'Trade opportunity'}`;
  const body = [
    `Dear ${text(contact.displayName) || candidateName(candidate)} team,`,
    '',
    `We are reviewing potential suppliers for the following opportunity: ${text(caseRecord?.title) || 'Trade opportunity'}.`,
    `Reference: ${text(caseRecord?.sourceOpportunity?.recordId) || 'not provided'}.`,
    '',
    `We prepared a structured response request with ${questionCount} questions, including ${confirmedCount} questions derived from holder-confirmed source requirements.`,
    'Please review the response template, complete it, and return it with any supporting documents you choose to provide.',
    '',
    'Important: this is an information request only. It is not an award, purchase order, contract, eligibility decision, or commitment to transact.',
    '',
    'Regards,',
    text(sender.displayName) || 'TradeProof workspace holder',
    text(sender.organization)
  ].filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\r\n');
  return {
    schemaVersion: OUTREACH_DRAFT_VERSION,
    draftId: `outreach:${safeId(caseRecord?.caseId)}:${safeId(candidate.candidateId)}:${safeId(contact.contactId)}`,
    caseId: caseRecord?.caseId ?? null,
    candidateId: candidate.candidateId,
    supplierDisplayName: candidateName(candidate),
    requestId: request.requestId ?? null,
    contactId: contact.contactId,
    recipient: { channel: 'email', address: contact.address, displayName: contact.displayName, contactVerified: false, disclosureApprovalId: approval.approvalId },
    sender: { displayName: text(sender.displayName), organization: text(sender.organization), replyTo: isValidEmail(sender.replyTo) ? text(sender.replyTo).toLowerCase() : '' },
    subject,
    body,
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    state: 'holder_local_approved_draft',
    recipientDisclosurePerformed: true,
    externalSendApproved: false,
    externalSendPerformed: false,
    formalSubmissionPerformed: false,
    attachmentUploadPerformed: false,
    responseTemplateAttachmentRequired: true,
    emlExportReady: true,
    rankingGenerated: false,
    supplierEligibilityDecided: false
  };
}

export function validateOutreachDraft(draft) {
  const errors = [];
  if (draft?.schemaVersion !== OUTREACH_DRAFT_VERSION || draft?.state !== 'holder_local_approved_draft') errors.push('invalid outreach draft');
  if (!isValidEmail(draft?.recipient?.address) || draft?.recipient?.contactVerified !== false) errors.push('recipient must remain unverified');
  if (draft?.recipientDisclosurePerformed !== true) errors.push('recipient disclosure must be explicit');
  for (const key of ['externalSendApproved', 'externalSendPerformed', 'formalSubmissionPerformed', 'attachmentUploadPerformed', 'rankingGenerated', 'supplierEligibilityDecided']) if (draft?.[key] !== false) errors.push(`${key} must remain false`);
  if (!text(draft?.subject) || !text(draft?.body)) errors.push('subject and body are required');
  return unique(errors);
}

export function buildEmlExport(draft) {
  const errors = validateOutreachDraft(draft);
  if (errors.length) throw new Error(errors.join('; '));
  const safeHeader = (value) => text(value).replace(/[\r\n]+/g, ' ');
  const recipient = draft.recipient.displayName ? `${draft.recipient.displayName} <${draft.recipient.address}>` : draft.recipient.address;
  const headers = [
    `To: ${safeHeader(recipient)}`,
    draft.sender.replyTo ? `Reply-To: ${safeHeader(draft.sender.replyTo)}` : null,
    `Subject: ${safeHeader(draft.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-TradeProof-State: holder-local-draft',
    'X-TradeProof-External-Send-Performed: false'
  ].filter(Boolean);
  return {
    fileName: `${safeId(draft.supplierDisplayName)}-${safeId(draft.requestId || draft.caseId)}.eml`,
    mediaType: 'message/rfc822',
    content: `${headers.join('\r\n')}\r\n\r\n${draft.body}\r\n`,
    state: 'holder_local_eml_export',
    externalSendPerformed: false,
    formalSubmissionPerformed: false
  };
}

export function buildOutreachWorkspaceModel({ caseRecord, request, collection, review, contactBook, approvals = [], drafts = [] }) {
  const selected = new Set(review?.selectedCandidateIds ?? []);
  const candidates = (collection?.candidates ?? []).filter((candidate) => selected.has(candidate.candidateId));
  const contacts = new Map((contactBook?.contacts ?? []).map((item) => [item.candidateId, item]));
  const approvalMap = new Map(approvals.map((item) => [item.contactId, item]));
  const draftMap = new Map(drafts.map((item) => [item.candidateId, item]));
  const rows = candidates.map((candidate) => {
    const contact = contacts.get(candidate.candidateId) ?? null;
    const approval = contact ? approvalMap.get(contact.contactId) ?? null : null;
    const approved = Boolean(contact && approval && validateDisclosureApproval(approval, contact).length === 0);
    const draft = draftMap.get(candidate.candidateId) ?? null;
    return {
      candidateId: candidate.candidateId,
      displayName: candidateName(candidate),
      contactState: contact ? 'holder_supplied_unverified' : 'missing_contact',
      maskedAddress: contact?.maskedAddress ?? null,
      disclosedAddress: approved ? contact.address : null,
      contactVerified: false,
      disclosureState: approved ? 'holder_local_disclosure_approved' : 'not_approved',
      draftState: draft?.state ?? 'not_created',
      requestIncluded: Boolean(request?.selectedCandidateIds?.includes(candidate.candidateId)),
      externalSendPerformed: false,
      formalSubmissionPerformed: false
    };
  });
  return {
    schemaVersion: OUTREACH_WORKSPACE_VERSION,
    caseId: caseRecord?.caseId ?? null,
    requestId: request?.requestId ?? null,
    counts: {
      selectedCandidates: rows.length,
      contactsAvailable: rows.filter((row) => row.contactState !== 'missing_contact').length,
      disclosureApprovals: rows.filter((row) => row.disclosureState === 'holder_local_disclosure_approved').length,
      draftsReady: rows.filter((row) => row.draftState === 'holder_local_approved_draft').length,
      externalSends: 0,
      formalSubmissions: 0
    },
    candidates: rows,
    boundaries: {
      scrapingPerformed: false,
      externalLookupPerformed: false,
      contactVerificationPerformed: false,
      externalSendPerformed: false,
      automaticOutreachPerformed: false,
      formalSubmissionPerformed: false,
      rankingGenerated: false,
      supplierEligibilityDecided: false
    }
  };
}
