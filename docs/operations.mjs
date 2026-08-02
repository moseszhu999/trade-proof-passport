import {
  addFileMetadata,
  caseActionQueue,
  createTradeCase,
  decideRequirement,
  exportTradeCase,
  importTradeCase,
  ingestText,
  validateTradeCase
} from './trade-case-core.mjs';

const REGION_ORDER = ['today_market', 'current_case', 'action_queue', 'agent_status', 'risk_close'];
const CASE_STORAGE_KEY = 'tradeproof.trade.case.v0.2';
const LEGACY_CASE_STORAGE_KEY = 'tradeproof.local.case.v0.1';

const CPV_LEARNING = {
  '39100000': {
    title: '医院与机构家具采购入门',
    summary: '先理解产品范围、安装责任、交付地点、材料要求和机构采购文件结构。',
    prompts: ['检查是否包含安装与现场摆放', '区分产品资质与投标主体资质', '确认交付地点和分批交付要求']
  },
  '45314310': {
    title: '高压输电线路项目入门',
    summary: '这是工程与材料混合型机会，通常需要项目资质、施工能力和本地履约条件。',
    prompts: ['确认是否允许分包或联合体', '拆分材料供给与现场施工部分', '审查本地资格、保险与安全要求']
  },
  '45421100': {
    title: '门窗与木作工程机会入门',
    summary: '重点通常在尺寸、现场安装、施工标准、工期和验收责任，不应只按普通商品理解。',
    prompts: ['确认制造与安装是否可拆分', '检查 DIN 或本地施工标准', '确认测量、运输、安装和验收责任']
  },
  '55520000': {
    title: '机构餐饮服务采购入门',
    summary: '这是持续服务而非单次商品交付，需要审查本地运营、人员、卫生和场地条件。',
    prompts: ['确认是否要求本地实体和现场团队', '检查食品卫生与人员要求', '评估中国企业是否只能作为设备或供应链分包方']
  },
  '45234116': {
    title: '铁路轨道施工项目入门',
    summary: '大型基础设施机会通常对经验、资质、安全和本地施工组织有较高门槛。',
    prompts: ['寻找材料或设备分包入口', '确认联合体与历史业绩要求', '检查施工安全与铁路行业资质']
  }
};

function asText(value, fallback = '未知') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function escapeHtml(value) {
  return asText(value, '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function dateOnly(value) {
  const match = asText(value, '').match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '未提取';
}

function daysUntil(deadline, now = new Date()) {
  const normalized = dateOnly(deadline);
  if (normalized === '未提取') return null;
  const target = new Date(`${normalized}T23:59:59Z`);
  if (Number.isNaN(target.valueOf())) return null;
  return Math.ceil((target.valueOf() - now.valueOf()) / 86400000);
}

function urgency(deadline, now) {
  const remaining = daysUntil(deadline, now);
  if (remaining === null) return { label: '截止日期待确认', level: 'unknown', remaining: null };
  if (remaining < 0) return { label: '可能已截止', level: 'overdue', remaining };
  if (remaining <= 3) return { label: `${remaining} 天内截止`, level: 'urgent', remaining };
  if (remaining <= 14) return { label: `${remaining} 天后截止`, level: 'soon', remaining };
  return { label: `${remaining} 天后截止`, level: 'normal', remaining };
}

function countryName(code) {
  return ({ POL: '波兰', GRC: '希腊', DEU: '德国', FRA: '法国' })[code] ?? code ?? '未知国家';
}

export function learningForOpportunity(opportunity) {
  const code = opportunity?.classification?.codes?.[0] ?? null;
  return {
    evidenceClassification: 'agent_guidance',
    officialRequirement: false,
    code,
    ...(CPV_LEARNING[code] ?? {
      title: '当前产品与采购流程入门',
      summary: '先阅读官方通知，区分商品、工程和服务，再判断资格、交付责任与证据要求。',
      prompts: ['阅读完整官方文件', '列出已知、未知和必须澄清项', '判断直接参与、分包或放弃']
    })
  };
}

export { createTradeCase as createLocalCase };

function buildOpportunityQueue(opportunities, now) {
  return opportunities
    .filter((item) => item.participation?.chinaSupplierEligibility === 'unknown')
    .map((item) => {
      const due = urgency(item.dates?.deadlineAt, now);
      return {
        id: `eligibility:${item.source.recordId}`,
        kind: 'eligibility_review',
        title: `判断 ${item.source.recordId} 的参与资格`,
        status: due.level === 'overdue' ? 'overdue' : due.level === 'urgent' ? 'due_soon' : 'open',
        dueLabel: due.label,
        opportunityId: item.opportunityId,
        evidenceClassification: 'source_observation',
        formalWritePerformed: false
      };
    });
}

export function buildOperationsHubModel(collection, { localCase = null, now = new Date() } = {}) {
  if (!collection || !Array.isArray(collection.opportunities)) {
    throw new TypeError('Opportunity collection must contain opportunities[].');
  }
  const opportunities = collection.opportunities.map((item) => ({
    ...item,
    urgency: urgency(item.dates?.deadlineAt, now),
    learning: learningForOpportunity(item)
  }));
  const queueItems = [...caseActionQueue(localCase), ...buildOpportunityQueue(opportunities, now)];
  const urgentCount = opportunities.filter((item) => ['urgent', 'overdue'].includes(item.urgency.level)).length;
  const pendingRequirements = (localCase?.requirementCandidates ?? []).filter((item) => item.humanConfirmationRequired).length;
  const communicationActions = (localCase?.communications ?? []).flatMap((item) => item.actionCandidates ?? []).length;
  const sourceAgeMs = now.valueOf() - new Date(collection.generatedAt).valueOf();
  const stale = Number.isFinite(sourceAgeMs) && sourceAgeMs > 48 * 60 * 60 * 1000;
  const agentItems = [
    {
      id: `collection:${collection.generatedAt}`,
      workflow: 'TED Opportunity collection',
      status: 'completed',
      detail: `${collection.counts?.uniqueOpportunities ?? opportunities.length} 条唯一机会已归一和去重`,
      formalWritePerformed: false
    },
    {
      id: 'eligibility-agent',
      workflow: '跨境资格分析',
      status: 'waiting_human',
      detail: `${opportunities.filter((item) => item.participation?.chinaSupplierEligibility === 'unknown').length} 条机会仍需阅读正式通知`,
      formalWritePerformed: false
    }
  ];
  if (localCase) {
    agentItems.push({
      id: `case-intake:${localCase.caseId}`,
      workflow: '案件资料解析',
      status: pendingRequirements || communicationActions ? 'waiting_human' : 'ready_for_input',
      detail: `${localCase.communications.length} 条文本输入、${localCase.fileReferences.length} 个文件元数据、${pendingRequirements} 条候选要求待确认`,
      formalWritePerformed: false
    });
  }
  return {
    schemaVersion: 'tradeproof.trade-daily-operations-hub.v0.2',
    generatedAt: now.toISOString(),
    sourceGeneratedAt: collection.generatedAt,
    sourceId: collection.sourceId,
    regionOrder: REGION_ORDER,
    todayMarket: {
      state: stale ? 'stale' : opportunities.length ? 'ready' : 'empty',
      sourceOwner: 'opportunity_radar',
      evidenceClassification: 'canonical_source_observation',
      stale,
      opportunities
    },
    currentCase: localCase ? {
      state: 'ready',
      sourceOwner: 'holder_controlled_trade_case',
      evidenceClassification: 'holder_local_record',
      case: localCase
    } : {
      state: 'empty',
      sourceOwner: 'holder_controlled_trade_case',
      evidenceClassification: 'holder_local_record',
      noDataReason: 'no_trade_case_created_or_imported',
      case: null
    },
    actionQueue: {
      state: queueItems.length ? 'ready' : 'empty',
      sourceOwner: 'trade_case_action_projection',
      evidenceClassification: 'derived_review_queue',
      items: queueItems
    },
    agentStatus: {
      state: 'ready',
      sourceOwner: 'bounded_local_agent_projection',
      evidenceClassification: 'agent_execution_summary',
      items: agentItems
    },
    riskClose: {
      state: 'ready',
      sourceOwner: 'daily_operations_projection',
      evidenceClassification: 'bounded_operating_summary',
      urgentCount,
      unresolvedCount: queueItems.length,
      pendingRequirementCount: pendingRequirements,
      communicationActionCount: communicationActions,
      formalDailyLogOwnerConnected: false,
      summary: localCase
        ? `${pendingRequirements} 条候选要求和 ${communicationActions} 条沟通动作仍需人工确认。`
        : urgentCount
          ? `${urgentCount} 条机会临近或超过截止日期，需优先复核。`
          : '尚未建立 Trade Case；参与资格仍不能视为已确认。'
    },
    intelligence: {
      state: 'unavailable',
      sourceOwnersPlanned: ['un_comtrade', 'access2markets', 'wto_eping', 'logistics_signals'],
      noDataReason: 'market_intelligence_connectors_not_yet_connected',
      syntheticTrendGenerated: false
    }
  };
}

function opportunityCard(item, selectedId) {
  const selected = item.opportunityId === selectedId ? ' is-selected' : '';
  return `<button class="opportunity-card${selected}" data-opportunity-id="${escapeHtml(item.opportunityId)}" type="button">
    <span class="opportunity-card__meta">${escapeHtml(countryName(item.buyer?.country))} · ${escapeHtml(item.source?.recordId)}</span>
    <strong>${escapeHtml(item.title)}</strong>
    <small>${escapeHtml(item.buyer?.name)} · ${escapeHtml(item.urgency.label)}</small>
    <em>中国企业资格：${escapeHtml(item.participation?.chinaSupplierEligibility)}</em>
  </button>`;
}

function requirementCard(item) {
  return `<article class="requirement-card is-${escapeHtml(item.status)}">
    <header><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.status)}</span></header>
    <p>${escapeHtml(item.excerpt)}</p>
    <small>${escapeHtml(item.evidenceClassification)} · officialRequirement=${item.officialRequirement}</small>
    ${item.humanConfirmationRequired ? `<div class="actions compact"><button data-requirement-decision="confirm_source_requirement" data-requirement-id="${escapeHtml(item.requirementId)}" type="button">确认来自正式来源</button><button data-requirement-decision="reject_candidate" data-requirement-id="${escapeHtml(item.requirementId)}" type="button">排除误判</button></div>` : ''}
  </article>`;
}

function caseWorkspace(caseRecord) {
  if (!caseRecord) {
    return '<div class="empty"><strong>尚未建立案件</strong><span>从今日市场创建案件，或从本机导入以前导出的 Trade Case JSON。</span></div>';
  }
  const requirements = caseRecord.requirementCandidates ?? [];
  const communications = caseRecord.communications ?? [];
  const files = caseRecord.fileReferences ?? [];
  return `<div class="case-workspace">
    <article class="case-card">
      <header><div><small>持有者本地记录 · formalWritePerformed=false</small><h3>${escapeHtml(caseRecord.title)}</h3></div><span>${escapeHtml(caseRecord.stage)}</span></header>
      <dl><div><dt>Case ID</dt><dd>${escapeHtml(caseRecord.caseId)}</dd></div><div><dt>来源</dt><dd>${escapeHtml(caseRecord.sourceOpportunity.recordId)}</dd></div><div><dt>候选要求</dt><dd>${requirements.length}</dd></div><div><dt>文本输入</dt><dd>${communications.length}</dd></div><div><dt>文件引用</dt><dd>${files.length}</dd></div><div><dt>服务器持久化</dt><dd>否</dd></div></dl>
      <div class="actions"><button id="export-trade-case" type="button">导出 Trade Case JSON</button></div>
      <small>案件保存在当前浏览器；导出文件可备份或转移。外部消息未发送，文件内容未读取。</small>
    </article>
    <div class="intake-grid">
      <form id="official-notice-intake" class="intake-card">
        <small>OFFICIAL SOURCE INTAKE</small><h3>导入正式通知正文</h3>
        <input name="title" placeholder="通知标题或章节，例如 Eligibility requirements">
        <textarea name="text" required placeholder="粘贴正式通知中的关键段落。系统只生成候选要求，必须由你确认。"></textarea>
        <button type="submit">本地解析候选要求</button>
      </form>
      <form id="communication-intake" class="intake-card">
        <small>EMAIL / MESSAGE INTAKE</small><h3>导入邮件或消息</h3>
        <input name="title" placeholder="主题，例如 Buyer clarification reply">
        <textarea name="text" required placeholder="粘贴邮件或消息。可能包含个人数据，仅保存在当前浏览器。"></textarea>
        <button type="submit">本地提取待办候选</button>
      </form>
      <form id="file-metadata-intake" class="intake-card">
        <small>FILE METADATA ONLY</small><h3>登记本地文件</h3>
        <input name="files" type="file" multiple>
        <p>只记录文件名、类型、大小和修改时间；不读取、不上传文件内容。</p>
        <button type="submit">登记文件元数据</button>
      </form>
    </div>
    <section class="case-subsection"><header><h3>候选要求</h3><span>${requirements.filter((item) => item.humanConfirmationRequired).length} 待确认</span></header><div class="requirement-list">${requirements.map(requirementCard).join('') || '<p>导入正式通知文本后，在此显示候选要求。</p>'}</div></section>
    <section class="case-subsection"><header><h3>沟通输入</h3><span>${communications.length}</span></header><div class="compact-list">${communications.map((item) => `<article><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.kind)} · ${escapeHtml(item.observedAt)}</small><p>${escapeHtml(item.text.slice(0, 240))}${item.text.length > 240 ? '…' : ''}</p><em>${(item.actionCandidates ?? []).length} 条待办候选</em></article>`).join('') || '<p>尚未导入邮件或消息。</p>'}</div></section>
    <section class="case-subsection"><header><h3>文件引用</h3><span>${files.length}</span></header><div class="compact-list">${files.map((file) => `<article><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.mimeType)} · ${file.size} bytes</small><em>contentRead=false · uploaded=false</em></article>`).join('') || '<p>尚未登记本地文件。</p>'}</div></section>
  </div>`;
}

export function renderOperationsHub(root, model, selectedId = null) {
  const selected = model.todayMarket.opportunities.find((item) => item.opportunityId === selectedId)
    ?? model.todayMarket.opportunities[0]
    ?? null;
  root.innerHTML = `
    <header class="hub-hero"><div><p>TRADE DAILY OPERATIONS HUB</p><h1>今日运营</h1><span>市场发现、案件推进、资料输入、Agent、学习与日终收尾</span></div><aside><strong>来源边界</strong><span>${escapeHtml(model.sourceId)} · ${escapeHtml(model.sourceGeneratedAt)}</span><small>公开观察不等于资格确认、买方背书或交易承诺</small></aside></header>
    <section class="hub-region" id="today-market"><header><div><small>A · TODAY</small><h2>今日市场</h2></div><span class="state is-${escapeHtml(model.todayMarket.state)}">${escapeHtml(model.todayMarket.state)}</span></header>
      <div class="market-layout"><div class="opportunity-list">${model.todayMarket.opportunities.map((item) => opportunityCard(item, selected?.opportunityId)).join('')}</div><article class="detail-panel">${selected ? `<small>${escapeHtml(selected.source.recordId)} · ${escapeHtml(countryName(selected.buyer.country))}</small><h3>${escapeHtml(selected.title)}</h3><dl><div><dt>买方</dt><dd>${escapeHtml(selected.buyer.name)}</dd></div><div><dt>截止</dt><dd>${escapeHtml(dateOnly(selected.dates.deadlineAt))}</dd></div><div><dt>CPV</dt><dd>${escapeHtml(selected.classification.codes.join(', '))}</dd></div><div><dt>资格</dt><dd>待正式文件审查</dd></div></dl><div class="actions"><a href="${escapeHtml(selected.source.url)}" target="_blank" rel="noreferrer">打开官方通知</a><button id="create-local-case" type="button">建立持有者本地案件</button></div><p class="boundary">Observed from public source · Not independently verified</p>` : '<p>当前没有机会数据。</p>'}</article></div>
    </section>
    <section class="hub-region" id="current-case"><header><div><small>B · CASE</small><h2>当前案件与资料</h2></div><span class="state is-${escapeHtml(model.currentCase.state)}">${escapeHtml(model.currentCase.state)}</span></header>${caseWorkspace(model.currentCase.case)}</section>
    <div class="two-column">
      <section class="hub-region" id="action-queue"><header><div><small>C · QUEUE</small><h2>待处理事项</h2></div><span class="state is-${escapeHtml(model.actionQueue.state)}">${escapeHtml(model.actionQueue.state)}</span></header><div class="queue-list">${model.actionQueue.items.slice(0, 16).map((item) => `<article><header><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.status)}</span></header><small>${escapeHtml(item.dueLabel)} · ${escapeHtml(item.evidenceClassification)}</small></article>`).join('') || '<p>暂无待办。</p>'}</div></section>
      <section class="hub-region" id="agent-status"><header><div><small>D · AGENT</small><h2>Agent 状态</h2></div><span class="state is-ready">ready</span></header>${model.agentStatus.items.map((item) => `<article class="agent-card"><header><strong>${escapeHtml(item.workflow)}</strong><span>${escapeHtml(item.status)}</span></header><p>${escapeHtml(item.detail)}</p><small>formalWritePerformed=false</small></article>`).join('')}</section>
    </div>
    <section class="hub-region" id="risk-close"><header><div><small>E · CLOSE</small><h2>风险与今日收尾</h2></div><span class="state is-ready">ready</span></header><article class="close-card"><strong>${escapeHtml(model.riskClose.summary)}</strong><dl><div><dt>紧急机会</dt><dd>${model.riskClose.urgentCount}</dd></div><div><dt>未解决待办</dt><dd>${model.riskClose.unresolvedCount}</dd></div><div><dt>候选要求待确认</dt><dd>${model.riskClose.pendingRequirementCount}</dd></div><div><dt>沟通动作候选</dt><dd>${model.riskClose.communicationActionCount}</dd></div><div><dt>正式 Daily Log</dt><dd>未接入</dd></div></dl><small>缺失不会被解释为 0、已完成或无风险。</small></article></section>
    <section class="hub-region learning-region" id="learning-intelligence"><header><div><small>LEARN · INTELLIGENCE</small><h2>边做边学</h2></div><span class="state is-unavailable">情报源待接入</span></header>${selected ? `<div class="learning-grid"><article><small>Agent guidance · 非官方要求</small><h3>${escapeHtml(selected.learning.title)}</h3><p>${escapeHtml(selected.learning.summary)}</p><ul>${selected.learning.prompts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article><small>最新外部情报</small><h3>尚未接入正式源</h3><p>UN Comtrade、Access2Markets、WTO ePing 和物流信号连接前，不生成虚假的趋势、关税或法规结论。</p></article></div>` : '<p>选择一条机会后显示案件相关学习提示。</p>'}</section>`;
  return selected?.opportunityId ?? null;
}

function downloadJson(filename, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function boot() {
  const root = document.querySelector('[data-trade-operations-root]');
  if (!root) return;
  const status = document.querySelector('[data-load-status]');
  const opportunityFileInput = document.querySelector('#local-collection-file');
  const caseFileInput = document.querySelector('#local-case-file');
  let collection;
  let model;
  let selectedId = null;
  let localCase = null;

  const persistCase = async (nextCase) => {
    if (!nextCase) return;
    const errors = await validateTradeCase(nextCase);
    if (errors.length) throw new Error(errors.join('; '));
    localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(nextCase));
    localCase = nextCase;
  };

  try {
    const stored = localStorage.getItem(CASE_STORAGE_KEY);
    if (stored) localCase = await importTradeCase(stored);
  } catch (error) {
    localStorage.removeItem(CASE_STORAGE_KEY);
    if (status) status.textContent = `已忽略损坏的本地案件：${error.message}`;
  }

  const refresh = () => {
    model = buildOperationsHubModel(collection, { localCase });
    selectedId = renderOperationsHub(root, model, selectedId);
    root.querySelectorAll('[data-opportunity-id]').forEach((button) => button.addEventListener('click', () => {
      selectedId = button.dataset.opportunityId;
      refresh();
    }));
    root.querySelector('#create-local-case')?.addEventListener('click', async () => {
      const selected = model.todayMarket.opportunities.find((item) => item.opportunityId === selectedId);
      if (!selected) return;
      await persistCase(await createTradeCase(selected));
      localStorage.removeItem(LEGACY_CASE_STORAGE_KEY);
      refresh();
    });
    root.querySelector('#export-trade-case')?.addEventListener('click', async () => {
      if (!localCase) return;
      downloadJson(`${localCase.caseId.replace(/[^a-z0-9_-]+/gi, '-')}.json`, await exportTradeCase(localCase));
    });
    root.querySelector('#official-notice-intake')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      await persistCase(await ingestText(localCase, { kind: 'official_notice_text', title: data.get('title'), text: data.get('text') }));
      refresh();
    });
    root.querySelector('#communication-intake')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      await persistCase(await ingestText(localCase, { kind: 'email_or_message_text', title: data.get('title'), text: data.get('text') }));
      refresh();
    });
    root.querySelector('#file-metadata-intake')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const files = event.currentTarget.elements.files.files;
      await persistCase(await addFileMetadata(localCase, files));
      refresh();
    });
    root.querySelectorAll('[data-requirement-decision]').forEach((button) => button.addEventListener('click', async () => {
      await persistCase(await decideRequirement(localCase, button.dataset.requirementId, button.dataset.requirementDecision));
      refresh();
    }));
  };

  const loadCollection = async (input) => {
    if (!Array.isArray(input?.opportunities)) throw new Error('Opportunity collection must contain opportunities[].');
    collection = input;
    if (!localCase) {
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_CASE_STORAGE_KEY) || 'null');
        const opportunity = input.opportunities.find((item) => item.opportunityId === legacy?.sourceOpportunityId);
        if (legacy && opportunity) await persistCase(await createTradeCase(opportunity, new Date(legacy.createdAt)));
      } catch { /* legacy draft remains ignored */ }
    }
    refresh();
    if (status) status.textContent = `${collection.counts?.uniqueOpportunities ?? collection.opportunities.length} 条机会已载入`;
  };

  try {
    const response = await fetch('./data/opportunity-radar-latest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await loadCollection(await response.json());
  } catch (error) {
    root.innerHTML = `<div class="fatal"><strong>机会数据加载失败</strong><span>${escapeHtml(error.message)}</span></div>`;
  }

  opportunityFileInput?.addEventListener('change', async () => {
    const [file] = opportunityFileInput.files;
    if (!file) return;
    await loadCollection(JSON.parse(await file.text()));
  });

  caseFileInput?.addEventListener('change', async () => {
    const [file] = caseFileInput.files;
    if (!file) return;
    await persistCase(await importTradeCase(await file.text()));
    selectedId = localCase.sourceOpportunity.opportunityId;
    refresh();
    if (status) status.textContent = `已导入案件 ${localCase.caseId}`;
  });
}

if (typeof document !== 'undefined') void boot();
