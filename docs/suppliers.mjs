import {
  buildSupplierWorkspaceModel,
  createSupplierReview,
  toggleSupplierCandidate,
  validateSupplierReview
} from './supplier-candidate-core.mjs';
import { validateTradeCase } from './trade-case-core.mjs';

const CASE_STORAGE_KEY = 'tradeproof.trade.case.v0.2';
const REVIEW_STORAGE_KEY = 'tradeproof.supplier.review.v0.4';
const COLLECTION_URL = './data/supplier-candidates-hospital-furniture-v0.4.json';
const root = document.querySelector('[data-supplier-workspace-root]');
const statusNode = document.querySelector('[data-status]');

let collection = null;
let caseRecord = null;
let review = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function stateLabel(state) {
  return ({
    scope_candidate_only: '仅产品范围候选',
    scope_mismatch: '公开产品范围不重合',
    potential_candidate_with_gaps: '可能相关，存在证据缺口',
    public_claim_overlap_requires_verification: '公开声明有覆盖，仍需核验',
    public_claim_only: '仅官网自述覆盖',
    evidence_gap: '证据缺口',
    not_supplier_capability_criterion: '不属于能力判断'
  })[state] ?? state;
}

function stateClass(state) {
  return `is-${String(state ?? '').replace(/[^a-z0-9_-]/gi, '')}`;
}

function readJsonStorage(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function loadCase() {
  const candidate = readJsonStorage(CASE_STORAGE_KEY);
  if (!candidate) return null;
  const errors = await validateTradeCase(candidate);
  return errors.length ? null : candidate;
}

function persistReview() {
  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(review));
}

function claimCard(claim) {
  return `<article>
    <header><strong>${escapeHtml(claim.claimType)}</strong><span class="badge">未验证</span></header>
    <p>${escapeHtml(claim.text)}</p>
    <small>${escapeHtml(claim.evidenceClassification)} · verified=${claim.verified}</small><br>
    <a href="${escapeHtml(claim.sourceUrl)}" target="_blank" rel="noreferrer">查看公开来源</a>
  </article>`;
}

function assessmentCard(item) {
  return `<article>
    <header><strong>${escapeHtml(item.label)}</strong><span class="assessment-state ${stateClass(item.state)}">${escapeHtml(stateLabel(item.state))}</span></header>
    <p>${escapeHtml(item.reason)}</p>
    <small>officialRequirement=${item.officialRequirement} · supplierEvidenceVerified=${item.supplierEvidenceVerified}</small>
  </article>`;
}

function candidateCard(item) {
  const selected = review.selectedCandidateIds.includes(item.candidateId);
  const scopeTags = item.scope.matchedTerms.length
    ? item.scope.matchedTerms.map((term) => `<span>${escapeHtml(term)}</span>`).join('')
    : '<span>仅有宽泛医院家具范围或暂无直接术语重合</span>';
  const assessments = item.requirementAssessments.length
    ? item.requirementAssessments.map(assessmentCard).join('')
    : '<div class="warning">当前 Trade Case 尚无人工确认的正式要求，因此只能判断公开产品范围可能相关，不能比较资格、技术、交付或认证。</div>';

  return `<article class="candidate-card${selected ? ' is-selected' : ''}">
    <div class="candidate-head">
      <div><small>${escapeHtml(item.country)} · ${escapeHtml(item.region)} · observed_unclaimed</small><h3>${escapeHtml(item.displayName)}</h3></div>
      <span class="badge ${stateClass(item.state)}">${escapeHtml(stateLabel(item.state))}</span>
    </div>
    <p class="state-copy">官网公开声明只能用于发现候选。verifiedSupplier=false，eligibleForTender=unknown。</p>
    <div class="scope-tags">${scopeTags}</div>
    <div class="claims"><h4>公开自述与来源</h4>${item.publicClaims.map(claimCard).join('')}</div>
    <div class="assessments"><h4>对照已确认案件要求</h4>${assessments}</div>
    <div><h4>下一轮应向供应商核实</h4><ul class="questions">${item.nextReviewQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join('')}</ul></div>
    <div class="candidate-actions">
      <button type="button" data-toggle-candidate="${escapeHtml(item.candidateId)}" class="${selected ? 'is-selected' : ''}">${selected ? '从本地候选名单移除' : '加入本地候选名单'}</button>
      <a href="${escapeHtml(item.website)}" target="_blank" rel="noreferrer">打开企业官网</a>
    </div>
  </article>`;
}

function renderShortlist(model) {
  const selected = model.candidates.filter((item) => review.selectedCandidateIds.includes(item.candidateId));
  return `<section class="shortlist">
    <div class="section-head"><div><small>HOLDER-LOCAL REVIEW</small><h2>本地候选名单</h2></div><span class="badge">${selected.length} 家</span></div>
    ${selected.length
      ? `<ul>${selected.map((item) => `<li><strong>${escapeHtml(item.displayName)}</strong><br><small>${escapeHtml(stateLabel(item.state))} · 未联系 · 未核验 · 未作资格判断</small></li>`).join('')}</ul>`
      : '<div class="empty">尚未选择供应商。加入候选名单只会写入当前浏览器，不会联系企业，也不会产生正式 Shortlist。</div>'}
  </section>`;
}

function renderProfile(model) {
  const profile = model.requirementProfile;
  return `<section class="profile">
    <div class="section-head"><div><small>REQUIREMENT PROFILE</small><h2>案件要求投影</h2></div><span class="badge ${profile.hasConfirmedRequirements ? 'is-overlap' : 'is-gap'}">${profile.confirmedRequirements.length} 条已确认</span></div>
    <div class="profile-grid">
      <div class="profile-block">
        <h3>公开机会范围</h3>
        <p>${escapeHtml(profile.sourceScope.title || '当前浏览器没有有效 Trade Case；使用候选集合所绑定的医院家具产品范围。')}</p>
        <p>CPV：${escapeHtml(profile.sourceScope.classificationCodes.join(', ') || '未从本地案件读取')}</p>
        <small>source_opportunity_scope · confirmedRequirement=false</small>
      </div>
      <div class="profile-block">
        <h3>人工确认的正式要求</h3>
        ${profile.confirmedRequirements.length
          ? `<ul>${profile.confirmedRequirements.map((item) => `<li><strong>${escapeHtml(item.label)}</strong>：${escapeHtml(item.excerpt)}</li>`).join('')}</ul>`
          : '<div class="warning">尚无已确认正式要求。请先回到今日运营或本地文件解析，对通知候选要求逐条确认，再回来比较。</div>'}
      </div>
    </div>
  </section>`;
}

function render(model) {
  root.innerHTML = `<div class="workspace">
    <section class="summary-grid">
      <article class="summary-card"><small>公开观察候选</small><strong>${model.counts.observedCandidates}</strong></article>
      <article class="summary-card"><small>产品范围重合</small><strong>${model.counts.scopeOverlap}</strong></article>
      <article class="summary-card${model.counts.confirmedRequirements ? '' : ' is-warning'}"><small>已确认案件要求</small><strong>${model.counts.confirmedRequirements}</strong></article>
      <article class="summary-card"><small>已验证供应商</small><strong>${model.counts.verifiedSuppliers}</strong></article>
      <article class="summary-card"><small>资格结论</small><strong>${model.counts.eligibilityDecisions}</strong></article>
    </section>
    ${renderProfile(model)}
    ${renderShortlist(model)}
    <section>
      <div class="section-head"><div><small>OBSERVED CHINA SUPPLIERS</small><h2>医院家具供应商候选</h2></div><span class="badge">原始观察顺序 · 不排名</span></div>
      <div class="candidate-grid">${model.candidates.map(candidateCard).join('')}</div>
    </section>
  </div>`;
  bindCandidateActions();
}

function bindCandidateActions() {
  for (const button of document.querySelectorAll('[data-toggle-candidate]')) {
    button.addEventListener('click', () => {
      review = toggleSupplierCandidate(review, button.dataset.toggleCandidate);
      persistReview();
      render(buildSupplierWorkspaceModel(caseRecord, collection));
    });
  }
}

function exportReview() {
  const blob = new Blob([`${JSON.stringify(review, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `supplier-review-${collection.targetOpportunityRecordId}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function initialize() {
  try {
    collection = await fetch(COLLECTION_URL).then((response) => {
      if (!response.ok) throw new Error(`Supplier collection HTTP ${response.status}`);
      return response.json();
    });
    caseRecord = await loadCase();
    review = readJsonStorage(REVIEW_STORAGE_KEY) ?? createSupplierReview(caseRecord, collection);
    if (validateSupplierReview(review, collection).length) review = createSupplierReview(caseRecord, collection);
    persistReview();
    const model = buildSupplierWorkspaceModel(caseRecord, collection);
    render(model);
    statusNode.textContent = caseRecord
      ? `已读取本地案件 ${caseRecord.sourceOpportunity.recordId}`
      : '未读取到本地案件，仅显示产品范围候选';
  } catch (error) {
    root.innerHTML = `<div class="fatal"><strong>供应商工作台加载失败</strong><span>${escapeHtml(error.message)}</span></div>`;
    statusNode.textContent = '加载失败';
  }
}

document.querySelector('#export-review')?.addEventListener('click', () => {
  if (review && collection) exportReview();
});

initialize();
