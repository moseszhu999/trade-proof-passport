export const INBOUND_EVENT_VERSION = 'tradeproof.inbound-communication-event.v0.7';
export const INBOUND_TIMELINE_VERSION = 'tradeproof.inbound-communication-timeline.v0.7';
export const INBOUND_WORKSPACE_VERSION = 'tradeproof.inbound-communication-workspace.v0.7';
export const MAX_EML_BYTES = 2 * 1024 * 1024;

const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();
const clone = (value) => structuredClone(value);
const nowIso = (value) => value ?? new Date().toISOString();
const unique = (values) => [...new Set(values.filter(Boolean))];
const utf8Bytes = (value) => new TextEncoder().encode(String(value ?? ''));

function decodeBase64Text(value, charset = 'utf-8') {
  try {
    const binary = atob(String(value ?? '').replace(/\s+/g, ''));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder(/utf-?8/i.test(charset) ? 'utf-8' : 'iso-8859-1').decode(bytes);
  } catch {
    return '';
  }
}

function safeId(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96) || 'message';
}

function unfoldHeaders(raw) {
  return raw.replace(/\r?\n[ \t]+/g, ' ');
}

function decodeEncodedWord(value) {
  return text(value).replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, charset, mode, payload) => {
    try {
      if (mode.toUpperCase() === 'B') return decodeBase64Text(payload, charset);
      const qp = payload.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
      const bytes = Uint8Array.from(qp, (char) => char.charCodeAt(0));
      return new TextDecoder(/utf-?8/i.test(charset) ? 'utf-8' : 'iso-8859-1').decode(bytes);
    } catch {
      return payload;
    }
  });
}

function parseHeaderBlock(headerText) {
  const headers = {};
  for (const line of unfoldHeaders(headerText).split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index <= 0) continue;
    const name = line.slice(0, index).trim().toLowerCase();
    const value = decodeEncodedWord(line.slice(index + 1));
    headers[name] = headers[name] ? `${headers[name]}, ${value}` : value;
  }
  return headers;
}

function headerParam(value, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i');
  const match = text(value).match(pattern);
  return text(match?.[1] ?? match?.[2]);
}

function decodeQuotedPrintable(value) {
  return value
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function decodeTextPart(body, encoding) {
  const mode = lower(encoding);
  if (mode === 'base64') return decodeBase64Text(body, 'utf-8');
  if (mode === 'quoted-printable') return decodeQuotedPrintable(body);
  return body;
}

function parseAddress(value) {
  const raw = text(value);
  const angle = raw.match(/<([^>]+)>/);
  const address = lower(angle?.[1] ?? raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]);
  const displayName = angle ? decodeEncodedWord(raw.slice(0, angle.index).replace(/^"|"$/g, '')) : '';
  return { raw, address, displayName };
}

function splitMultipart(body, boundary) {
  if (!boundary) return [];
  const token = `--${boundary}`;
  return body.split(token).slice(1).map((part) => part.replace(/^\r?\n/, '').replace(/\r?\n--\r?\n?$/, '').trim()).filter(Boolean);
}

function parseMimePart(rawPart, depth = 0) {
  if (depth > 4) return { bodyTextCandidates: [], attachments: [] };
  const separator = rawPart.search(/\r?\n\r?\n/);
  const headerText = separator >= 0 ? rawPart.slice(0, separator) : '';
  const body = separator >= 0 ? rawPart.slice(separator).replace(/^\r?\n\r?\n/, '') : rawPart;
  const headers = parseHeaderBlock(headerText);
  const contentType = lower(headers['content-type'] || 'text/plain');
  const disposition = lower(headers['content-disposition']);
  const transferEncoding = lower(headers['content-transfer-encoding']);
  const filename = decodeEncodedWord(headerParam(headers['content-disposition'], 'filename') || headerParam(headers['content-type'], 'name'));

  if (contentType.startsWith('multipart/')) {
    const boundary = headerParam(headers['content-type'], 'boundary');
    const nested = splitMultipart(body, boundary).map((part) => parseMimePart(part, depth + 1));
    return {
      bodyTextCandidates: nested.flatMap((item) => item.bodyTextCandidates),
      attachments: nested.flatMap((item) => item.attachments)
    };
  }

  const attachmentLike = disposition.includes('attachment') || Boolean(filename);
  if (attachmentLike) {
    return {
      bodyTextCandidates: [],
      attachments: [{
        fileName: filename || 'unnamed-attachment',
        mediaType: contentType.split(';')[0] || 'application/octet-stream',
        contentTransferEncoding: transferEncoding || 'unknown',
        observedEncodedBytes: utf8Bytes(body).length,
        contentRead: false,
        contentDecoded: false,
        contentUploaded: false,
        evidenceVerified: false
      }]
    };
  }

  if (contentType.startsWith('text/plain')) {
    return { bodyTextCandidates: [{ priority: 1, value: decodeTextPart(body, transferEncoding) }], attachments: [] };
  }
  if (contentType.startsWith('text/html')) {
    const html = decodeTextPart(body, transferEncoding);
    const plain = html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
    return { bodyTextCandidates: [{ priority: 2, value: plain }], attachments: [] };
  }
  return { bodyTextCandidates: [], attachments: [] };
}

export function parseEml(raw, options = {}) {
  const source = String(raw ?? '');
  const byteLength = utf8Bytes(source).length;
  if (!source.trim()) throw new Error('EML content is empty');
  if (byteLength > (options.maxBytes ?? MAX_EML_BYTES)) throw new Error('EML exceeds local intake size limit');
  if (source.includes('\u0000')) throw new Error('EML contains NUL bytes');

  const separator = source.search(/\r?\n\r?\n/);
  if (separator < 0) throw new Error('EML header/body separator is missing');
  const headerText = source.slice(0, separator);
  const bodyRaw = source.slice(separator).replace(/^\r?\n\r?\n/, '');
  const headers = parseHeaderBlock(headerText);
  const topType = lower(headers['content-type'] || 'text/plain');
  let parsed;
  if (topType.startsWith('multipart/')) {
    const boundary = headerParam(headers['content-type'], 'boundary');
    if (!boundary) throw new Error('Multipart EML boundary is missing');
    const nested = splitMultipart(bodyRaw, boundary).map((part) => parseMimePart(part));
    parsed = { bodyTextCandidates: nested.flatMap((item) => item.bodyTextCandidates), attachments: nested.flatMap((item) => item.attachments) };
  } else {
    parsed = parseMimePart(`${headerText}\n\n${bodyRaw}`);
  }
  const bodyCandidate = parsed.bodyTextCandidates.sort((a, b) => a.priority - b.priority).find((item) => text(item.value));
  const from = parseAddress(headers.from);
  const to = parseAddress(headers.to);
  return {
    byteLength,
    messageId: text(headers['message-id']).replace(/^<|>$/g, '') || null,
    inReplyTo: text(headers['in-reply-to']).replace(/^<|>$/g, '') || null,
    references: text(headers.references).split(/\s+/).map((item) => item.replace(/^<|>$/g, '')).filter(Boolean),
    from,
    to,
    subject: text(headers.subject),
    sentAt: text(headers.date) || null,
    bodyText: text(bodyCandidate?.value),
    attachments: parsed.attachments,
    tradeProofHeaders: {
      caseId: text(headers['x-tradeproof-case-id']) || null,
      requestId: text(headers['x-tradeproof-request-id']) || null,
      candidateId: text(headers['x-tradeproof-candidate-id']) || null,
      outreachDraftId: text(headers['x-tradeproof-outreach-draft-id']) || null
    },
    boundaries: {
      senderIdentityVerified: false,
      attachmentContentRead: false,
      attachmentContentDecoded: false,
      externalNetworkAccessPerformed: false,
      automaticReplyPerformed: false,
      formalSubmissionPerformed: false
    }
  };
}

function containsToken(value, token) {
  return token && lower(value).includes(lower(token));
}

export function associateInboundMessage(parsed, context = {}) {
  const caseRecord = context.caseRecord ?? null;
  const request = context.request ?? null;
  const selectedCandidateIds = new Set(context.review?.selectedCandidateIds ?? []);
  const contacts = context.contactBook?.contacts ?? [];
  const candidates = context.collection?.candidates ?? [];
  const subjectAndBody = `${parsed.subject}\n${parsed.bodyText}`;
  const signals = [];

  const headerCaseMatch = parsed.tradeProofHeaders.caseId && parsed.tradeProofHeaders.caseId === caseRecord?.caseId;
  const headerRequestMatch = parsed.tradeProofHeaders.requestId && parsed.tradeProofHeaders.requestId === request?.requestId;
  const headerCandidateMatch = parsed.tradeProofHeaders.candidateId && selectedCandidateIds.has(parsed.tradeProofHeaders.candidateId);
  if (headerCaseMatch) signals.push('header_case_match');
  if (headerRequestMatch) signals.push('header_request_match');
  if (headerCandidateMatch) signals.push('header_candidate_match');

  const tokenCaseMatch = containsToken(subjectAndBody, caseRecord?.caseId) || containsToken(subjectAndBody, caseRecord?.sourceOpportunity?.recordId);
  const tokenRequestMatch = containsToken(subjectAndBody, request?.requestId);
  if (tokenCaseMatch) signals.push('content_case_reference_match');
  if (tokenRequestMatch) signals.push('content_request_reference_match');

  const contact = contacts.find((item) => lower(item.address) === parsed.from.address);
  if (contact) signals.push('holder_contact_address_match');
  const candidateId = parsed.tradeProofHeaders.candidateId && selectedCandidateIds.has(parsed.tradeProofHeaders.candidateId)
    ? parsed.tradeProofHeaders.candidateId
    : contact?.candidateId ?? null;
  const candidate = candidates.find((item) => item.candidateId === candidateId) ?? null;

  let associationState = 'unmatched_needs_review';
  if (headerCaseMatch && headerRequestMatch && headerCandidateMatch) associationState = 'header_bound_unverified';
  else if (headerCaseMatch || headerRequestMatch || tokenCaseMatch || tokenRequestMatch) associationState = 'request_reference_match_unverified';
  else if (contact) associationState = 'contact_address_match_unverified';

  return {
    associationState,
    caseId: headerCaseMatch || tokenCaseMatch || headerRequestMatch || tokenRequestMatch ? caseRecord?.caseId ?? null : null,
    requestId: headerRequestMatch || tokenRequestMatch ? request?.requestId ?? null : null,
    candidateId,
    candidateDisplayName: candidate?.displayName ?? null,
    signals: unique(signals),
    senderIdentityVerified: false,
    supplierIdentityVerified: false,
    humanReviewRequired: true
  };
}

export function extractInboundActionCandidates(parsed) {
  const body = lower(parsed.bodyText);
  const actions = [];
  const push = (actionType, label, reason) => actions.push({
    actionId: `inbound-action:${safeId(parsed.messageId || parsed.subject)}:${actionType}`,
    actionType,
    label,
    reason,
    state: 'candidate_unconfirmed',
    humanConfirmationRequired: true,
    externalActionPerformed: false
  });
  if (/attach|附件|certificate|证书|catalog|目录|quotation|报价/.test(body) || parsed.attachments.length) push('review_evidence_metadata', '检查邮件所述文件与附件元数据', '邮件或附件元数据显示可能包含目录、证书、报价或其他材料。');
  if (/cannot|unable|无法|不能|not available/.test(body)) push('review_capability_exception', '检查供应商声明的能力限制', '正文包含无法提供或能力受限的表述。');
  if (/need more time|extension|延期|延长|later/.test(body)) push('review_timeline_change', '检查时间或延期请求', '正文可能包含延期或时间调整请求。');
  if (/please confirm|请确认|could you confirm|need clarification|澄清/.test(body)) push('prepare_clarification_response', '准备澄清回复草稿', '对方请求确认或澄清；系统只生成待办，不自动回复。');
  if (/price|quotation|quote|usd|eur|cny|价格|报价/.test(body)) push('review_commercial_statement', '检查报价或商务条件', '正文可能包含价格、币种或商务条件。');
  if (!actions.length) push('review_inbound_message', '人工阅读新入站邮件', '未识别到有限规则覆盖的明确动作。');
  return actions;
}

export function detectStructuredResponseSignal(parsed) {
  const attachmentNames = parsed.attachments.map((item) => lower(item.fileName));
  const body = parsed.bodyText;
  const bodySignal = body.includes('tradeproof.supplier-response.v0.5') || /"schemaVersion"\s*:\s*"tradeproof\.supplier-response\.v0\.5"/.test(body);
  const attachmentSignal = attachmentNames.some((name) => name.endsWith('.json') && /response|supplier|tradeproof/.test(name));
  return {
    state: bodySignal ? 'body_contains_structured_response_candidate' : attachmentSignal ? 'attachment_metadata_suggests_structured_response' : 'no_structured_response_signal',
    bodySignal,
    attachmentSignal,
    attachmentContentRead: false,
    structuredResponseImported: false,
    formalSubmissionPerformed: false
  };
}

export function createInboundTimeline(caseRecord, at) {
  return {
    schemaVersion: INBOUND_TIMELINE_VERSION,
    caseId: caseRecord?.caseId ?? null,
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    events: [],
    state: 'holder_local_private',
    serverPersistencePerformed: false,
    externalNetworkAccessPerformed: false,
    automaticReplyPerformed: false,
    formalWritePerformed: false
  };
}

export function createInboundEvent(parsed, association, at) {
  const eventKey = parsed.messageId || `${parsed.from.address}|${parsed.subject}|${parsed.sentAt || ''}`;
  return {
    schemaVersion: INBOUND_EVENT_VERSION,
    eventId: `inbound-event:${safeId(eventKey)}`,
    messageId: parsed.messageId,
    inReplyTo: parsed.inReplyTo,
    references: parsed.references,
    observedAt: nowIso(at),
    sentAt: parsed.sentAt,
    direction: 'inbound',
    channel: 'email_file_import',
    state: 'holder_imported_unverified',
    evidenceClassification: 'inbound_email_unverified',
    from: { address: parsed.from.address, displayName: parsed.from.displayName, identityVerified: false },
    to: { address: parsed.to.address, displayName: parsed.to.displayName },
    subject: parsed.subject,
    bodyText: parsed.bodyText,
    attachments: clone(parsed.attachments),
    association: clone(association),
    actionCandidates: extractInboundActionCandidates(parsed),
    structuredResponseSignal: detectStructuredResponseSignal(parsed),
    boundaries: {
      senderIdentityVerified: false,
      supplierIdentityVerified: false,
      attachmentContentRead: false,
      attachmentContentDecoded: false,
      attachmentDownloaded: false,
      externalNetworkAccessPerformed: false,
      automaticReplyPerformed: false,
      deliveryReceiptVerified: false,
      formalSubmissionPerformed: false,
      quotationAccepted: false,
      contractCommitmentCreated: false
    }
  };
}

export function appendInboundEvent(timeline, event, at) {
  const next = clone(timeline);
  const duplicate = next.events.find((item) => item.eventId === event.eventId || (event.messageId && item.messageId === event.messageId));
  if (duplicate) return { timeline: next, added: false, duplicateEventId: duplicate.eventId };
  next.events.push(clone(event));
  next.updatedAt = nowIso(at);
  return { timeline: next, added: true, duplicateEventId: null };
}

export function validateInboundEvent(event) {
  const errors = [];
  if (event?.schemaVersion !== INBOUND_EVENT_VERSION) errors.push('unexpected inbound event schemaVersion');
  if (event?.state !== 'holder_imported_unverified') errors.push('event must remain holder_imported_unverified');
  if (event?.evidenceClassification !== 'inbound_email_unverified') errors.push('event classification changed');
  if (event?.association?.humanReviewRequired !== true) errors.push('human review must remain required');
  const boundaries = event?.boundaries ?? {};
  for (const key of ['senderIdentityVerified','supplierIdentityVerified','attachmentContentRead','attachmentContentDecoded','attachmentDownloaded','externalNetworkAccessPerformed','automaticReplyPerformed','deliveryReceiptVerified','formalSubmissionPerformed','quotationAccepted','contractCommitmentCreated']) {
    if (boundaries[key] !== false) errors.push(`${key} must remain false`);
  }
  for (const attachment of event?.attachments ?? []) {
    for (const key of ['contentRead','contentDecoded','contentUploaded','evidenceVerified']) if (attachment[key] !== false) errors.push(`attachment ${key} must remain false`);
  }
  return unique(errors);
}

export function validateInboundTimeline(timeline) {
  const errors = [];
  if (timeline?.schemaVersion !== INBOUND_TIMELINE_VERSION) errors.push('unexpected inbound timeline schemaVersion');
  if (timeline?.state !== 'holder_local_private') errors.push('timeline must remain holder_local_private');
  for (const key of ['serverPersistencePerformed','externalNetworkAccessPerformed','automaticReplyPerformed','formalWritePerformed']) if (timeline?.[key] !== false) errors.push(`${key} must remain false`);
  const ids = new Set();
  for (const event of timeline?.events ?? []) {
    errors.push(...validateInboundEvent(event));
    if (ids.has(event.eventId)) errors.push(`duplicate eventId: ${event.eventId}`);
    ids.add(event.eventId);
  }
  return unique(errors);
}

export function buildInboundWorkspaceModel({ caseRecord, request, review, collection, contactBook, timeline }) {
  const events = timeline?.events ?? [];
  return {
    schemaVersion: INBOUND_WORKSPACE_VERSION,
    caseId: caseRecord?.caseId ?? null,
    requestId: request?.requestId ?? null,
    selectedCandidates: (review?.selectedCandidateIds ?? []).length,
    knownContacts: (contactBook?.contacts ?? []).length,
    events: clone(events),
    counts: {
      inboundEvents: events.length,
      matchedToCandidate: events.filter((item) => item.association?.candidateId).length,
      unmatchedNeedsReview: events.filter((item) => item.association?.associationState === 'unmatched_needs_review').length,
      actionCandidates: events.flatMap((item) => item.actionCandidates ?? []).length,
      attachmentMetadata: events.flatMap((item) => item.attachments ?? []).length,
      structuredResponseSignals: events.filter((item) => item.structuredResponseSignal?.state !== 'no_structured_response_signal').length,
      verifiedSenders: 0,
      formalSubmissions: 0,
      automaticReplies: 0
    },
    boundaries: {
      senderIdentityVerified: false,
      attachmentContentRead: false,
      attachmentDownloaded: false,
      externalNetworkAccessPerformed: false,
      automaticReplyPerformed: false,
      responseAutoImported: false,
      formalSubmissionPerformed: false,
      rankingGenerated: false,
      supplierEligibilityDecided: false
    }
  };
}
