import { MAX_EML_BYTES, appendInboundEvent, associateInboundMessage, buildInboundWorkspaceModel, createInboundEvent, createInboundTimeline, parseEml, validateInboundEvent, validateInboundTimeline } from './inbound-communication-core.mjs';

const KEYS = {
  caseRecord: 'tradeproof.trade.case.v0.2',
  review: 'tradeproof.supplier.review.v0.4',
  request: 'tradeproof.supplier.response.request.v0.5',
  contacts: 'tradeproof.supplier.contact.book.v0.6',
  timeline: 'tradeproof.inbound.communication.timeline.v0.7'
};
const root = document.querySelector('[data-inbound-communication-root]');
const statusNode = document.querySelector('[data-status]');
const fileInput = document.querySelector('[data-eml-files]');

const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const download = (name, content, type) => { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 0); };

let caseRecord = readJson(KEYS.caseRecord);
let review = readJson(KEYS.review);
let request = readJson(KEYS.request);
let contactBook = readJson(KEYS.contacts);
let collection = null;
let timeline = readJson(KEYS.timeline) || createInboundTimeline(caseRecord);
let previews = [];

async function loadCollection() {
  try {
    const response = await fetch('./data/supplier-candidates-hospital-furniture-v0.4.json', { cache: 'no-store' });
    collection = await response.json();
  } catch {
    collection = { candidates: [] };
  }
}

function workspace() {
  return buildInboundWorkspaceModel({ caseRecord, request, review, collection, contactBook, timeline });
}

function renderPreview(item, index) {
  const parsed = item.parsed;
  const association = item.association;
  return `<article class="card">
    <h3>${escapeHtml(parsed.subject || '(无主题)')}</h3>
    <p><strong>From:</strong> ${escapeHtml(parsed.from.displayName)} &lt;${escapeHtml(parsed.from.address || 'unknown')}&gt;</p>
    <p><strong>候选关联：</strong> ${escapeHtml(association.associationState)} · senderIdentityVerified=false</p>
    <p>${association.signals.map((signal) => `<span class="pill">${escapeHtml(signal)}</span>`).join('')}</p>
    <p><strong>Candidate:</strong> ${escapeHtml(association.candidateDisplayName || association.candidateId || '未匹配')}</p>
    <p><strong>附件元数据：</strong> ${parsed.attachments.length}；附件内容未读取。</p>
    <pre>${escapeHtml(parsed.bodyText.slice(0, 1600))}</pre>
    <button type="button" data-save-preview="${index}">保存为未验证时间线事件</button>
  </article>`;
}

function render() {
  const model = workspace();
  root.innerHTML = `
    <section class="grid">
      <article class="panel"><strong>${model.counts.inboundEvents}</strong><p>入站事件</p></article>
      <article class="panel"><strong>${model.counts.actionCandidates}</strong><p>待确认动作候选</p></article>
      <article class="panel"><strong>${model.counts.attachmentMetadata}</strong><p>附件元数据</p></article>
    </section>
    <section class="panel warning"><strong>固定边界</strong><p>身份验证 0 · 附件内容读取 0 · 自动回复 0 · 正式提交 0。邮箱地址匹配只用于候选关联。</p></section>
    ${previews.length ? `<section class="panel"><h2>待保存预览</h2>${previews.map(renderPreview).join('')}</section>` : ''}
    <section class="panel"><h2>通信时间线</h2>
      ${timeline.events.length ? timeline.events.slice().reverse().map((event) => `<article class="card">
        <h3>${escapeHtml(event.subject || '(无主题)')}</h3>
        <p>${escapeHtml(event.sentAt || event.observedAt)} · ${escapeHtml(event.association.associationState)}</p>
        <p><strong>From:</strong> ${escapeHtml(event.from.address || 'unknown')} · identityVerified=false</p>
        <p><strong>Supplier:</strong> ${escapeHtml(event.association.candidateDisplayName || event.association.candidateId || '待人工关联')}</p>
        <p><strong>结构化回复信号：</strong> ${escapeHtml(event.structuredResponseSignal.state)}</p>
        <table><thead><tr><th>待办</th><th>原因</th><th>状态</th></tr></thead><tbody>${event.actionCandidates.map((action) => `<tr><td>${escapeHtml(action.label)}</td><td>${escapeHtml(action.reason)}</td><td>${escapeHtml(action.state)}</td></tr>`).join('')}</tbody></table>
        ${event.attachments.length ? `<h4>附件元数据</h4><ul>${event.attachments.map((file) => `<li>${escapeHtml(file.fileName)} · ${escapeHtml(file.mediaType)} · contentRead=false</li>`).join('')}</ul>` : ''}
      </article>`).join('') : '<p class="muted">尚未保存入站邮件。</p>'}
    </section>`;

  root.querySelectorAll('[data-save-preview]').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.savePreview);
    const preview = previews[index];
    const event = createInboundEvent(preview.parsed, preview.association);
    const errors = validateInboundEvent(event);
    if (errors.length) { statusNode.textContent = errors.join('; '); return; }
    const result = appendInboundEvent(timeline, event);
    timeline = result.timeline;
    saveJson(KEYS.timeline, timeline);
    previews.splice(index, 1);
    statusNode.textContent = result.added ? '已保存为本地未验证时间线事件。' : `重复邮件未再次保存：${result.duplicateEventId}`;
    render();
  }));
}

fileInput.addEventListener('change', async () => {
  const files = [...fileInput.files];
  previews = [];
  for (const file of files) {
    try {
      if (file.size > MAX_EML_BYTES) throw new Error('文件超过 2 MiB 本地限制');
      const raw = await file.text();
      const parsed = parseEml(raw);
      const association = associateInboundMessage(parsed, { caseRecord, request, review, collection, contactBook });
      previews.push({ fileName: file.name, parsed, association });
    } catch (error) {
      statusNode.textContent = `${file.name}: ${error.message}`;
    }
  }
  if (previews.length) statusNode.textContent = `已在本地解析 ${previews.length} 封邮件；保存前请检查候选关联。`;
  render();
});

document.querySelector('[data-export-timeline]').addEventListener('click', () => {
  const errors = validateInboundTimeline(timeline);
  if (errors.length) { statusNode.textContent = errors.join('; '); return; }
  download(`tradeproof-inbound-timeline-${Date.now()}.json`, JSON.stringify(timeline, null, 2), 'application/json');
  statusNode.textContent = '已导出本地通信时间线；未执行外部发送或服务器写入。';
});

await loadCollection();
render();
