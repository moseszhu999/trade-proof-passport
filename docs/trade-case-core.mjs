const CASE_SCHEMA_VERSION = 'tradeproof.trade-case.v0.2';
const MAX_TEXT_LENGTH = 120000;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Text(text) {
  const bytes = new TextEncoder().encode(String(text));
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return `sha256:${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }
  const { createHash } = await import('node:crypto');
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function cleanText(value, max = MAX_TEXT_LENGTH) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').trim().slice(0, max);
}

function safeTitle(value, fallback) {
  const text = cleanText(value, 240);
  return text || fallback;
}

function clone(value) {
  return structuredClone(value);
}

function unsignedCase(caseRecord) {
  const { caseDigest, ...unsigned } = caseRecord;
  return unsigned;
}

export async function sealTradeCase(caseRecord) {
  const next = clone(caseRecord);
  next.updatedAt = next.updatedAt || new Date().toISOString();
  next.caseDigest = await sha256Text(canonicalJson(unsignedCase(next)));
  return next;
}

export async function createTradeCase(opportunity, now = new Date()) {
  if (!opportunity?.opportunityId || !opportunity?.source?.recordId) {
    throw new Error('A canonical Opportunity with source record is required.');
  }
  const createdAt = now.toISOString();
  return sealTradeCase({
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId: `trade-case:${opportunity.source.sourceId}:${opportunity.source.recordId}`,
    title: opportunity.title,
    stage: 'qualification_review',
    state: 'holder_controlled_draft',
    createdAt,
    updatedAt: createdAt,
    formalWritePerformed: false,
    sourceOpportunity: {
      opportunityId: opportunity.opportunityId,
      sourceId: opportunity.source.sourceId,
      recordId: opportunity.source.recordId,
      url: opportunity.source.url,
      opportunityDigest: opportunity.opportunityDigest,
      buyerName: opportunity.buyer?.name ?? null,
      buyerCountry: opportunity.buyer?.country ?? null,
      deadlineAt: opportunity.dates?.deadlineAt ?? null,
      classificationCodes: opportunity.classification?.codes ?? []
    },
    requirementCandidates: [],
    communications: [],
    fileReferences: [],
    decisions: [],
    nextActions: [
      '打开官方通知并导入需要审查的正文或摘要',
      '逐项确认候选要求是否确实来自正式来源',
      '判断直接参与、联合体、分包或不适用',
      '记录缺失材料、负责人和截止日期'
    ],
    boundaries: {
      holderControlled: true,
      serverPersistence: false,
      externalMessageSent: false,
      fileContentRead: false,
      buyerIdentityVerified: false,
      supplierEligibilityDecided: false
    }
  });
}

const REQUIREMENT_RULES = [
  { category: 'deadline', label: '截止与提交时间', pattern: /(deadline|closing date|submission date|tender date|截止|提交时间|closing time|date limite|frist)/i },
  { category: 'eligibility', label: '参与资格与主体要求', pattern: /(eligib|qualification|economic operator|legal entity|consortium|joint venture|subcontract|资格|资质|联合体|分包|suitability)/i },
  { category: 'technical', label: '技术、规格与标准', pattern: /(technical|specification|standard|DIN\s*\d+|ISO\s*\d+|EN\s*\d+|规格|技术|标准|material|dimension)/i },
  { category: 'quantity', label: '数量、范围与批次', pattern: /(quantity|volume|lot\b|lots\b|scope|数量|批次|范围|units|pieces|pairs)/i },
  { category: 'delivery', label: '交付、安装与履约地点', pattern: /(delivery|deliver|installation|site|place of performance|交付|安装|履约|运输|incoterm)/i },
  { category: 'evidence', label: '证书、证明与历史业绩', pattern: /(certificate|certification|evidence|reference project|experience|turnover|证书|证明|业绩|audit report|declaration)/i },
  { category: 'commercial', label: '报价、保证与商务条件', pattern: /(price|pricing|quotation|guarantee|bond|insurance|payment|报价|价格|保证金|保险|付款)/i },
  { category: 'sample_quality', label: '样品、测试与质量', pattern: /(sample|test report|inspection|quality|acceptance|样品|测试|质检|质量|验收)/i },
  { category: 'communication', label: '澄清、回复与联系人动作', pattern: /(reply|respond|clarification|contact|meeting|回复|澄清|联系|会议|confirm)/i }
];

function sourceSegments(text) {
  return cleanText(text)
    .split(/\n{2,}|(?<=[。！？.!?;；])\s+/)
    .map((segment) => cleanText(segment, 900))
    .filter((segment) => segment.length >= 8)
    .slice(0, 240);
}

export function extractRequirementCandidates(text, intakeId) {
  const results = [];
  const seen = new Set();
  for (const segment of sourceSegments(text)) {
    for (const rule of REQUIREMENT_RULES) {
      if (!rule.pattern.test(segment)) continue;
      const key = `${rule.category}:${segment.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        requirementId: `${intakeId}:requirement:${results.length + 1}`,
        category: rule.category,
        label: rule.label,
        excerpt: segment,
        status: 'candidate_unconfirmed',
        evidenceClassification: 'holder_supplied_source_text',
        officialRequirement: false,
        humanConfirmationRequired: true,
        sourceIntakeId: intakeId,
        confirmedAt: null,
        rejectedAt: null
      });
    }
  }
  return results.slice(0, 80);
}

function actionCandidates(text, intakeId) {
  const segments = sourceSegments(text);
  const actions = [];
  const actionPattern = /(please|kindly|need to|must|shall|reply|respond|confirm|send|provide|submit|请|需要|必须|回复|确认|发送|提供|提交)/i;
  for (const segment of segments) {
    if (!actionPattern.test(segment)) continue;
    actions.push({
      actionId: `${intakeId}:action:${actions.length + 1}`,
      summary: segment,
      status: 'candidate_unconfirmed',
      evidenceClassification: 'holder_supplied_communication',
      humanConfirmationRequired: true
    });
  }
  return actions.slice(0, 40);
}

export async function ingestText(caseRecord, input, now = new Date()) {
  const kind = input?.kind === 'official_notice_text' ? 'official_notice_text' : 'email_or_message_text';
  const text = cleanText(input?.text);
  if (!text) throw new Error('Text intake is empty.');
  const observedAt = now.toISOString();
  const textDigest = await sha256Text(text);
  const intakeId = `intake:${kind}:${textDigest.slice(7, 23)}`;
  const intake = {
    intakeId,
    kind,
    title: safeTitle(input?.title, kind === 'official_notice_text' ? '正式通知文本' : '邮件或消息文本'),
    observedAt,
    text,
    textDigest,
    storage: 'holder_local_browser',
    uploaded: false,
    externalMessageSent: false,
    personalDataReviewRequired: kind === 'email_or_message_text'
  };
  const next = clone(caseRecord);
  next.updatedAt = observedAt;
  next.communications = [...(next.communications ?? []).filter((item) => item.intakeId !== intakeId), intake];
  if (kind === 'official_notice_text') {
    const candidates = extractRequirementCandidates(text, intakeId);
    const other = (next.requirementCandidates ?? []).filter((item) => item.sourceIntakeId !== intakeId);
    next.requirementCandidates = [...other, ...candidates];
  } else {
    intake.actionCandidates = actionCandidates(text, intakeId);
  }
  return sealTradeCase(next);
}

export async function addFileMetadata(caseRecord, files, now = new Date()) {
  const normalized = [...(files ?? [])].map((file, index) => ({
    fileRefId: `file-ref:${now.valueOf()}:${index + 1}`,
    name: safeTitle(file?.name, `file-${index + 1}`),
    mimeType: safeTitle(file?.type, 'application/octet-stream'),
    size: Number.isFinite(Number(file?.size)) ? Number(file.size) : 0,
    lastModified: Number.isFinite(Number(file?.lastModified)) ? Number(file.lastModified) : null,
    contentRead: false,
    uploaded: false,
    storage: 'holder_local_reference',
    evidenceClassification: 'file_metadata_only'
  }));
  if (!normalized.length) throw new Error('No file metadata supplied.');
  const next = clone(caseRecord);
  next.updatedAt = now.toISOString();
  next.fileReferences = [...(next.fileReferences ?? []), ...normalized];
  return sealTradeCase(next);
}

export async function decideRequirement(caseRecord, requirementId, decision, now = new Date()) {
  if (!['confirm_source_requirement', 'reject_candidate'].includes(decision)) {
    throw new Error('Unsupported requirement decision.');
  }
  const next = clone(caseRecord);
  const item = next.requirementCandidates?.find((candidate) => candidate.requirementId === requirementId);
  if (!item) throw new Error('Requirement candidate not found.');
  if (decision === 'confirm_source_requirement') {
    item.status = 'confirmed_in_supplied_source';
    item.officialRequirement = true;
    item.humanConfirmationRequired = false;
    item.confirmedAt = now.toISOString();
  } else {
    item.status = 'rejected_candidate';
    item.officialRequirement = false;
    item.humanConfirmationRequired = false;
    item.rejectedAt = now.toISOString();
  }
  next.updatedAt = now.toISOString();
  next.decisions = [...(next.decisions ?? []), {
    decisionId: `decision:${requirementId}:${now.valueOf()}`,
    requirementId,
    decision,
    decidedAt: now.toISOString(),
    principalClass: 'holder_human',
    formalTradeDecision: false
  }];
  return sealTradeCase(next);
}

export function caseActionQueue(caseRecord) {
  if (!caseRecord) return [];
  const items = [];
  const pendingRequirements = (caseRecord.requirementCandidates ?? []).filter((item) => item.humanConfirmationRequired);
  for (const requirement of pendingRequirements) {
    items.push({
      id: `review:${requirement.requirementId}`,
      kind: 'requirement_confirmation',
      title: `确认候选要求：${requirement.label}`,
      status: 'waiting_confirmation',
      dueLabel: '今天',
      evidenceClassification: requirement.evidenceClassification,
      formalWritePerformed: false
    });
  }
  for (const intake of caseRecord.communications ?? []) {
    for (const action of intake.actionCandidates ?? []) {
      items.push({
        id: `review:${action.actionId}`,
        kind: 'communication_action_review',
        title: `确认沟通待办：${action.summary.slice(0, 90)}`,
        status: 'waiting_confirmation',
        dueLabel: '今天',
        evidenceClassification: action.evidenceClassification,
        formalWritePerformed: false
      });
    }
  }
  if (!(caseRecord.communications ?? []).some((item) => item.kind === 'official_notice_text')) {
    items.unshift({
      id: `notice-intake:${caseRecord.caseId}`,
      kind: 'official_notice_intake',
      title: '导入正式通知正文或关键段落',
      status: 'open',
      dueLabel: '下一步',
      evidenceClassification: 'missing_source_text',
      formalWritePerformed: false
    });
  }
  return items.slice(0, 100);
}

export async function exportTradeCase(caseRecord) {
  const sealed = await sealTradeCase({ ...clone(caseRecord), updatedAt: caseRecord.updatedAt });
  return `${JSON.stringify(canonicalize(sealed), null, 2)}\n`;
}

export async function validateTradeCase(caseRecord) {
  const errors = [];
  if (!isObject(caseRecord)) return ['case must be an object'];
  if (caseRecord.schemaVersion !== CASE_SCHEMA_VERSION) errors.push('unexpected schemaVersion');
  if (!String(caseRecord.caseId ?? '').startsWith('trade-case:')) errors.push('invalid caseId');
  if (caseRecord.formalWritePerformed !== false) errors.push('formalWritePerformed must remain false');
  if (caseRecord.boundaries?.serverPersistence !== false) errors.push('serverPersistence must remain false');
  if (caseRecord.boundaries?.externalMessageSent !== false) errors.push('externalMessageSent must remain false');
  if ((caseRecord.fileReferences ?? []).some((file) => file.contentRead !== false || file.uploaded !== false)) {
    errors.push('file references must remain metadata-only');
  }
  if ((caseRecord.requirementCandidates ?? []).some((item) => item.officialRequirement && item.status !== 'confirmed_in_supplied_source')) {
    errors.push('officialRequirement requires holder confirmation');
  }
  if (caseRecord.caseDigest) {
    const expected = await sha256Text(canonicalJson(unsignedCase(caseRecord)));
    if (expected !== caseRecord.caseDigest) errors.push('caseDigest mismatch');
  } else {
    errors.push('caseDigest missing');
  }
  return errors;
}

export async function importTradeCase(text) {
  const parsed = JSON.parse(String(text));
  const errors = await validateTradeCase(parsed);
  if (errors.length) throw new Error(`Invalid Trade Case: ${errors.join('; ')}`);
  return parsed;
}

export function upgradeLegacyCase(legacyCase, opportunity = null) {
  if (!legacyCase || legacyCase.schemaVersion === CASE_SCHEMA_VERSION) return legacyCase;
  if (legacyCase.state !== 'local_draft') return null;
  return { legacyCase, opportunity };
}

export { CASE_SCHEMA_VERSION };
