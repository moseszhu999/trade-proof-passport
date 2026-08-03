import {
  MAX_EVIDENCE_FILE_BYTES, buildSupplierEvidenceWorkspaceModel, createSupplierEvidenceQueue,
  decideEvidenceFinding, intakeSupplierEvidenceFile, upsertSupplierEvidenceItem,
  validateSupplierEvidenceItem, validateSupplierEvidenceQueue
} from './supplier-evidence-core.mjs';

const KEYS = {
  caseRecord: 'tradeproof.trade.case.v0.2',
  review: 'tradeproof.supplier.review.v0.4',
  request: 'tradeproof.supplier.response.request.v0.5',
  timeline: 'tradeproof.inbound.communication.timeline.v0.7',
  queue: 'tradeproof.supplier.evidence.queue.v0.8'
};
const root = document.querySelector('[data-supplier-evidence-root]');
const statusNode = document.querySelector('[data-status]');
const candidateSelect = document.querySelector('[data-candidate]');
const questionSelect = document.querySelector('[data-question]');
const attachmentSelect = document.querySelector('[data-attachment]');
const fileInput = document.querySelector('[data-evidence-files]');

const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const download = (name, content, type) => { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 0); };

let caseRecord = readJson(KEYS.caseRecord);
let review = readJson(KEYS.review);
let request = readJson(KEYS.request);
let timeline = readJson(KEYS.timeline);
let queue = readJson(KEYS.queue) || createSupplierEvidenceQueue(caseRecord, request, review?.selectedCandidateIds ?? []);
let collection = { candidates: [] };
let previews = [];

async function loadCollection() {
  try {
    const response = await fetch('./data/supplier-candidates-hospital-furniture-v0.4.json', { cache: 'no-store' });
    collection = await response.json();
  } catch {
    collection = { candidates: [] };
  }
}

function candidateName(candidateId) {
  return collection.candidates.find((item) => item.candidateId === candidateId)?.displayName || candidateId;
}

function attachmentOptions() {
  return (timeline?.events ?? []).flatMap((event) => (event.attachments ?? []).map((attachment, attachmentIndex) => ({
    eventId: event.eventId,
    candidateId: event.association?.candidateId ?? null,
    attachmentIndex,
    fileName: attachment.fileName,
    mediaType: attachment.mediaType
  })));
}

function populateSelectors() {
  const selected = review?.selectedCandidateIds ?? [];
  candidateSelect.innerHTML = selected.length
    ? selected.map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(candidateName(id))}</option>`).join('')
    : '<option value="">尚无本地候选供应商</option>';
  questionSelect.innerHTML = '<option value="">不绑定具体问题</option>' + (request?.questions ?? []).map((question) => `<option value="${escapeHtml(question.questionId)}">${escapeHtml(question.prompt)}</option>`).join('');
  attachmentSelect.innerHTML = '<option value="">不绑定邮件附件元数据</option>' + attachmentOptions().map((item, index) => `<option value="${index}">${escapeHtml(item.fileName)} · ${escapeHtml(item.candidateId || '未关联')}</option>`).join('');
}

function workspace() {
  return buildSupplierEvidenceWorkspaceModel({ caseRecord, request, review, queue, timeline });
}

function renderFinding(item, finding) {
  const decisionButtons = finding.state === 'candidate_unconfirmed' ? `<div class="actions">
    <button type="button" data-finding-decision="confirmed_in_local_file" data-evidence-id="${escapeHtml(item.evidenceId)}" data-finding-id="${escapeHtml(finding.findingId)}">确认文件中出现</button>
    <button type="button" data-finding-decision="excluded_by_holder" data-evidence-id="${escapeHtml(item.evidenceId)}" data-finding-id="${escapeHtml(finding.findingId)}">排除候选</button>
  </div>` : '';
  return `<tr><td>${escapeHtml(finding.field)}</td><td>${escapeHtml(finding.value)}</td><td>${escapeHtml(finding.state)}</td><td><span class="pill danger">verified=false</span>${decisionButtons}</td></tr>`;
}

function renderItem(item) {
  return `<article class="card">
    <h3>${escapeHtml(item.source.fileName)}</h3>
    <p>${escapeHtml(candidateName(item.candidateId))} · ${escapeHtml(item.documentTypeCandidate)} · ${escapeHtml(item.state)}</p>
    <p><span class="pill">${escapeHtml(item.contentDigest)}</span></p>
    <p><span class="pill ${item.documentContentParsed ? 'ok' : 'warn'}">documentContentParsed=${item.documentContentParsed}</span> <span class="pill">fileUploaded=false</span> <span class="pill danger">evidenceVerified=false</span></p>
    ${item.sourceAttachmentRef ? `<p>邮件附件绑定：${escapeHtml(item.sourceAttachmentRef.observedFileName)} · fileNameMatch=${item.sourceAttachmentRef.fileNameMatch}</p>` : ''}
    ${item.extractedFindings.length ? `<table><thead><tr><th>字段</th><th>候选值</th><th>来源确认状态</th><th>核验边界</th></tr></thead><tbody>${item.extractedFindings.map((finding) => renderFinding(item, finding)).join('')}</tbody></table>` : '<p class="muted">未解码正文；请人工打开原文件审查。</p>'}
    <details><summary>审查任务 ${item.reviewTasks.length}</summary><ul>${item.reviewTasks.map((task) => `<li>${escapeHtml(task.label)} · ${escapeHtml(task.state)}</li>`).join('')}</ul></details>
  </article>`;
}

function renderPreview(item, index) {
  return `<article class="card">
    <h3>待保存：${escapeHtml(item.source.fileName)}</h3>
    <p>${escapeHtml(item.state)} · ${escapeHtml(item.documentTypeCandidate)}</p>
    <p>SHA-256：${escapeHtml(item.contentDigest)}</p>
    <p>提取候选 ${item.extractedFindings.length} · 原文件存储 false · 上传 false · 外部核验 false</p>
    <button type="button" data-save-preview="${index}">保存到本地证据队列</button>
  </article>`;
}

function render() {
  const model = workspace();
  root.innerHTML = `
    <section class="grid">
      <article class="panel metric"><strong>${model.counts.evidenceItems}</strong><p>证据文件</p></article>
      <article class="panel metric"><strong>${model.counts.textParsedItems}</strong><p>本地文本解析</p></article>
      <article class="panel metric"><strong>${model.counts.pendingTasks}</strong><p>待人工审查</p></article>
      <article class="panel metric"><strong>0</strong><p>已验证证据</p></article>
    </section>
    <section class="panel warning"><strong>固定边界</strong><p>已验证证据 0 · 外部注册表核验 0 · 证书有效性核验 0 · 文件上传 0 · 排名与资格决定 0。</p></section>
    ${previews.length ? `<section class="panel"><h2>本地处理预览</h2>${previews.map(renderPreview).join('')}</section>` : ''}
    <section class="panel"><h2>证据审查队列</h2>${model.items.length ? model.items.map(renderItem).join('') : '<div class="empty">尚未接入本地证据文件。</div>'}</section>`;

  root.querySelectorAll('[data-save-preview]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.savePreview);
    const item = previews[index];
    const errors = validateSupplierEvidenceItem(item);
    if (errors.length) { statusNode.textContent = errors.join('; '); return; }
    queue = upsertSupplierEvidenceItem(queue, item);
    saveJson(KEYS.queue, queue);
    previews.splice(index, 1);
    statusNode.textContent = '已保存到浏览器本地证据队列；未上传或验证。';
    render();
  }));

  root.querySelectorAll('[data-finding-decision]').forEach((button) => button.addEventListener('click', () => {
    const item = queue.items.find((entry) => entry.evidenceId === button.dataset.evidenceId);
    if (!item) return;
    const nextItem = decideEvidenceFinding(item, button.dataset.findingId, button.dataset.findingDecision);
    queue = upsertSupplierEvidenceItem(queue, nextItem);
    saveJson(KEYS.queue, queue);
    statusNode.textContent = button.dataset.findingDecision === 'confirmed_in_local_file'
      ? '已确认该字段出现在本地文件中；这不是外部真实性核验。'
      : '已排除该提取候选。';
    render();
  }));
}

fileInput.addEventListener('change', async () => {
  previews = [];
  const selectedIds = review?.selectedCandidateIds ?? [];
  const attachments = attachmentOptions();
  const attachment = attachmentSelect.value === '' ? null : attachments[Number(attachmentSelect.value)];
  for (const file of [...fileInput.files]) {
    try {
      if (file.size > MAX_EVIDENCE_FILE_BYTES) throw new Error('文件超过 8 MiB 本地限制');
      const item = await intakeSupplierEvidenceFile(file, {
        caseId: caseRecord?.caseId,
        requestId: request?.requestId,
        candidateId: candidateSelect.value,
        selectedCandidateIds: selectedIds,
        questionId: questionSelect.value,
        sourceAttachment: attachment
      });
      previews.push(item);
    } catch (error) {
      statusNode.textContent = `${file.name}: ${error.message}`;
    }
  }
  if (previews.length) statusNode.textContent = `已在本地处理 ${previews.length} 个文件；保存前请检查绑定与提取候选。`;
  render();
});

document.querySelector('[data-export-queue]').addEventListener('click', () => {
  const errors = validateSupplierEvidenceQueue(queue);
  if (errors.length) { statusNode.textContent = errors.join('; '); return; }
  download(`tradeproof-supplier-evidence-queue-${Date.now()}.json`, JSON.stringify(queue, null, 2), 'application/json');
  statusNode.textContent = '已导出本地证据队列；原文件未包含在导出中。';
});

await loadCollection();
populateSelectors();
render();
