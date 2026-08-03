import {
  DECISION_CONFIRMATION_TEXT,
  buildSupplierDecisionModel,
  createSupplierDecisionRecord,
  createSupplierDecisionWorkspace,
  upsertSupplierDecision,
  validateSupplierDecisionWorkspace
} from './supplier-decision-core.mjs';

const KEYS = {
  caseRecord: 'tradeproof.trade.case.v0.2',
  review: 'tradeproof.supplier.review.v0.4',
  request: 'tradeproof.supplier.response.request.v0.5',
  responses: 'tradeproof.supplier.responses.v0.5',
  timeline: 'tradeproof.inbound.communication.timeline.v0.7',
  evidenceQueue: 'tradeproof.supplier.evidence.queue.v0.8',
  verification: 'tradeproof.evidence.verification.workspace.v0.9',
  decisions: 'tradeproof.supplier.decision.workspace.v1.0'
};
const root = document.querySelector('[data-supplier-decision-root]');
const statusNode = document.querySelector('[data-status]');
const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const download = (name, content) => { const blob = new Blob([content], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 0); };

const caseRecord = readJson(KEYS.caseRecord);
const review = readJson(KEYS.review);
const request = readJson(KEYS.request);
const responses = readJson(KEYS.responses) ?? [];
const timeline = readJson(KEYS.timeline);
const evidenceQueue = readJson(KEYS.evidenceQueue);
const verificationWorkspace = readJson(KEYS.verification);
let collection = { candidates: [] };
let workspace = readJson(KEYS.decisions);
let model = null;

function decisionLabel(value) {
  return ({
    continue_contact: '继续接触',
    pause_pending_information: '等待补件并暂停推进',
    exclude_from_current_case: '从当前案件排除',
    deeper_verification_required: '进入深度核验'
  })[value] ?? value;
}
function stateLabel(value) {
  return ({
    supported_candidate: '外部回执支持候选',
    missing: '缺失',
    contradicted_candidate: '矛盾候选',
    stale: '可能过期',
    unverified_evidence_available: '有未验证证据',
    unverified_response_only: '仅有供应商自述'
  })[value] ?? value;
}
function syncWorkspace() {
  const selected = review?.selectedCandidateIds ?? [];
  if (!workspace || workspace.caseId !== caseRecord?.caseId || validateSupplierDecisionWorkspace(workspace).length) {
    workspace = createSupplierDecisionWorkspace(caseRecord, selected);
  } else {
    workspace.candidateOrder = [...selected];
    workspace.decisions = (workspace.decisions ?? []).filter((item) => selected.includes(item.candidateId));
  }
  saveJson(KEYS.decisions, workspace);
}
function rebuildModel() {
  model = buildSupplierDecisionModel({ caseRecord, supplierReview: review, request, responses, evidenceQueue, verificationWorkspace, timeline, supplierCollection: collection, decisionWorkspace: workspace });
}
function renderRequirements(candidate) {
  if (!candidate.requirementRows.length) return '<p class="muted">当前案件没有已确认正式要求。</p>';
  return `<table class="requirement-table"><thead><tr><th>正式要求</th><th>状态</th><th>回复</th><th>证据 / 核验</th></tr></thead><tbody>${candidate.requirementRows.map((row) => `<tr>
    <td><strong>${escapeHtml(row.label)}</strong><br><small>${escapeHtml(row.excerpt || row.requirementId)}</small></td>
    <td class="status-${escapeHtml(row.state)}">${escapeHtml(stateLabel(row.state))}</td>
    <td>${row.answerPresent ? '已回答，未验证' : '未回答'}</td>
    <td>证据 ${row.evidenceItemIds.length} · 回执审查 ${row.verificationReviewIds.length} · evidenceVerified=false</td>
  </tr>`).join('')}</tbody></table>`;
}
function renderCandidate(candidate) {
  const decision = candidate.currentDecision;
  return `<article class="decision-card">
    <header><small>${escapeHtml(candidate.candidateId)}</small><h2>${escapeHtml(candidate.displayName)}</h2></header>
    <div class="signal-grid">
      <div class="signal"><strong>${candidate.responseSummary.answered}/${candidate.responseSummary.required}</strong><br>必答回复</div>
      <div class="signal"><strong>${candidate.counts.evidenceItems}</strong><br>证据文件</div>
      <div class="signal"><strong>${candidate.counts.verificationReviews}</strong><br>核验回执审查</div>
      <div class="signal"><strong>${candidate.counts.inboundEvents}</strong><br>入站通信</div>
      <div class="signal"><strong>${candidate.counts.contradicted}</strong><br>矛盾候选</div>
      <div class="signal"><strong>${candidate.counts.stale}</strong><br>可能过期</div>
    </div>
    <h3>案件正式要求逐项审查</h3>${renderRequirements(candidate)}
    <h3>系统建议的下一步</h3>
    <p><strong>${escapeHtml(decisionLabel(candidate.ruleSuggestion.decision))}</strong> · ${escapeHtml(candidate.ruleSuggestion.reason)}</p>
    <p class="boundary-note">classification=${escapeHtml(candidate.ruleSuggestion.classification)} · 不是供应商资格决定。</p>
    <h3>待办候选</h3>
    <div class="candidate-actions">${candidate.actionCandidates.length ? candidate.actionCandidates.map((item) => `<div>• ${escapeHtml(item.label)} — ${escapeHtml(item.reason)} · externalActionPerformed=false</div>`).join('') : '<span class="muted">暂无新增待办候选。</span>'}</div>
    ${decision ? `<section class="panel"><strong>当前人工候选决定：${escapeHtml(decisionLabel(decision.decision))}</strong><p>${escapeHtml(decision.reason)}</p><small>${escapeHtml(decision.state)} · supplierEligibilityDecided=false</small></section>` : ''}
    <div class="decision-form">
      <select data-decision="${escapeHtml(candidate.candidateId)}">
        <option value="continue_contact">继续接触</option>
        <option value="pause_pending_information">等待补件并暂停推进</option>
        <option value="deeper_verification_required">进入深度核验</option>
        <option value="exclude_from_current_case">从当前案件排除</option>
      </select>
      <textarea data-reason="${escapeHtml(candidate.candidateId)}" placeholder="记录具体事实、缺口、矛盾与人工理由"></textarea>
      <input data-phrase="${escapeHtml(candidate.candidateId)}" placeholder="${DECISION_CONFIRMATION_TEXT}">
      <button type="button" data-save-decision="${escapeHtml(candidate.candidateId)}">保存本地人工候选决定</button>
    </div>
    <p class="boundary-note">numericScore=null · rank=null · formalShortlistCreated=false · supplierEligibilityDecided=false · awardDecisionCreated=false</p>
  </article>`;
}
function render() {
  root.innerHTML = `
    <section class="grid">
      <article class="panel metric"><strong>${model.counts.candidates}</strong><p>候选供应商</p></article>
      <article class="panel metric"><strong>${model.counts.withMissingInformation}</strong><p>存在信息缺口</p></article>
      <article class="panel metric"><strong>${model.counts.withContradictions}</strong><p>存在矛盾候选</p></article>
      <article class="panel metric"><strong>${model.counts.withStaleEvidence}</strong><p>存在过期信号</p></article>
      <article class="panel metric"><strong>${model.counts.decisionsRecorded}</strong><p>人工候选决定</p></article>
      <article class="panel metric"><strong>0</strong><p>资格或授标决定</p></article>
    </section>
    <section class="panel warning"><strong>固定边界</strong><p>无数字评分 · 无排名 · 无自动排除 · 无正式 Shortlist · 无资格决定 · 无授标 · 无外部动作。</p></section>
    <section class="decision-grid">${model.candidates.length ? model.candidates.map(renderCandidate).join('') : '<div class="empty">尚未建立本地供应商候选名单。</div>'}</section>`;
  root.querySelectorAll('[data-save-decision]').forEach((button) => button.addEventListener('click', () => {
    const candidate = model.candidates.find((item) => item.candidateId === button.dataset.saveDecision);
    const decision = root.querySelector(`[data-decision="${CSS.escape(candidate.candidateId)}"]`)?.value;
    const reason = root.querySelector(`[data-reason="${CSS.escape(candidate.candidateId)}"]`)?.value;
    const phrase = root.querySelector(`[data-phrase="${CSS.escape(candidate.candidateId)}"]`)?.value;
    try {
      const record = createSupplierDecisionRecord(candidate, decision, reason, phrase);
      workspace = upsertSupplierDecision(workspace, record);
      saveJson(KEYS.decisions, workspace);
      rebuildModel();
      statusNode.textContent = '已保存本地人工候选决定；未形成正式 Shortlist、资格或授标决定。';
      render();
    } catch (error) {
      statusNode.textContent = error.message;
    }
  }));
}

async function initialize() {
  try {
    collection = await fetch('./data/supplier-candidates-hospital-furniture-v0.4.json', { cache: 'no-store' }).then((response) => response.json());
    syncWorkspace();
    rebuildModel();
    render();
    statusNode.textContent = `${model.counts.candidates} 家候选 · ${model.counts.decisionsRecorded} 条本地人工候选决定`;
  } catch (error) {
    statusNode.textContent = error.message;
    root.innerHTML = `<div class="fatal">决策工作台加载失败：${escapeHtml(error.message)}</div>`;
  }
}

document.querySelector('[data-export-workspace]').addEventListener('click', () => {
  const errors = validateSupplierDecisionWorkspace(workspace);
  if (errors.length) { statusNode.textContent = errors.join('; '); return; }
  download(`tradeproof-supplier-decisions-${Date.now()}.json`, JSON.stringify(workspace, null, 2));
  statusNode.textContent = '已导出本地候选决定；不包含正式 Shortlist、资格或授标。';
});

initialize();
