import {
  HANDOFF_CONFIRMATION_TEXT, RECEIPT_REVIEW_CONFIRMATION_TEXT,
  approveVerificationHandoff, buildReceiptTemplate, buildVerificationHandoffPackage,
  buildVerificationWorkspaceModel, confirmVerificationReview, createVerificationReview,
  createVerificationTask, createVerificationWorkspace, upsertVerificationReceipt,
  upsertVerificationReview, upsertVerificationTask, validateReceiptAgainstTask,
  validateVerificationWorkspace
} from './evidence-verification-core.mjs';

const KEYS = {
  caseRecord: 'tradeproof.trade.case.v0.2',
  evidenceQueue: 'tradeproof.supplier.evidence.queue.v0.8',
  workspace: 'tradeproof.evidence.verification.workspace.v0.9'
};
const readJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const download = (name, content) => { const blob = new Blob([content], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 0); };

const root = document.querySelector('[data-evidence-verification-root]');
const statusNode = document.querySelector('[data-status]');
const evidenceSelect = document.querySelector('[data-evidence]');
const findingOptions = document.querySelector('[data-finding-options]');
const verifierName = document.querySelector('[data-verifier-name]');
const verifierType = document.querySelector('[data-verifier-type]');
const contactReference = document.querySelector('[data-contact-reference]');

const caseRecord = readJson(KEYS.caseRecord);
const evidenceQueue = readJson(KEYS.evidenceQueue);
let workspace = readJson(KEYS.workspace) || createVerificationWorkspace(caseRecord, evidenceQueue);

function eligibleEvidenceItems() {
  return (evidenceQueue?.items ?? []).filter((item) => (item.extractedFindings ?? []).some((finding) => finding.state === 'confirmed_in_local_file' && finding.sourceConfirmed === true));
}
function selectedEvidence() { return eligibleEvidenceItems().find((item) => item.evidenceId === evidenceSelect.value) ?? null; }
function eligibleFindings(item) { return (item?.extractedFindings ?? []).filter((finding) => finding.state === 'confirmed_in_local_file' && finding.sourceConfirmed === true); }
function saveWorkspace() { saveJson(KEYS.workspace, workspace); }

function populateEvidence() {
  const items = eligibleEvidenceItems();
  evidenceSelect.innerHTML = items.length ? items.map((item) => `<option value="${escapeHtml(item.evidenceId)}">${escapeHtml(item.source?.fileName)} · ${escapeHtml(item.candidateId)}</option>`).join('') : '<option value="">没有已确认来源字段的证据</option>';
  renderFindingOptions();
}
function renderFindingOptions() {
  const findings = eligibleFindings(selectedEvidence());
  findingOptions.innerHTML = findings.length ? `<div class="finding-list">${findings.map((finding) => `<label><input type="checkbox" data-finding-id="${escapeHtml(finding.findingId)}" checked><span><strong>${escapeHtml(finding.field)}</strong><br>${escapeHtml(finding.value)}<br><small>sourceConfirmed=true · evidenceVerified=false</small></span></label>`).join('')}</div>` : '<p class="muted">当前证据没有可交接的已确认来源字段。</p>';
}

function renderTask(task) {
  const ready = task.state === 'holder_export_ready';
  return `<article class="card">
    <h3>${escapeHtml(task.sourceFile.fileName)} · ${escapeHtml(task.verifier.verifierName)}</h3>
    <p>${escapeHtml(task.state)} · requested checks ${task.selectedFindings.length}</p>
    <p><span class="pill">${escapeHtml(task.contentDigest)}</span> <span class="pill danger">verifierIdentityVerified=false</span></p>
    <ul>${task.selectedFindings.map((finding) => `<li>${escapeHtml(finding.field)}: ${escapeHtml(finding.claimedValue)}</li>`).join('')}</ul>
    ${ready ? `<div class="task-actions"><button data-export-handoff="${escapeHtml(task.taskId)}">导出核验任务包</button><button data-export-receipt-template="${escapeHtml(task.taskId)}">导出空白核验回执</button></div>` : `<div class="task-actions"><input data-handoff-phrase="${escapeHtml(task.taskId)}" placeholder="${HANDOFF_CONFIRMATION_TEXT}"><button data-approve-task="${escapeHtml(task.taskId)}">批准导出</button></div>`}
    <p class="muted">外部发送 false · 原文件包含 false · 正式提交 false</p>
  </article>`;
}
function renderReview(review) {
  return `<article class="card outcome-${escapeHtml(review.assessment)}">
    <h3>回执审查：${escapeHtml(review.assessment)}</h3>
    <p>${escapeHtml(review.state)} · ${escapeHtml(review.assessmentClassification)}</p>
    <table><thead><tr><th>字段</th><th>声明值</th><th>观察值</th><th>回执结果</th></tr></thead><tbody>${review.fieldAssessments.map((item) => `<tr><td>${escapeHtml(item.field)}</td><td>${escapeHtml(item.claimedValue)}</td><td>${escapeHtml(item.observedValue || '—')}</td><td>${escapeHtml(item.outcome)}</td></tr>`).join('')}</tbody></table>
    ${review.humanReviewConfirmed ? '<p><span class="pill">humanReviewConfirmed=true</span> <span class="pill danger">evidenceVerified=false</span></p>' : `<div class="review-actions"><input data-review-phrase="${escapeHtml(review.reviewId)}" placeholder="${RECEIPT_REVIEW_CONFIRMATION_TEXT}"><button data-confirm-review="${escapeHtml(review.reviewId)}">确认已人工审查回执</button></div>`}
    <p class="muted">回执真实性 false · 核验方身份 false · 供应商资格决定 false</p>
  </article>`;
}
function render() {
  const model = buildVerificationWorkspaceModel(workspace);
  root.innerHTML = `
    <section class="grid"><article class="panel metric"><strong>${model.counts.tasks}</strong><p>核验任务</p></article><article class="panel metric"><strong>${model.counts.receipts}</strong><p>未验证回执</p></article><article class="panel metric"><strong>${model.counts.pendingReviews}</strong><p>待人工审查</p></article><article class="panel metric"><strong>0</strong><p>已验证证据</p></article></section>
    <section class="panel warning"><strong>固定边界</strong><p>连接器 0 · 自动发送 0 · 核验方身份验证 0 · 回执真实性验证 0 · 已验证证据 0 · 供应商资格决定 0。</p></section>
    <section class="panel"><h2>核验任务</h2>${model.tasks.length ? model.tasks.map(renderTask).join('') : '<p class="muted">尚未建立核验任务。</p>'}</section>
    <section class="panel"><h2>核验回执审查</h2>${model.reviews.length ? model.reviews.map(renderReview).join('') : '<p class="muted">尚未导入核验回执。</p>'}</section>`;

  root.querySelectorAll('[data-approve-task]').forEach((button) => button.addEventListener('click', () => {
    const task = workspace.tasks.find((item) => item.taskId === button.dataset.approveTask);
    const phrase = root.querySelector(`[data-handoff-phrase="${CSS.escape(task.taskId)}"]`)?.value;
    try { workspace = upsertVerificationTask(workspace, approveVerificationHandoff(task, phrase)); saveWorkspace(); statusNode.textContent = '已批准导出核验任务包；未自动发送。'; render(); } catch (error) { statusNode.textContent = error.message; }
  }));
  root.querySelectorAll('[data-export-handoff]').forEach((button) => button.addEventListener('click', () => {
    const task = workspace.tasks.find((item) => item.taskId === button.dataset.exportHandoff);
    download(`tradeproof-verification-handoff-${Date.now()}.json`, JSON.stringify(buildVerificationHandoffPackage(task), null, 2));
    statusNode.textContent = '已导出核验任务包；原文件未包含，未执行外部发送。';
  }));
  root.querySelectorAll('[data-export-receipt-template]').forEach((button) => button.addEventListener('click', () => {
    const task = workspace.tasks.find((item) => item.taskId === button.dataset.exportReceiptTemplate);
    download(`tradeproof-verification-receipt-template-${Date.now()}.json`, JSON.stringify(buildReceiptTemplate(task), null, 2));
    statusNode.textContent = '已导出空白核验回执模板。';
  }));
  root.querySelectorAll('[data-confirm-review]').forEach((button) => button.addEventListener('click', () => {
    const review = workspace.reviews.find((item) => item.reviewId === button.dataset.confirmReview);
    const phrase = root.querySelector(`[data-review-phrase="${CSS.escape(review.reviewId)}"]`)?.value;
    try { workspace = upsertVerificationReview(workspace, confirmVerificationReview(review, phrase)); saveWorkspace(); statusNode.textContent = '已确认人工审查回执；evidenceVerified 仍为 false。'; render(); } catch (error) { statusNode.textContent = error.message; }
  }));
}

evidenceSelect.addEventListener('change', renderFindingOptions);
document.querySelector('[data-create-task]').addEventListener('click', () => {
  const evidence = selectedEvidence();
  const findingIds = [...findingOptions.querySelectorAll('[data-finding-id]:checked')].map((input) => input.dataset.findingId);
  try {
    const task = createVerificationTask(evidence, findingIds, { verifierName: verifierName.value, verifierType: verifierType.value, contactReference: contactReference.value });
    workspace = upsertVerificationTask(workspace, task); saveWorkspace(); statusNode.textContent = '已建立本地核验任务；尚未批准导出。'; render();
  } catch (error) { statusNode.textContent = error.message; }
});
document.querySelector('[data-receipt-files]').addEventListener('change', async (event) => {
  for (const file of [...event.target.files]) {
    try {
      const receipt = JSON.parse(await file.text());
      const task = workspace.tasks.find((item) => item.taskId === receipt.taskId);
      if (!task) throw new Error('receipt task not found in local workspace');
      const errors = validateReceiptAgainstTask(task, receipt);
      if (errors.length) throw new Error(errors.join('; '));
      workspace = upsertVerificationReceipt(workspace, task, receipt);
      workspace = upsertVerificationReview(workspace, createVerificationReview(task, receipt));
      saveWorkspace(); statusNode.textContent = '已导入未验证核验回执；请人工检查 supported / contradicted / inconclusive。';
    } catch (error) { statusNode.textContent = `${file.name}: ${error.message}`; }
  }
  render();
});
document.querySelector('[data-export-workspace]').addEventListener('click', () => {
  const errors = validateVerificationWorkspace(workspace);
  if (errors.length) { statusNode.textContent = errors.join('; '); return; }
  download(`tradeproof-evidence-verification-workspace-${Date.now()}.json`, JSON.stringify(workspace, null, 2));
  statusNode.textContent = '已导出本地核验工作区；未包含原始证据文件。';
});

populateEvidence();
render();
