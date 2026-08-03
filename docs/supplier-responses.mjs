import {
  buildSupplierResponseRequest,
  buildSupplierResponseWorkspace,
  createSupplierResponseTemplate,
  importSupplierResponse,
  validateSupplierResponse,
  validateSupplierResponseRequest
} from './supplier-response-core.mjs';
import { validateTradeCase } from './trade-case-core.mjs';
import { validateSupplierReview } from './supplier-candidate-core.mjs';

const CASE_STORAGE_KEY = 'tradeproof.trade.case.v0.2';
const REVIEW_STORAGE_KEY = 'tradeproof.supplier.review.v0.4';
const REQUEST_STORAGE_KEY = 'tradeproof.supplier.response.request.v0.5';
const RESPONSES_STORAGE_KEY = 'tradeproof.supplier.responses.v0.5';
const COLLECTION_URL = './data/supplier-candidates-hospital-furniture-v0.4.json';

const root = document.querySelector('[data-supplier-response-root]');
const statusNode = document.querySelector('[data-status]');
let collection = null;
let caseRecord = null;
let review = null;
let request = null;
let responses = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function readJsonStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist() {
  localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(request));
  localStorage.setItem(RESPONSES_STORAGE_KEY, JSON.stringify(responses));
}

function downloadJson(value, fileName) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function stateLabel(state) {
  return ({
    no_response: '尚未导入回复',
    partial_response_unverified: '部分回复，未验证',
    response_received_unverified: '已收到完整字段回复，未验证',
    missing_response: '缺失',
    answered_unverified: '已回答，未验证',
    answered_with_unverified_evidence_metadata: '已回答并附证据元数据，未验证',
    claim_response_conflict: '与公开声明可能冲突'
  })[state] ?? state;
}

function safeClass(value) {
  return String(value ?? '').replace(/[^a-z0-9_-]/gi, '');
}

function renderQuestion(question) {
  return `<article class="question-card">
    <header><strong>${escapeHtml(question.category)}</strong><span class="badge">${escapeHtml(question.questionId)}</span></header>
    <p>${escapeHtml(question.prompt)}</p>
    <small>required=${question.required} · evidenceRequested=${escapeHtml((question.evidenceRequested ?? []).join(', ') || 'none')}</small>
  </article>`;
}

function renderEvidence(evidenceRefs) {
  if (!evidenceRefs?.length) return '<small>未提供证据元数据</small>';
  return `<ul class="evidence-list">${evidenceRefs.map((item) => `<li>${escapeHtml(item.fileName || 'unnamed')} · ${escapeHtml(item.mediaType || 'unknown')} · digest=${escapeHtml(item.digest || 'missing')} · evidenceVerified=false</li>`).join('')}</ul>`;
}

function renderAssessment(item) {
  return `<article class="assessment is-${safeClass(item.state)}">
    <header><strong>${escapeHtml(item.category)}</strong><span class="assessment-state">${escapeHtml(stateLabel(item.state))}</span></header>
    <p>${escapeHtml(item.prompt)}</p>
    ${item.answerValue === null ? '<div class="answer">未回答</div>' : `<div class="answer">${escapeHtml(Array.isArray(item.answerValue) ? item.answerValue.join('；') : item.answerValue)}</div>`}
    ${item.conflict ? `<div class="warning">${escapeHtml(item.conflict)}</div>` : ''}
    ${renderEvidence(item.evidenceRefs)}
    <div class="footer-boundary">supplierStatementClassification=${escapeHtml(item.supplierStatementClassification ?? 'none')} · supplierIdentityVerified=false · evidenceVerified=false</div>
  </article>`;
}

function candidateResponse(candidate) {
  return responses.find((item) => item.candidateId === candidate.candidateId) ?? null;
}

function renderCandidate(item) {
  const response = candidateResponse(item);
  return `<article class="candidate-card is-${safeClass(item.state)}">
    <div class="candidate-head">
      <div><small>${escapeHtml(item.candidateId)}</small><h3>${escapeHtml(item.displayName)}</h3></div>
      <span class="badge">${escapeHtml(stateLabel(item.state))}</span>
    </div>
    <div class="candidate-meta">回答 ${item.counts.answered}/${item.counts.totalQuestions} · 缺失 ${item.counts.missing} · 冲突 ${item.counts.conflicts} · 证据元数据 ${item.counts.evidenceMetadataRefs}</div>
    <div class="candidate-actions">
      <button type="button" data-export-template="${escapeHtml(item.candidateId)}">导出该供应商回复模板</button>
      ${response ? `<button type="button" data-remove-response="${escapeHtml(item.candidateId)}">移除本地回复</button>` : ''}
    </div>
    <div class="assessment-list">${item.questionAssessments.map(renderAssessment).join('')}</div>
    <div class="footer-boundary">numericScore=null · rank=null · supplierEligibilityDecided=false · formalShortlistCreated=false</div>
  </article>`;
}

function render(model) {
  root.innerHTML = `<div>
    <section class="summary-grid">
      <article class="summary-card"><small>已选供应商</small><strong>${model.counts.selectedCandidates}</strong></article>
      <article class="summary-card"><small>已导入回复</small><strong>${model.counts.responsesImported}</strong></article>
      <article class="summary-card"><small>存在缺失项</small><strong>${model.counts.candidatesWithMissingAnswers}</strong></article>
      <article class="summary-card"><small>存在冲突</small><strong>${model.counts.candidatesWithConflicts}</strong></article>
      <article class="summary-card"><small>已验证身份</small><strong>${model.counts.verifiedSupplierIdentities}</strong></article>
      <article class="summary-card"><small>资格结论</small><strong>${model.counts.eligibilityDecisions}</strong></article>
    </section>

    <section class="section">
      <div class="section-head"><div><small>UNIFIED QUESTION PACK</small><h2>统一 Supplier Response Request</h2></div><span class="badge">${request.questions.length} 个问题 · 未发送</span></div>
      <div class="questions">${request.questions.map(renderQuestion).join('')}</div>
      <div class="footer-boundary">requestId=${escapeHtml(request.requestId)} · externalSendPerformed=false · contactDisclosurePerformed=false · rankingGenerated=false</div>
    </section>

    <section class="section">
      <div class="section-head"><div><small>STRUCTURED COMPARISON</small><h2>供应商回复比较</h2></div><span class="badge">holder_selection_order_no_ranking</span></div>
      ${model.candidates.length ? `<div class="candidate-grid">${model.candidates.map(renderCandidate).join('')}</div>` : '<div class="empty">当前浏览器尚未选择供应商。请先回到“供应商候选”，建立本地候选名单。</div>'}
    </section>
  </div>`;
  bindActions();
}

function bindActions() {
  for (const button of document.querySelectorAll('[data-export-template]')) {
    button.addEventListener('click', () => {
      const template = createSupplierResponseTemplate(request, button.dataset.exportTemplate, collection);
      downloadJson(template, `supplier-response-template-${button.dataset.exportTemplate.replace(/[^a-z0-9_-]/gi, '-')}.json`);
    });
  }
  for (const button of document.querySelectorAll('[data-remove-response]')) {
    button.addEventListener('click', () => {
      responses = responses.filter((item) => item.candidateId !== button.dataset.removeResponse);
      persist();
      render(buildSupplierResponseWorkspace(request, responses, collection));
    });
  }
}

async function loadLocalContext() {
  const localCase = readJsonStorage(CASE_STORAGE_KEY);
  if (localCase) {
    const caseErrors = await validateTradeCase(localCase);
    if (!caseErrors.length) caseRecord = localCase;
  }
  const localReview = readJsonStorage(REVIEW_STORAGE_KEY);
  if (localReview && !validateSupplierReview(localReview, collection).length) review = localReview;
  if (!review) {
    review = {
      schemaVersion: 'tradeproof.supplier-review.v0.4',
      caseId: caseRecord?.caseId ?? null,
      targetOpportunityId: collection.targetOpportunityId,
      selectedCandidateIds: [],
      notes: {},
      state: 'holder_local_draft',
      formalWritePerformed: false,
      externalContactPerformed: false,
      supplierEligibilityDecided: false
    };
  }
}

function restoreRequestAndResponses() {
  const storedRequest = readJsonStorage(REQUEST_STORAGE_KEY);
  request = storedRequest ?? buildSupplierResponseRequest(caseRecord, review, collection);
  if (validateSupplierResponseRequest(request, review, collection).length) {
    request = buildSupplierResponseRequest(caseRecord, review, collection);
  }
  const storedResponses = readJsonStorage(RESPONSES_STORAGE_KEY);
  responses = Array.isArray(storedResponses)
    ? storedResponses.filter((item) => !validateSupplierResponse(item, request, collection).length)
    : [];
  persist();
}

async function importFiles(files) {
  const next = [...responses];
  const errors = [];
  for (const file of files) {
    try {
      const parsed = JSON.parse(await file.text());
      const imported = importSupplierResponse(parsed, request, collection);
      const index = next.findIndex((item) => item.candidateId === imported.candidateId);
      if (index >= 0) next[index] = imported; else next.push(imported);
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }
  responses = next;
  persist();
  render(buildSupplierResponseWorkspace(request, responses, collection));
  statusNode.textContent = errors.length
    ? `部分导入失败：${errors.join('；')}`
    : `已导入 ${files.length} 份本地回复；身份和证据仍未验证`;
}

async function initialize() {
  try {
    collection = await fetch(COLLECTION_URL).then((response) => {
      if (!response.ok) throw new Error(`Supplier collection HTTP ${response.status}`);
      return response.json();
    });
    await loadLocalContext();
    restoreRequestAndResponses();
    render(buildSupplierResponseWorkspace(request, responses, collection));
    statusNode.textContent = `${request.selectedCandidateIds.length} 家本地候选 · ${responses.length} 份未验证回复`;
  } catch (error) {
    root.innerHTML = `<div class="fatal"><strong>供应商回复工作台加载失败</strong><span>${escapeHtml(error.message)}</span></div>`;
    statusNode.textContent = '加载失败';
  }
}

document.querySelector('#response-file')?.addEventListener('change', async (event) => {
  await importFiles([...event.target.files]);
  event.target.value = '';
});

document.querySelector('#export-request')?.addEventListener('click', () => {
  if (request) downloadJson(request, `supplier-response-request-${request.targetOpportunityRecordId}.json`);
});

initialize();
