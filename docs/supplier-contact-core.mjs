export const CONTACT_BOOK_VERSION = 'tradeproof.supplier-contact-book.v0.6';
export const DISCLOSURE_APPROVAL_VERSION = 'tradeproof.contact-disclosure-approval.v0.6';
export const DISCLOSURE_CONFIRMATION_TEXT = 'APPROVE CONTACT DISCLOSURE';

const text = (value) => String(value ?? '').trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const nowIso = (value) => value ?? new Date().toISOString();
const clone = (value) => structuredClone(value);
const safeId = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'contact';

export function isValidEmail(value) {
  const email = text(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function maskEmail(value) {
  const email = text(value);
  if (!isValidEmail(email)) return 'invalid-email';
  const [local, domain] = email.split('@');
  const [name, ...suffix] = domain.split('.');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, Math.min(6, local.length - 2)))}@${name.slice(0, 1)}***.${suffix.join('.')}`;
}

export function createContactBook(caseRecord, selectedCandidateIds = [], at) {
  return {
    schemaVersion: CONTACT_BOOK_VERSION,
    caseId: caseRecord?.caseId ?? null,
    targetOpportunityId: caseRecord?.sourceOpportunity?.opportunityId ?? null,
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    selectedCandidateIds: unique(selectedCandidateIds),
    contacts: [],
    state: 'holder_local_private',
    sourcePolicy: 'holder_supplied_only',
    scrapingPerformed: false,
    externalLookupPerformed: false,
    serverPersistencePerformed: false,
    formalWritePerformed: false
  };
}

export function upsertContact(book, input, at) {
  const candidateId = text(input?.candidateId);
  const address = text(input?.address).toLowerCase();
  if (!candidateId) throw new Error('candidateId is required');
  if (!isValidEmail(address)) throw new Error('valid email address is required');
  if (!(book?.selectedCandidateIds ?? []).includes(candidateId)) throw new Error('contact candidate must be selected locally');
  const next = clone(book);
  const contactId = text(input?.contactId) || `contact:${safeId(candidateId)}:${safeId(address)}`;
  const current = next.contacts.find((item) => item.contactId === contactId || (item.candidateId === candidateId && item.address === address));
  const record = {
    contactId,
    candidateId,
    channel: 'email',
    address,
    maskedAddress: maskEmail(address),
    displayName: text(input?.displayName),
    organization: text(input?.organization),
    sourceType: 'holder_supplied',
    sourceNote: text(input?.sourceNote),
    contactVerified: false,
    state: 'holder_local_private',
    createdAt: current?.createdAt ?? nowIso(at),
    updatedAt: nowIso(at),
    scrapingPerformed: false,
    externalLookupPerformed: false,
    externalSendPerformed: false
  };
  next.contacts = [...next.contacts.filter((item) => item.contactId !== contactId && !(item.candidateId === candidateId && item.address === address)), record];
  next.updatedAt = nowIso(at);
  return next;
}

export function validateContactBook(book) {
  const errors = [];
  if (book?.schemaVersion !== CONTACT_BOOK_VERSION) errors.push('unexpected contact book schemaVersion');
  if (book?.state !== 'holder_local_private') errors.push('contact book must remain holder_local_private');
  if (book?.sourcePolicy !== 'holder_supplied_only') errors.push('sourcePolicy must remain holder_supplied_only');
  for (const key of ['scrapingPerformed', 'externalLookupPerformed', 'serverPersistencePerformed', 'formalWritePerformed']) if (book?.[key] !== false) errors.push(`${key} must remain false`);
  const allowed = new Set(book?.selectedCandidateIds ?? []);
  for (const contact of book?.contacts ?? []) {
    if (!allowed.has(contact.candidateId)) errors.push(`contact candidate is not selected: ${contact.candidateId}`);
    if (!isValidEmail(contact.address)) errors.push(`invalid contact email: ${contact.contactId}`);
    if (contact.channel !== 'email' || contact.sourceType !== 'holder_supplied' || contact.contactVerified !== false) errors.push(`contact boundary changed: ${contact.contactId}`);
    if (contact.scrapingPerformed !== false || contact.externalLookupPerformed !== false || contact.externalSendPerformed !== false) errors.push(`contact action boundary changed: ${contact.contactId}`);
  }
  return unique(errors);
}

export function createDisclosureApproval({ caseRecord, candidateId, contact, confirmationText, approvedBy = 'holder', at }) {
  if (text(confirmationText) !== DISCLOSURE_CONFIRMATION_TEXT) throw new Error('exact disclosure confirmation text is required');
  if (!contact || contact.candidateId !== candidateId) throw new Error('contact does not match candidate');
  return {
    schemaVersion: DISCLOSURE_APPROVAL_VERSION,
    approvalId: `disclosure:${safeId(caseRecord?.caseId)}:${safeId(contact.contactId)}`,
    caseId: caseRecord?.caseId ?? null,
    candidateId,
    contactId: contact.contactId,
    approvedAt: nowIso(at),
    approvedBy: text(approvedBy) || 'holder',
    confirmationText: DISCLOSURE_CONFIRMATION_TEXT,
    scope: 'prepare_outreach_draft_only',
    contactDisclosureApproved: true,
    draftGenerationApproved: true,
    externalSendApproved: false,
    externalSendPerformed: false,
    formalSubmissionPerformed: false,
    state: 'holder_local_disclosure_approved'
  };
}

export function validateDisclosureApproval(approval, contact) {
  const errors = [];
  if (approval?.schemaVersion !== DISCLOSURE_APPROVAL_VERSION || approval?.state !== 'holder_local_disclosure_approved') errors.push('invalid disclosure approval');
  if (approval?.confirmationText !== DISCLOSURE_CONFIRMATION_TEXT || approval?.contactDisclosureApproved !== true || approval?.draftGenerationApproved !== true) errors.push('disclosure approval is incomplete');
  if (approval?.externalSendApproved !== false || approval?.externalSendPerformed !== false || approval?.formalSubmissionPerformed !== false) errors.push('send boundary changed');
  if (contact && approval?.contactId !== contact.contactId) errors.push('approval contact mismatch');
  return unique(errors);
}
