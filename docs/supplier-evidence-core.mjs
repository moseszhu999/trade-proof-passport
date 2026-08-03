export const SUPPLIER_EVIDENCE_ITEM_VERSION = 'tradeproof.supplier-evidence-item.v0.8';
export const SUPPLIER_EVIDENCE_QUEUE_VERSION = 'tradeproof.supplier-evidence-queue.v0.8';
export const SUPPLIER_EVIDENCE_WORKSPACE_VERSION = 'tradeproof.supplier-evidence-workspace.v0.8';
export const MAX_EVIDENCE_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TEXT_PARSE_BYTES = 2 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'xml', 'eml']);
const TEXT_MEDIA_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/xml', 'text/xml', 'message/rfc822']);
const FINDING_FIELDS = ['legal_entity', 'certificate_number', 'issuer', 'product_scope', 'valid_until'];
const text = (value) => String(value ?? '').trim();
const clone = (value) => structuredClone(value);
const nowIso = (value) => value ?? new Date().toISOString();
const normalizeName = (value) => text(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
const safeId = (value) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'evidence';

function extension(fileName) {
  const parts = text(fileName).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function isTextEligible(file) {
  return TEXT_EXTENSIONS.has(extension(file?.name)) || TEXT_MEDIA_TYPES.has(text(file?.type).toLowerCase());
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${hex(digest)}`;
}

function decodeUtf8(bytes) {
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (decoded.includes('\u0000')) throw new Error('text evidence contains NUL bytes');
  return decoded.replace(/\r\n?/g, '\n');
}

function firstMatch(content, patterns) {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      const value = text(match[1]).replace(/[\s,;]+$/, '').slice(0, 240);
      const lineStart = Math.max(0, content.lastIndexOf('\n', match.index) + 1);
      const lineEndRaw = content.indexOf('\n', match.index);
      const lineEnd = lineEndRaw === -1 ? content.length : lineEndRaw;
      return { value, excerpt: content.slice(lineStart, lineEnd).trim().slice(0, 320) };
    }
  }
  return null;
}

function extractFindings(content, evidenceId) {
  const patterns = {
    legal_entity: [/(?:legal\s+(?:entity|name)|company\s+name|registered\s+name|法定名称|公司名称|企业名称)\s*[:：]\s*([^\n]+)/i],
    certificate_number: [/(?:certificate\s*(?:no\.?|number)|cert\.?\s*no\.?|证书编号|认证编号)\s*[:：]\s*([^\n]+)/i],
    issuer: [/(?:issued\s+by|issuer|certification\s+body|notified\s+body|签发机构|认证机构)\s*[:：]\s*([^\n]+)/i],
    product_scope: [/(?:applicable\s+products?|product\s+scope|scope\s+of\s+certification|适用产品|认证范围|产品范围)\s*[:：]\s*([^\n]+)/i],
    valid_until: [/(?:valid\s+until|expiry\s+date|expiration\s+date|validity\s+end|有效期至|到期日期)\s*[:：]\s*([^\n]+)/i]
  };
  return FINDING_FIELDS.flatMap((field) => {
    const match = firstMatch(content, patterns[field]);
    if (!match) return [];
    return [{
      findingId: `${evidenceId}:finding:${field}`,
      field,
      value: match.value,
      excerpt: match.excerpt,
      state: 'candidate_unconfirmed',
      sourceConfirmed: false,
      evidenceVerified: false,
      externalVerificationPerformed: false,
      humanReviewRequired: true
    }];
  });
}

function documentTypeCandidate(fileName, content = '') {
  const sample = `${text(fileName)}\n${content.slice(0, 3000)}`.toLowerCase();
  if (/certificate|certification|iso\s*\d+|ce\s+(?:certificate|declaration)|证书|认证/.test(sample)) return 'certificate_candidate';
  if (/test\s+report|laboratory|检测报告|测试报告/.test(sample)) return 'test_report_candidate';
  if (/quotation|quote|price\s+list|报价/.test(sample)) return 'quotation_candidate';
  if (/catalog(?:ue)?|datasheet|product\s+specification|产品目录|规格书/.test(sample)) return 'product_document_candidate';
  if (/business\s+license|registration\s+certificate|营业执照|注册证书/.test(sample)) return 'company_identity_document_candidate';
  return 'unclassified_document_candidate';
}

function reviewTasksFor(item) {
  const tasks = [{
    taskId: `${item.evidenceId}:task:binding`,
    taskType: 'review_evidence_binding',
    state: 'candidate_unconfirmed',
    label: '确认文件是否属于当前供应商、问题和案件',
    humanConfirmationRequired: true,
    externalActionPerformed: false
  }];
  if (item.documentContentParsed) {
    for (const field of FINDING_FIELDS) {
      const finding = item.extractedFindings.find((entry) => entry.field === field);
      tasks.push({
        taskId: `${item.evidenceId}:task:${field}`,
        taskType: `review_${field}`,
        state: finding ? 'candidate_unconfirmed' : 'missing_candidate',
        label: finding ? `核对候选字段：${field}` : `文件中未提取到：${field}`,
        humanConfirmationRequired: true,
        externalActionPerformed: false
      });
    }
  } else {
    tasks.push({
      taskId: `${item.evidenceId}:task:manual-open`,
      taskType: 'manual_document_review_required',
      state: 'pending_manual_open',
      label: '二进制文件未解析，请人工打开并审查原文件',
      humanConfirmationRequired: true,
      externalActionPerformed: false
    });
  }
  if (item.sourceAttachmentRef && item.sourceAttachmentRef.fileNameMatch === false) {
    tasks.push({
      taskId: `${item.evidenceId}:task:attachment-name-mismatch`,
      taskType: 'review_attachment_name_mismatch',
      state: 'candidate_unconfirmed',
      label: '本地文件名与邮件附件元数据不一致，需要人工确认绑定',
      humanConfirmationRequired: true,
      externalActionPerformed: false
    });
  }
  return tasks;
}

export async function intakeSupplierEvidenceFile(file, binding, at) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('a browser File-like object is required');
  const candidateId = text(binding?.candidateId);
  const selectedCandidateIds = binding?.selectedCandidateIds ?? [];
  if (!candidateId || !selectedCandidateIds.includes(candidateId)) throw new Error('evidence candidate must be selected locally');
  if (!text(binding?.caseId)) throw new Error('caseId is required');
  if (!text(binding?.requestId)) throw new Error('requestId is required');
  const declaredSize = Number(file.size ?? 0);
  if (!Number.isFinite(declaredSize) || declaredSize < 0 || declaredSize > MAX_EVIDENCE_FILE_BYTES) throw new Error('evidence file exceeds size limit');

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_EVIDENCE_FILE_BYTES) throw new Error('evidence file exceeds size limit');
  const digest = await sha256(bytes);
  const evidenceId = `supplier-evidence:${safeId(candidateId)}:${digest.slice(7, 31)}`;
  const textEligible = isTextEligible(file) && bytes.byteLength <= MAX_TEXT_PARSE_BYTES;
  let content = '';
  let findings = [];
  if (textEligible) {
    content = decodeUtf8(bytes);
    if (extension(file.name) === 'json') JSON.parse(content);
    findings = extractFindings(content, evidenceId);
  }

  const attachment = binding?.sourceAttachment ?? null;
  const attachmentNameMatch = attachment ? normalizeName(attachment.fileName) === normalizeName(file.name) : null;
  const item = {
    schemaVersion: SUPPLIER_EVIDENCE_ITEM_VERSION,
    evidenceId,
    caseId: text(binding.caseId),
    requestId: text(binding.requestId),
    candidateId,
    questionId: text(binding?.questionId) || null,
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    state: textEligible ? 'text_candidates_pending_review' : 'metadata_only_pending_manual_review',
    evidenceClassification: 'holder_selected_local_file_unverified',
    source: {
      sourceType: 'holder_selected_local_file',
      fileName: text(file.name),
      mediaType: text(file.type) || 'application/octet-stream',
      size: bytes.byteLength,
      lastModified: Number(file.lastModified ?? 0) || null
    },
    sourceAttachmentRef: attachment ? {
      eventId: text(attachment.eventId) || null,
      attachmentIndex: Number.isInteger(attachment.attachmentIndex) ? attachment.attachmentIndex : null,
      observedFileName: text(attachment.fileName),
      observedMediaType: text(attachment.mediaType),
      fileNameMatch: attachmentNameMatch,
      attachmentContentRead: false,
      attachmentDownloaded: false
    } : null,
    contentDigest: digest,
    fileBytesHashedLocally: true,
    documentContentParsed: textEligible,
    fullContentStored: false,
    originalFileStored: false,
    textExcerptStored: findings.length > 0,
    documentTypeCandidate: documentTypeCandidate(file.name, content),
    extractedFindings: findings,
    reviewTasks: [],
    boundaries: {
      fileUploaded: false,
      serverPersistencePerformed: false,
      externalNetworkAccessPerformed: false,
      externalRegistryLookupPerformed: false,
      certificateValidityVerified: false,
      issuerVerified: false,
      supplierIdentityVerified: false,
      evidenceVerified: false,
      formalSubmissionPerformed: false,
      rankingGenerated: false,
      supplierEligibilityDecided: false
    }
  };
  item.reviewTasks = reviewTasksFor(item);
  return item;
}

export function decideEvidenceFinding(item, findingId, decision, at) {
  if (!['confirmed_in_local_file', 'excluded_by_holder'].includes(decision)) throw new Error('unsupported evidence finding decision');
  const next = clone(item);
  const finding = next.extractedFindings.find((entry) => entry.findingId === findingId);
  if (!finding) throw new Error('finding not found');
  finding.state = decision;
  finding.sourceConfirmed = decision === 'confirmed_in_local_file';
  finding.evidenceVerified = false;
  finding.externalVerificationPerformed = false;
  finding.decidedAt = nowIso(at);
  next.updatedAt = nowIso(at);
  next.state = next.extractedFindings.every((entry) => entry.state !== 'candidate_unconfirmed') ? 'source_fields_reviewed_unverified' : next.state;
  next.reviewTasks = next.reviewTasks.map((task) => task.taskId.endsWith(`:${finding.field}`) ? { ...task, state: decision, decidedAt: nowIso(at) } : task);
  return next;
}

export function createSupplierEvidenceQueue(caseRecord, request, selectedCandidateIds = [], at) {
  return {
    schemaVersion: SUPPLIER_EVIDENCE_QUEUE_VERSION,
    queueId: `supplier-evidence-queue:${safeId(caseRecord?.caseId)}`,
    caseId: caseRecord?.caseId ?? null,
    requestId: request?.requestId ?? null,
    selectedCandidateIds: [...new Set(selectedCandidateIds)],
    createdAt: nowIso(at),
    updatedAt: nowIso(at),
    state: 'holder_local_private',
    items: [],
    boundaries: {
      serverPersistencePerformed: false,
      externalVerificationPerformed: false,
      formalSubmissionPerformed: false,
      rankingGenerated: false,
      supplierEligibilityDecided: false
    }
  };
}

export function upsertSupplierEvidenceItem(queue, item, at) {
  const errors = validateSupplierEvidenceItem(item);
  if (errors.length) throw new Error(errors.join('; '));
  if (!(queue?.selectedCandidateIds ?? []).includes(item.candidateId)) throw new Error('evidence candidate is not selected in queue');
  const next = clone(queue);
  next.items = [...next.items.filter((entry) => entry.evidenceId !== item.evidenceId), clone(item)];
  next.updatedAt = nowIso(at);
  return next;
}

export function validateSupplierEvidenceItem(item) {
  const errors = [];
  if (item?.schemaVersion !== SUPPLIER_EVIDENCE_ITEM_VERSION) errors.push('unexpected evidence item schemaVersion');
  if (!text(item?.evidenceId) || !text(item?.caseId) || !text(item?.requestId) || !text(item?.candidateId)) errors.push('evidence binding identifiers are required');
  if (!/^sha256:[0-9a-f]{64}$/.test(text(item?.contentDigest))) errors.push('contentDigest must be sha256');
  if (item?.fileBytesHashedLocally !== true) errors.push('file bytes must be hashed locally');
  if (item?.fullContentStored !== false || item?.originalFileStored !== false) errors.push('original/full evidence content must not be stored');
  for (const key of ['fileUploaded', 'serverPersistencePerformed', 'externalNetworkAccessPerformed', 'externalRegistryLookupPerformed', 'certificateValidityVerified', 'issuerVerified', 'supplierIdentityVerified', 'evidenceVerified', 'formalSubmissionPerformed', 'rankingGenerated', 'supplierEligibilityDecided']) {
    if (item?.boundaries?.[key] !== false) errors.push(`${key} must remain false`);
  }
  for (const finding of item?.extractedFindings ?? []) {
    if (!FINDING_FIELDS.includes(finding.field)) errors.push(`unexpected finding field: ${finding.field}`);
    if (finding.evidenceVerified !== false || finding.externalVerificationPerformed !== false) errors.push(`finding verification boundary changed: ${finding.findingId}`);
  }
  if (item?.sourceAttachmentRef && (item.sourceAttachmentRef.attachmentContentRead !== false || item.sourceAttachmentRef.attachmentDownloaded !== false)) errors.push('source attachment must remain metadata-only');
  return errors;
}

export function validateSupplierEvidenceQueue(queue) {
  const errors = [];
  if (queue?.schemaVersion !== SUPPLIER_EVIDENCE_QUEUE_VERSION) errors.push('unexpected evidence queue schemaVersion');
  if (queue?.state !== 'holder_local_private') errors.push('evidence queue must remain holder_local_private');
  for (const key of ['serverPersistencePerformed', 'externalVerificationPerformed', 'formalSubmissionPerformed', 'rankingGenerated', 'supplierEligibilityDecided']) if (queue?.boundaries?.[key] !== false) errors.push(`${key} must remain false`);
  const allowed = new Set(queue?.selectedCandidateIds ?? []);
  const ids = new Set();
  for (const item of queue?.items ?? []) {
    for (const error of validateSupplierEvidenceItem(item)) errors.push(`${item?.evidenceId}: ${error}`);
    if (!allowed.has(item.candidateId)) errors.push(`evidence candidate not selected: ${item.candidateId}`);
    if (ids.has(item.evidenceId)) errors.push(`duplicate evidenceId: ${item.evidenceId}`);
    ids.add(item.evidenceId);
  }
  return errors;
}

export function buildSupplierEvidenceWorkspaceModel({ caseRecord, request, review, queue, timeline }) {
  const items = queue?.items ?? [];
  const pendingFindings = items.flatMap((item) => item.extractedFindings).filter((finding) => finding.state === 'candidate_unconfirmed').length;
  const pendingTasks = items.flatMap((item) => item.reviewTasks).filter((task) => !['confirmed_in_local_file', 'excluded_by_holder'].includes(task.state)).length;
  const attachmentMetadata = (timeline?.events ?? []).flatMap((event) => (event.attachments ?? []).map((attachment, attachmentIndex) => ({
    eventId: event.eventId,
    candidateId: event.association?.candidateId ?? null,
    attachmentIndex,
    fileName: attachment.fileName,
    mediaType: attachment.mediaType,
    contentRead: false,
    contentDownloaded: false
  })));
  return {
    schemaVersion: SUPPLIER_EVIDENCE_WORKSPACE_VERSION,
    state: 'holder_local_private',
    caseId: caseRecord?.caseId ?? null,
    requestId: request?.requestId ?? null,
    selectedCandidateIds: review?.selectedCandidateIds ?? [],
    items,
    attachmentMetadata,
    counts: {
      evidenceItems: items.length,
      textParsedItems: items.filter((item) => item.documentContentParsed).length,
      metadataOnlyItems: items.filter((item) => !item.documentContentParsed).length,
      pendingFindings,
      pendingTasks,
      verifiedEvidence: 0,
      externalVerificationChecks: 0,
      formalSubmissions: 0
    },
    boundaries: {
      originalFileStored: false,
      fileUploaded: false,
      externalVerificationPerformed: false,
      certificateValidityVerified: false,
      issuerVerified: false,
      supplierIdentityVerified: false,
      evidenceVerified: false,
      formalSubmissionPerformed: false,
      rankingGenerated: false,
      supplierEligibilityDecided: false
    }
  };
}
