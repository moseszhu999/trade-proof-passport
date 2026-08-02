import {
  exportTradeCase,
  importTradeCase,
  validateTradeCase
} from './trade-case-core.mjs';
import {
  LOCAL_DOCUMENT_INTAKE_VERSION,
  classifyLocalDocument,
  ingestLocalDocument
} from './local-document-intake.mjs';

const CASE_STORAGE_KEY = 'tradeproof.trade.case.v0.2';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function byteLabel(value) {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function classificationClass(state) {
  if (state === 'readable_local_text') return 'is-readable';
  if (state === 'metadata_only_unsupported_format') return 'is-metadata';
  if (state?.startsWith('blocked_')) return 'is-blocked';
  return '';
}

async function readStoredCase() {
  const raw = localStorage.getItem(CASE_STORAGE_KEY);
  if (!raw) return { caseRecord: null, errors: [] };
  try {
    const parsed = JSON.parse(raw);
    const errors = await validateTradeCase(parsed);
    return { caseRecord: errors.length ? null : parsed, errors };
  } catch (error) {
    return { caseRecord: null, errors: [`stored case parse failed: ${error.message}`] };
  }
}

function saveStoredCase(caseRecord) {
  localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(caseRecord));
}

function caseSummary(caseRecord, errors = []) {
  if (errors.length) {
    return `<div class="empty"><strong class="error">本地案件无效</strong><span>${escapeHtml(errors.join(' · '))}</span><p>请从今日运营重新建立案件，或导入一份 digest 有效的 Trade Case JSON。</p></div>`;
  }
  if (!caseRecord) {
    return `<div class="empty"><strong>尚无本地 Trade Case</strong><span>先去“今日运营”选择一条机会建立案件，或在页面顶部导入案件 JSON。</span><p><a href="./operations.html">打开今日运营</a></p></div>`;
  }
  const pending = (caseRecord.requirementCandidates ?? []).filter((item) => item.humanConfirmationRequired).length;
  return `<article class="case-summary">
    <header><strong>${escapeHtml(caseRecord.title)}</strong><span class="state is-ready">holder controlled</span></header>
    <dl>
      <div><dt>Case ID</dt><dd>${escapeHtml(caseRecord.caseId)}</dd></div>
      <div><dt>来源机会</dt><dd>${escapeHtml(caseRecord.sourceOpportunity?.recordId)}</dd></div>
      <div><dt>当前阶段</dt><dd>${escapeHtml(caseRecord.stage)}</dd></div>
      <div><dt>文本输入</dt><dd>${caseRecord.communications?.length ?? 0}</dd></div>
      <div><dt>文件记录</dt><dd>${caseRecord.fileReferences?.length ?? 0}</dd></div>
      <div><dt>待确认要求</dt><dd>${pending}</dd></div>
    </dl>
    <p class="notice">当前案件仅保存在本浏览器；处理完成后建议导出 JSON 备份。</p>
  </article>`;
}

function fileHistory(caseRecord) {
  const files = [...(caseRecord?.fileReferences ?? [])].reverse().slice(0, 12);
  if (!files.length) return '<div class="empty">当前案件尚无文件记录。</div>';
  return `<div class="file-list">${files.map((file) => {
    const readLocally = file.adapterContentReadLocally === true;
    const state = file.adapterState ?? 'metadata_only';
    return `<article class="file-card">
      <header><strong>${escapeHtml(file.name)}</strong><span class="state ${readLocally ? 'is-readable' : 'is-metadata'}">${escapeHtml(state)}</span></header>
      <p>${escapeHtml(file.mimeType)} · ${byteLabel(file.size)}</p>
      <small>本地读取=${readLocally} · 上传=${file.uploaded === true} · 二进制解析=${file.binaryDocumentParsingPerformed === true}</small>
      ${file.sourceContentDigest ? `<p><code>${escapeHtml(file.sourceContentDigest)}</code></p>` : ''}
      ${file.adapterReason ? `<p>${escapeHtml(file.adapterReason)}</p>` : ''}
    </article>`;
  }).join('')}</div>`;
}

function renderResult(result) {
  if (!result) return '<div class="empty">尚未处理文件。</div>';
  const readLocally = result.readable === true;
  return `<article class="result-card">
    <header><strong>${escapeHtml(result.name)}</strong><span class="state ${readLocally ? 'is-readable' : 'is-metadata'}">${escapeHtml(result.state)}</span></header>
    <dl>
      <div><dt>处理类型</dt><dd>${escapeHtml(result.kind ?? 'metadata_only')}</dd></div>
      <div><dt>新增候选要求</dt><dd>${result.requirementCandidateCount ?? 0}</dd></div>
      <div><dt>新增沟通待办</dt><dd>${result.actionCandidateCount ?? 0}</dd></div>
      <div><dt>本地读取</dt><dd>${readLocally}</dd></div>
      <div><dt>上传</dt><dd>${result.uploaded === true}</dd></div>
      <div><dt>正式写入</dt><dd>${result.formalWritePerformed === true}</dd></div>
    </dl>
    ${result.sourceContentDigest ? `<p>原始文本 digest：<code>${escapeHtml(result.sourceContentDigest)}</code></p>` : ''}
    ${result.truncated ? '<p class="notice">文件文本超过案件存储上限，案件仅保留前 120,000 个字符；digest 仍对应完整原始文本。</p>' : ''}
    ${result.reason ? `<p>${escapeHtml(result.reason)}</p>` : ''}
  </article>`;
}

async function boot() {
  const status = document.querySelector('[data-page-status]');
  const caseRoot = document.querySelector('#case-state');
  const historyRoot = document.querySelector('#file-history');
  const resultRoot = document.querySelector('#intake-result');
  const form = document.querySelector('#document-intake-form');
  const fileInput = document.querySelector('#document-file');
  const classificationState = document.querySelector('#classification-state');
  const classificationDetail = document.querySelector('#classification-detail');
  const processButton = document.querySelector('#process-document');
  const importInput = document.querySelector('#case-import-file');
  const exportButton = document.querySelector('#export-case');

  let { caseRecord, errors } = await readStoredCase();
  let selectedFile = null;
  let latestResult = null;

  const render = () => {
    caseRoot.innerHTML = caseSummary(caseRecord, errors);
    historyRoot.innerHTML = fileHistory(caseRecord);
    resultRoot.innerHTML = renderResult(latestResult);
    processButton.disabled = !caseRecord || !selectedFile;
    exportButton.disabled = !caseRecord;
    if (status) {
      status.textContent = caseRecord
        ? `${caseRecord.sourceOpportunity?.recordId ?? '案件'} · 本地文件解析已就绪`
        : errors.length ? '本地案件无效' : '等待建立或导入 Trade Case';
    }
  };

  const renderClassification = () => {
    if (!selectedFile) {
      classificationState.className = 'state';
      classificationState.textContent = '等待文件';
      classificationDetail.textContent = '尚未选择文件。';
      render();
      return;
    }
    const classification = classifyLocalDocument(selectedFile);
    classificationState.className = `state ${classificationClass(classification.state)}`;
    classificationState.textContent = classification.state;
    classificationDetail.innerHTML = `<strong>${escapeHtml(classification.name)}</strong><br>
      ${escapeHtml(classification.mimeType)} · ${byteLabel(classification.size)}<br>
      ${classification.readable
        ? '允许在当前浏览器读取文本；不会上传。'
        : `不会读取内容，只登记元数据。${classification.reason ? ` 原因：${escapeHtml(classification.reason)}` : ''}`}`;
    render();
  };

  fileInput?.addEventListener('change', () => {
    selectedFile = fileInput.files?.[0] ?? null;
    latestResult = null;
    renderClassification();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!caseRecord || !selectedFile) return;
    processButton.disabled = true;
    if (status) status.textContent = `正在本地处理 ${selectedFile.name}`;
    const data = new FormData(form);
    const requestedKind = data.get('kind');
    const options = {
      title: data.get('title') || selectedFile.name,
      kind: requestedKind === 'auto' ? undefined : requestedKind
    };
    try {
      const outcome = await ingestLocalDocument(caseRecord, selectedFile, options);
      caseRecord = outcome.caseRecord;
      errors = await validateTradeCase(caseRecord);
      if (errors.length) throw new Error(errors.join(' · '));
      saveStoredCase(caseRecord);
      latestResult = outcome.result;
      if (status) status.textContent = `${selectedFile.name} 已写回本地案件`;
    } catch (error) {
      latestResult = {
        name: selectedFile.name,
        state: 'processing_error',
        readable: false,
        uploaded: false,
        formalWritePerformed: false,
        requirementCandidateCount: 0,
        actionCandidateCount: 0,
        reason: error.message
      };
      if (status) status.textContent = `处理失败：${error.message}`;
    }
    render();
  });

  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      caseRecord = await importTradeCase(await file.text());
      errors = [];
      saveStoredCase(caseRecord);
      latestResult = null;
      selectedFile = null;
      form.reset();
      renderClassification();
    } catch (error) {
      errors = [error.message];
      caseRecord = null;
      render();
    }
  });

  exportButton?.addEventListener('click', async () => {
    if (!caseRecord) return;
    const serialized = await exportTradeCase(caseRecord);
    const safeId = caseRecord.caseId.replace(/[^a-z0-9_-]+/gi, '-');
    downloadText(`${safeId}.json`, serialized);
  });

  render();
}

if (typeof document !== 'undefined') void boot();

export const localDocumentIntakeUiContract = Object.freeze({
  adapterVersion: LOCAL_DOCUMENT_INTAKE_VERSION,
  caseStorageKey: CASE_STORAGE_KEY,
  serverPersistence: false,
  fileUploaded: false,
  binaryDocumentParsingPerformed: false,
  formalWritePerformed: false
});
