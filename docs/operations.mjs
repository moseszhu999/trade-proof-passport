const REGION_ORDER = [
  'today_market',
  'current_case',
  'action_queue',
  'agent_status',
  'risk_close'
];

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

function dateOnly(value) {
  const text = asText(value, '');
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
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

export function createLocalCase(opportunity, now = new Date()) {
  if (!opportunity?.opportunityId) throw new Error('A canonical Opportunity is required.');
  return {
    caseId: `local-case:${opportunity.source.recordId}`,
    sourceOpportunityId: opportunity.opportunityId,
    title: opportunity.title,
    stage: 'qualification_review',
    state: 'local_draft',
    createdAt: now.toISOString(),
    formalWritePerformed: false,
    nextActions: [
      '打开官方通知并读取完整资格要求',
      '判断中国企业是直接参与、联合体、分包还是不适用',
      '记录需要的资质、文件、交付地点和截止时间'
    ]
  };
}

function buildQueue(opportunities, localCase, now) {
  const items = opportunities
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
  if (localCase) {
    items.unshift({
      id: `case:${localCase.caseId}`,
      kind: 'case_next_action',
      title: '推进当前本地跟进案件',
      status: 'waiting_confirmation',
      dueLabel: '今天',
      opportunityId: localCase.sourceOpportunityId,
      evidenceClassification: 'local_user_draft',
      formalWritePerformed: false
    });
  }
  return items;
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
  const queueItems = buildQueue(opportunities, localCase, now);
  const urgentCount = opportunities.filter((item) => ['urgent', 'overdue'].includes(item.urgency.level)).length;
  const sourceAgeMs = now.valueOf() - new Date(collection.generatedAt).valueOf();
  const stale = Number.isFinite(sourceAgeMs) && sourceAgeMs > 48 * 60 * 60 * 1000;
  return {
    schemaVersion: 'tradeproof.trade-daily-operations-hub.v0.1',
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
      sourceOwner: 'local_case_draft',
      evidenceClassification: 'local_user_draft',
      case: localCase
    } : {
      state: 'empty',
      sourceOwner: 'local_case_draft',
      evidenceClassification: 'local_user_draft',
      noDataReason: 'no_local_case_created',
      case: null
    },
    actionQueue: {
      state: queueItems.length ? 'ready' : 'empty',
      sourceOwner: 'opportunity_review_projection',
      evidenceClassification: 'derived_review_queue',
      items: queueItems
    },
    agentStatus: {
      state: 'ready',
      sourceOwner: 'opportunity_radar_workflow',
      evidenceClassification: 'agent_execution_summary',
      items: [
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
          detail: `${queueItems.filter((item) => item.kind === 'eligibility_review').length} 条机会仍需阅读正式通知`,
          formalWritePerformed: false
        }
      ]
    },
    riskClose: {
      state: 'ready',
      sourceOwner: 'daily_operations_projection',
      evidenceClassification: 'bounded_operating_summary',
      urgentCount,
      unresolvedCount: queueItems.length,
      formalDailyLogOwnerConnected: false,
      summary: urgentCount
        ? `${urgentCount} 条机会临近或超过截止日期，需优先复核。`
        : '当前快照中没有三天内截止的机会；参与资格仍不能视为已确认。'
    },
    intelligence: {
      state: 'unavailable',
      sourceOwnersPlanned: ['un_comtrade', 'access2markets', 'wto_eping', 'logistics_signals'],
      noDataReason: 'market_intelligence_connectors_not_yet_connected',
      syntheticTrendGenerated: false
    }
  };
}

function escapeHtml(value) {
  return asText(value, '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function countryName(code) {
  return ({ POL: '波兰', GRC: '希腊', DEU: '德国', FRA: '法国' })[code] ?? code ?? '未知国家';
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

export function renderOperationsHub(root, model, selectedId = null) {
  const selected = model.todayMarket.opportunities.find((item) => item.opportunityId === selectedId)
    ?? model.todayMarket.opportunities[0]
    ?? null;
  root.innerHTML = `
    <header class="hub-hero">
      <div><p>TRADE DAILY OPERATIONS HUB</p><h1>今日运营</h1><span>市场发现、案件推进、Agent、学习与日终收尾</span></div>
      <aside><strong>来源边界</strong><span>${escapeHtml(model.sourceId)} · ${escapeHtml(model.sourceGeneratedAt)}</span><small>公开观察不等于资格确认、买方背书或交易承诺</small></aside>
    </header>
    <section class="hub-region" id="today-market"><header><div><small>A · TODAY</small><h2>今日市场</h2></div><span class="state is-${escapeHtml(model.todayMarket.state)}">${escapeHtml(model.todayMarket.state)}</span></header>
      <div class="market-layout"><div class="opportunity-list">${model.todayMarket.opportunities.map((item) => opportunityCard(item, selected?.opportunityId)).join('')}</div>
      <article class="detail-panel">${selected ? `
        <small>${escapeHtml(selected.source.recordId)} · ${escapeHtml(countryName(selected.buyer.country))}</small>
        <h3>${escapeHtml(selected.title)}</h3>
        <dl><div><dt>买方</dt><dd>${escapeHtml(selected.buyer.name)}</dd></div><div><dt>截止</dt><dd>${escapeHtml(dateOnly(selected.dates.deadlineAt))}</dd></div><div><dt>CPV</dt><dd>${escapeHtml(selected.classification.codes.join(', '))}</dd></div><div><dt>资格</dt><dd>待正式文件审查</dd></div></dl>
        <div class="actions"><a href="${escapeHtml(selected.source.url)}" target="_blank" rel="noreferrer">打开官方通知</a><button id="create-local-case" type="button">建立本地跟进案件</button></div>
        <p class="boundary">Observed from public source · Not independently verified</p>` : '<p>当前没有机会数据。</p>'}</article></div>
    </section>
    <div class="two-column">
      <section class="hub-region" id="current-case"><header><div><small>B · CASE</small><h2>当前案件</h2></div><span class="state is-${escapeHtml(model.currentCase.state)}">${escapeHtml(model.currentCase.state)}</span></header>
        ${model.currentCase.case ? `<article class="case-card"><small>本地草稿 · formalWritePerformed=false</small><h3>${escapeHtml(model.currentCase.case.title)}</h3><strong>阶段：资格审查</strong><ol>${model.currentCase.case.nextActions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol></article>` : '<div class="empty"><strong>尚未建立案件</strong><span>从今日市场选择一条机会建立本地草稿；数据只保存在当前浏览器。</span></div>'}
      </section>
      <section class="hub-region" id="action-queue"><header><div><small>C · QUEUE</small><h2>待处理事项</h2></div><span class="state is-${escapeHtml(model.actionQueue.state)}">${escapeHtml(model.actionQueue.state)}</span></header>
        <div class="queue-list">${model.actionQueue.items.slice(0, 8).map((item) => `<article><header><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.status)}</span></header><small>${escapeHtml(item.dueLabel)} · ${escapeHtml(item.evidenceClassification)}</small></article>`).join('') || '<p>暂无待办。</p>'}</div>
      </section>
    </div>
    <div class="two-column">
      <section class="hub-region" id="agent-status"><header><div><small>D · AGENT</small><h2>Agent 状态</h2></div><span class="state is-ready">ready</span></header>
        ${model.agentStatus.items.map((item) => `<article class="agent-card"><header><strong>${escapeHtml(item.workflow)}</strong><span>${escapeHtml(item.status)}</span></header><p>${escapeHtml(item.detail)}</p><small>formalWritePerformed=false</small></article>`).join('')}
      </section>
      <section class="hub-region" id="risk-close"><header><div><small>E · CLOSE</small><h2>风险与今日收尾</h2></div><span class="state is-ready">ready</span></header>
        <article class="close-card"><strong>${escapeHtml(model.riskClose.summary)}</strong><dl><div><dt>紧急机会</dt><dd>${model.riskClose.urgentCount}</dd></div><div><dt>未解决待办</dt><dd>${model.riskClose.unresolvedCount}</dd></div><div><dt>正式 Daily Log</dt><dd>未接入</dd></div></dl><small>缺失不会被解释为 0、已完成或无风险。</small></article>
      </section>
    </div>
    <section class="hub-region learning-region" id="learning-intelligence"><header><div><small>LEARN · INTELLIGENCE</small><h2>边做边学</h2></div><span class="state is-unavailable">情报源待接入</span></header>
      ${selected ? `<div class="learning-grid"><article><small>Agent guidance · 非官方要求</small><h3>${escapeHtml(selected.learning.title)}</h3><p>${escapeHtml(selected.learning.summary)}</p><ul>${selected.learning.prompts.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article><article><small>最新外部情报</small><h3>尚未接入正式源</h3><p>UN Comtrade、Access2Markets、WTO ePing 和物流信号连接前，不生成虚假的趋势、关税或法规结论。</p></article></div>` : '<p>选择一条机会后显示案件相关学习提示。</p>'}
    </section>`;
  return selected?.opportunityId ?? null;
}

async function boot() {
  const root = document.querySelector('[data-trade-operations-root]');
  if (!root) return;
  const status = document.querySelector('[data-load-status]');
  const fileInput = document.querySelector('#local-collection-file');
  let collection;
  let model;
  let selectedId = null;
  let localCase = null;

  const readStoredCase = () => {
    try { return JSON.parse(localStorage.getItem('tradeproof.local.case.v0.1') || 'null'); }
    catch { return null; }
  };
  localCase = readStoredCase();

  const refresh = () => {
    model = buildOperationsHubModel(collection, { localCase });
    selectedId = renderOperationsHub(root, model, selectedId);
    root.querySelectorAll('[data-opportunity-id]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedId = button.dataset.opportunityId;
        refresh();
      });
    });
    root.querySelector('#create-local-case')?.addEventListener('click', () => {
      const selected = model.todayMarket.opportunities.find((item) => item.opportunityId === selectedId);
      if (!selected) return;
      localCase = createLocalCase(selected);
      localStorage.setItem('tradeproof.local.case.v0.1', JSON.stringify(localCase));
      refresh();
    });
  };

  const loadCollection = async (input) => {
    collection = input;
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

  fileInput?.addEventListener('change', async () => {
    const [file] = fileInput.files;
    if (!file) return;
    await loadCollection(JSON.parse(await file.text()));
  });
}

if (typeof document !== 'undefined') void boot();
