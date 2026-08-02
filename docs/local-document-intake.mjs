import {
  addFileMetadata,
  ingestText,
  sealTradeCase,
  sha256Text
} from './trade-case-core.mjs';

export const LOCAL_DOCUMENT_INTAKE_VERSION = 'tradeproof.local-document-intake.v0.3';
export const MAX_LOCAL_TEXT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_STORED_TEXT_CHARACTERS = 120000;

const READABLE_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'eml', 'xml']);
const READABLE_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'message/rfc822',
  'application/xml',
  'text/xml'
]);

function clone(value) {
  return structuredClone(value);
}

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function fileExtension(name) {
  const match = safeText(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+$/gm, '')
    .trim();
}

function parseEml(text) {
  const normalized = normalizeText(text);
  const separator = normalized.search(/\n\n/);
  if (separator < 0) return { text: normalized, headers: {} };
  const headerText = normalized.slice(0, separator).replace(/\n[ \t]+/g, ' ');
  const body = normalized.slice(separator + 2).trim();
  const headers = {};
  for (const line of headerText.split('\n')) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    if (['subject', 'date', 'from', 'to', 'cc', 'message-id'].includes(key)) {
      headers[key] = match[2].trim().slice(0, 1000);
    }
  }
  const headerSummary = [
    headers.subject ? `Subject: ${headers.subject}` : null,
    headers.date ? `Date: ${headers.date}` : null,
    headers.from ? `From: ${headers.from}` : null,
    headers.to ? `To: ${headers.to}` : null
  ].filter(Boolean).join('\n');
  return {
    text: [headerSummary, body].filter(Boolean).join('\n\n'),
    headers
  };
}

export function classifyLocalDocument(file) {
  const name = safeText(file?.name, 'unnamed-file');
  const mimeType = safeText(file?.type, 'application/octet-stream').toLowerCase();
  const extension = fileExtension(name);
  const size = Number.isFinite(Number(file?.size)) ? Number(file.size) : 0;
  const extensionAllowed = READABLE_EXTENSIONS.has(extension);
  const mimeAllowed = READABLE_MIME_TYPES.has(mimeType);

  if (size > MAX_LOCAL_TEXT_FILE_BYTES) {
    return {
      state: 'blocked_too_large',
      readable: false,
      metadataOnly: true,
      reason: `file exceeds ${MAX_LOCAL_TEXT_FILE_BYTES} bytes`,
      name,
      mimeType,
      extension,
      size
    };
  }
  if (!extensionAllowed && !mimeAllowed) {
    return {
      state: 'metadata_only_unsupported_format',
      readable: false,
      metadataOnly: true,
      reason: 'format is not in the local text allowlist',
      name,
      mimeType,
      extension,
      size
    };
  }
  if (typeof file?.text !== 'function') {
    return {
      state: 'blocked_missing_text_reader',
      readable: false,
      metadataOnly: true,
      reason: 'file object does not expose a text reader',
      name,
      mimeType,
      extension,
      size
    };
  }
  return {
    state: 'readable_local_text',
    readable: true,
    metadataOnly: false,
    reason: null,
    name,
    mimeType,
    extension,
    size,
    recommendedKind: extension === 'eml' || mimeType === 'message/rfc822'
      ? 'email_or_message_text'
      : 'official_notice_text'
  };
}

function validateReadableText(text, classification) {
  if (!text) throw new Error('Local document is empty.');
  if (text.includes('\u0000')) throw new Error('Binary-looking content is not accepted as local text.');
  if (classification.extension === 'json' || classification.mimeType === 'application/json') {
    try {
      JSON.parse(text);
    } catch {
      throw new Error('JSON document is not valid JSON.');
    }
  }
}

export async function ingestLocalDocument(caseRecord, file, options = {}, now = new Date()) {
  if (!caseRecord?.caseId) throw new Error('A holder-controlled Trade Case is required.');
  const classification = classifyLocalDocument(file);

  if (!classification.readable) {
    const metadataCase = await addFileMetadata(caseRecord, [file], now);
    const next = clone(metadataCase);
    const latest = next.fileReferences.at(-1);
    if (latest) {
      latest.adapterVersion = LOCAL_DOCUMENT_INTAKE_VERSION;
      latest.adapterState = classification.state;
      latest.adapterContentReadLocally = false;
      latest.adapterReason = classification.reason;
      latest.binaryDocumentParsingPerformed = false;
    }
    next.boundaries = {
      ...next.boundaries,
      localTextAdapterUsed: true,
      localTextAdapterReadPerformed: false,
      binaryDocumentParsingPerformed: false,
      fileUploaded: false
    };
    return {
      caseRecord: await sealTradeCase(next),
      result: {
        ...classification,
        formalWritePerformed: false,
        uploaded: false,
        requirementCandidateCount: 0,
        actionCandidateCount: 0
      }
    };
  }

  const rawText = normalizeText(await file.text());
  validateReadableText(rawText, classification);
  const sourceContentDigest = await sha256Text(rawText);
  const truncated = rawText.length > MAX_STORED_TEXT_CHARACTERS;
  const storedText = rawText.slice(0, MAX_STORED_TEXT_CHARACTERS);
  const eml = classification.extension === 'eml' || classification.mimeType === 'message/rfc822'
    ? parseEml(storedText)
    : { text: storedText, headers: {} };
  const requestedKind = options.kind;
  const kind = ['official_notice_text', 'email_or_message_text'].includes(requestedKind)
    ? requestedKind
    : classification.recommendedKind;
  const title = safeText(options.title, classification.name);

  let next = await ingestText(caseRecord, {
    kind,
    title,
    text: eml.text
  }, now);
  const beforeRequirementCount = caseRecord.requirementCandidates?.length ?? 0;
  const beforeActionCount = (caseRecord.communications ?? [])
    .flatMap((item) => item.actionCandidates ?? []).length;

  next = await addFileMetadata(next, [file], now);
  const enriched = clone(next);
  const intake = enriched.communications.find((item) => item.textDigest === await sha256Text(eml.text));
  if (intake) {
    intake.sourceMethod = 'holder_authorized_local_text_file';
    intake.sourceFile = {
      name: classification.name,
      mimeType: classification.mimeType,
      extension: classification.extension,
      size: classification.size,
      lastModified: Number.isFinite(Number(file?.lastModified)) ? Number(file.lastModified) : null,
      sourceContentDigest,
      adapterVersion: LOCAL_DOCUMENT_INTAKE_VERSION,
      adapterContentReadLocally: true,
      contentStoredInCase: true,
      uploaded: false,
      truncated,
      emlHeadersPresent: Object.keys(eml.headers).length > 0
    };
  }
  const latestFile = enriched.fileReferences.at(-1);
  if (latestFile) {
    latestFile.adapterVersion = LOCAL_DOCUMENT_INTAKE_VERSION;
    latestFile.adapterState = 'readable_local_text';
    latestFile.adapterContentReadLocally = true;
    latestFile.sourceContentDigest = sourceContentDigest;
    latestFile.contentStoredAsTextIntake = true;
    latestFile.binaryDocumentParsingPerformed = false;
  }
  enriched.boundaries = {
    ...enriched.boundaries,
    localTextAdapterUsed: true,
    localTextAdapterReadPerformed: true,
    binaryDocumentParsingPerformed: false,
    fileUploaded: false
  };
  const sealed = await sealTradeCase(enriched);
  const afterRequirementCount = sealed.requirementCandidates?.length ?? 0;
  const afterActionCount = (sealed.communications ?? [])
    .flatMap((item) => item.actionCandidates ?? []).length;

  return {
    caseRecord: sealed,
    result: {
      ...classification,
      kind,
      sourceContentDigest,
      truncated,
      formalWritePerformed: false,
      uploaded: false,
      requirementCandidateCount: Math.max(0, afterRequirementCount - beforeRequirementCount),
      actionCandidateCount: Math.max(0, afterActionCount - beforeActionCount)
    }
  };
}
