const drawer = document.querySelector('[data-trade-agent-drawer]');
const mask = document.querySelector('[data-trade-agent-mask]');
const sidebar = document.querySelector('.trade-ops-sidebar');
const sidebarMask = document.querySelector('[data-trade-sidebar-mask]');
const queryInput = document.querySelector('[data-trade-agent-query]');
const output = document.querySelector('[data-trade-agent-output]');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function currentContext() {
  const selected = document.querySelector('.opportunity-card.is-selected');
  const caseCard = document.querySelector('.case-card');
  const loadStatus = document.querySelector('[data-load-status]');
  return {
    opportunity: selected?.querySelector('strong')?.textContent?.trim() || 'not_selected',
    caseContext: caseCard?.querySelector('h3')?.textContent?.trim() || 'not_loaded',
    runtime: loadStatus?.textContent?.trim() || 'UNKNOWN',
  };
}

function proposalFor(query) {
  const normalized = query.toLowerCase();
  let intent = 'inspect_case_context';
  let artifact = 'read_only_explanation';
  let confirmation = 'none_read_only';

  if (/材料|补充|request/.test(normalized)) {
    intent = 'prepare_material_request';
    artifact = 'draft_request_only';
    confirmation = 'holder_review_required_before_export';
  } else if (/证据|缺口|evidence/.test(normalized)) {
    intent = 'inspect_evidence_gaps';
    artifact = 'candidate_gap_list';
  } else if (/决定|供应商|decision|shortlist|award/.test(normalized)) {
    intent = 'prepare_human_decision_review';
    artifact = 'decision_review_draft';
    confirmation = 'trusted_holder_required';
  } else if (/核验|verification|外部/.test(normalized)) {
    intent = 'prepare_external_verification_handoff';
    artifact = 'verification_task_draft';
    confirmation = 'exact_disclosure_approval_required';
  } else if (/not_observable|可观测|未知|unknown/.test(normalized)) {
    intent = 'explain_observability_limits';
    artifact = 'read_only_observability_report';
  }

  return {
    query,
    intent,
    artifact,
    confirmation,
    context: currentContext(),
  };
}

function renderProposal(proposal) {
  if (!output) return;
  output.innerHTML = `
    <section class="trade-agent-proposal" aria-live="polite">
      <h3>Bounded proposal</h3>
      <dl>
        <dt>Intent</dt><dd>${escapeHtml(proposal.intent)}</dd>
        <dt>Opportunity</dt><dd>${escapeHtml(proposal.context.opportunity)}</dd>
        <dt>Case</dt><dd>${escapeHtml(proposal.context.caseContext)}</dd>
        <dt>Runtime</dt><dd>${escapeHtml(proposal.context.runtime)}</dd>
        <dt>Draft artifact</dt><dd>${escapeHtml(proposal.artifact)}</dd>
        <dt>Confirmation</dt><dd>${escapeHtml(proposal.confirmation)}</dd>
        <dt>Persistence</dt><dd>draft_only · formalBusinessWritePerformed=false</dd>
      </dl>
      <div class="trade-agent-boundary">
        Agent 文本不构成 proof、authority、eligibility、shortlist、award、法律接受、融资批准、付款或结算。任何导出、披露、人工决定或外部执行都必须进入现有确定性对象和 holder confirmation。
      </div>
    </section>`;
}

function openDrawer() {
  drawer?.classList.add('is-open');
  drawer?.setAttribute('aria-hidden', 'false');
  mask?.classList.add('is-open');
  window.setTimeout(() => queryInput?.focus(), 30);
}

function closeDrawer() {
  drawer?.classList.remove('is-open');
  drawer?.setAttribute('aria-hidden', 'true');
  mask?.classList.remove('is-open');
}

function openSidebar() {
  sidebar?.classList.add('is-open');
  sidebarMask?.classList.add('is-open');
}

function closeSidebar() {
  sidebar?.classList.remove('is-open');
  sidebarMask?.classList.remove('is-open');
}

document.querySelector('[data-trade-agent-open]')?.addEventListener('click', openDrawer);
document.querySelector('[data-trade-agent-close]')?.addEventListener('click', closeDrawer);
mask?.addEventListener('click', closeDrawer);
document.querySelector('[data-trade-menu]')?.addEventListener('click', openSidebar);
sidebarMask?.addEventListener('click', closeSidebar);

document.querySelectorAll('[data-trade-prompt]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!queryInput) return;
    queryInput.value = button.dataset.tradePrompt || '';
    renderProposal(proposalFor(queryInput.value));
  });
});

document.querySelector('[data-trade-agent-form]')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = queryInput?.value.trim();
  if (!query) return;
  renderProposal(proposalFor(query));
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openDrawer();
  }
  if (event.key === 'Escape') {
    closeDrawer();
    closeSidebar();
  }
});
