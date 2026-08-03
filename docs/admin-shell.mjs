const ROLE_STORAGE_KEY = 'tradeproof.ui.role.v1';
const CASE_KEYS = ['tradeproof.trade.case.v0.2', 'tradeproof.local.case.v0.1'];

const STORAGE_OWNERS = [
  ['case', '贸易案件', ['tradeproof.trade.case.v0.2', 'tradeproof.local.case.v0.1']],
  ['supplier-review', '供应商候选', ['tradeproof.supplier.review.v0.4']],
  ['supplier-responses', '供应商回复', ['tradeproof.supplier.response.request.v0.5', 'tradeproof.supplier.responses.v0.5']],
  ['outreach', '外联准备', ['tradeproof.supplier.contact.book.v0.6', 'tradeproof.supplier.outreach.drafts.v0.6']],
  ['communications', '沟通记录', ['tradeproof.inbound.communication.timeline.v0.7']],
  ['evidence', '供应商证据', ['tradeproof.supplier.evidence.queue.v0.8']],
  ['verification', '外部核验', ['tradeproof.evidence.verification.workspace.v0.9']],
  ['decisions', '人工决定', ['tradeproof.supplier.decision.workspace.v1.0']]
];

const ROLES = {
  buyer_lead: {
    label: '采购项目负责人',
    short: '采购负责人',
    description: '管理机会、案件、供应商协同、证据审查和本地案件推进决定。'
  },
  supplier_coordinator: {
    label: '供应商协同专员',
    short: '供应商协同',
    description: '维护候选、回复、外联草稿、入站沟通和供应商提交的本地证据。'
  },
  evidence_reviewer: {
    label: '证据审查员',
    short: '证据审查',
    description: '查看案件要求、审查证据、组织核验交接并读取决定依据。'
  },
  external_verifier: {
    label: '外部核验员',
    short: '外部核验',
    description: '读取受控字段与摘要，准备核验回执；不获得供应商决定权限。'
  },
  administrator: {
    label: '系统管理员',
    short: '管理员',
    description: '查看全部演示菜单与权限矩阵；当前仍不是生产账户或服务器鉴权。'
  }
};

const LEVELS = {
  none: { label: '不显示', tone: 'muted' },
  view: { label: '查看', tone: 'read' },
  local_edit: { label: '本地编辑', tone: 'write' },
  local_export: { label: '本地导出', tone: 'export' },
  local_decide: { label: '本地决定', tone: 'decision' },
  administer_view: { label: '管理视图', tone: 'admin' }
};

const PERMISSIONS = {
  today:             { buyer_lead:'view', supplier_coordinator:'view', evidence_reviewer:'view', external_verifier:'view', administrator:'administer_view' },
  opportunities:     { buyer_lead:'view', supplier_coordinator:'view', evidence_reviewer:'view', external_verifier:'none', administrator:'administer_view' },
  case_overview:     { buyer_lead:'local_edit', supplier_coordinator:'view', evidence_reviewer:'view', external_verifier:'view', administrator:'administer_view' },
  requirements:      { buyer_lead:'local_edit', supplier_coordinator:'local_edit', evidence_reviewer:'view', external_verifier:'view', administrator:'administer_view' },
  supplier_candidates:{ buyer_lead:'local_edit', supplier_coordinator:'local_edit', evidence_reviewer:'view', external_verifier:'none', administrator:'administer_view' },
  supplier_responses:{ buyer_lead:'view', supplier_coordinator:'local_edit', evidence_reviewer:'view', external_verifier:'none', administrator:'administer_view' },
  supplier_outreach: { buyer_lead:'local_export', supplier_coordinator:'local_export', evidence_reviewer:'none', external_verifier:'none', administrator:'administer_view' },
  communications:    { buyer_lead:'local_edit', supplier_coordinator:'local_edit', evidence_reviewer:'view', external_verifier:'none', administrator:'administer_view' },
  evidence:          { buyer_lead:'view', supplier_coordinator:'local_edit', evidence_reviewer:'local_edit', external_verifier:'view', administrator:'administer_view' },
  verification:      { buyer_lead:'view', supplier_coordinator:'view', evidence_reviewer:'local_export', external_verifier:'local_edit', administrator:'administer_view' },
  decisions:         { buyer_lead:'local_decide', supplier_coordinator:'none', evidence_reviewer:'view', external_verifier:'none', administrator:'administer_view' },
  learning:          { buyer_lead:'view', supplier_coordinator:'view', evidence_reviewer:'view', external_verifier:'view', administrator:'administer_view' },
  permissions:       { buyer_lead:'none', supplier_coordinator:'none', evidence_reviewer:'none', external_verifier:'none', administrator:'administer_view' },
  integrations:      { buyer_lead:'none', supplier_coordinator:'none', evidence_reviewer:'none', external_verifier:'none', administrator:'administer_view' }
};

const MENU = [
  { id:'work', label:'今日工作', icon:'◫', children:[
    { id:'today', label:'运营总览', href:'./operations.html', title:'今日工作 / 运营总览' }
  ]},
  { id:'market', label:'市场机会', icon:'◎', children:[
    { id:'opportunities', label:'机会雷达', href:'./operations.html#today-market', title:'市场机会 / 机会雷达' }
  ]},
  { id:'cases', label:'贸易案件', icon:'▣', children:[
    { id:'case_overview', label:'当前案件', href:'./operations.html#current-case', title:'贸易案件 / 当前案件' },
    { id:'requirements', label:'需求与材料', href:'./document-intake.html', title:'贸易案件 / 需求与材料' }
  ]},
  { id:'suppliers', label:'供应商', icon:'◇', children:[
    { id:'supplier_candidates', label:'候选供应商', href:'./suppliers.html', title:'供应商 / 候选供应商' },
    { id:'supplier_responses', label:'回复管理', href:'./supplier-responses.html', title:'供应商 / 回复管理' },
    { id:'supplier_outreach', label:'外联准备', href:'./supplier-outreach.html', title:'供应商 / 外联准备' }
  ]},
  { id:'communications-group', label:'沟通', icon:'✉', children:[
    { id:'communications', label:'入站通信', href:'./inbound-communications.html', title:'沟通 / 入站通信' }
  ]},
  { id:'evidence-group', label:'证据', icon:'▤', children:[
    { id:'evidence', label:'证据队列', href:'./supplier-evidence.html', title:'证据 / 供应商证据队列' }
  ]},
  { id:'verification-group', label:'核验', icon:'✓', children:[
    { id:'verification', label:'外部核验', href:'./evidence-verification.html', title:'核验 / 外部核验交接' }
  ]},
  { id:'decisions-group', label:'决定', icon:'◆', children:[
    { id:'decisions', label:'供应商案件决定', href:'./supplier-decisions.html', title:'决定 / 供应商案件决定' }
  ]},
  { id:'learning-group', label:'学习与情报', icon:'✦', children:[
    { id:'learning', label:'产品与行业提示', href:'./operations.html#learning', title:'学习与情报 / 产品与行业提示' }
  ]},
  { id:'system', label:'系统管理', icon:'⚙', children:[
    { id:'permissions', label:'角色权限矩阵', action:'permissions', title:'系统管理 / 角色权限矩阵' },
    { id:'integrations', label:'集成状态', action:'integrations', title:'系统管理 / 集成状态' }
  ]}
];

const root = document.querySelector('#tradeos-admin-root');
let currentRole = localStorage.getItem(ROLE_STORAGE_KEY) || 'buyer_lead';
if (!ROLES[currentRole]) currentRole = 'buyer_lead';
let activeView = new URLSearchParams(location.search).get('view') || 'today';
let mobileOpen = false;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

function readCurrentCase() {
  for (const key of CASE_KEYS) {
    const value = readJson(key);
    if (value) return value;
  }
  return null;
}

function permissionFor(viewId, role = currentRole) {
  return PERMISSIONS[viewId]?.[role] || 'none';
}

function visibleChildren(group) {
  return group.children.filter((item) => permissionFor(item.id) !== 'none');
}

function findView(viewId) {
  return MENU.flatMap((group) => group.children).find((item) => item.id === viewId) || null;
}

function firstVisibleView() {
  return MENU.flatMap((group) => visibleChildren(group)).find((item) => item.href)?.id || 'today';
}

function normalizeActiveView() {
  const view = findView(activeView);
  if (!view || permissionFor(activeView) === 'none' || !view.href) activeView = firstVisibleView();
}

function roleOptions() {
  return Object.entries(ROLES).map(([id, role]) => `<option value="${id}" ${id === currentRole ? 'selected' : ''}>${escapeHtml(role.label)}</option>`).join('');
}

function renderMenu() {
  return MENU.map((group) => {
    const children = visibleChildren(group);
    if (!children.length) return '';
    return `<section class="admin-nav__group" data-menu-group="${group.id}">
      <button class="admin-nav__group-title" type="button" data-toggle-group="${group.id}" aria-expanded="true">
        <span class="admin-nav__icon" aria-hidden="true">${group.icon}</span>
        <strong>${escapeHtml(group.label)}</strong><span class="admin-nav__chevron">⌄</span>
      </button>
      <div class="admin-nav__children">
        ${children.map((item) => {
          const level = permissionFor(item.id);
          const active = activeView === item.id ? ' is-active' : '';
          return `<button type="button" class="admin-nav__item${active}" data-view="${item.id}" ${item.action ? `data-action="${item.action}"` : ''}>
            <span>${escapeHtml(item.label)}</span><small class="permission-dot is-${LEVELS[level].tone}" title="${LEVELS[level].label}"></small>
          </button>`;
        }).join('')}
      </div>
    </section>`;
  }).join('');
}

function ownerStatus() {
  return STORAGE_OWNERS.map(([id, label, keys]) => {
    const count = keys.filter((key) => localStorage.getItem(key)).length;
    return { id, label, ready: count > 0, count, total: keys.length };
  });
}

function renderMatrix() {
  const objects = MENU.flatMap((group) => group.children);
  return `<div class="matrix-scroll"><table class="permission-matrix">
    <thead><tr><th>业务对象 / 页面</th>${Object.values(ROLES).map((role) => `<th>${escapeHtml(role.short)}</th>`).join('')}</tr></thead>
    <tbody>${objects.map((item) => `<tr><th>${escapeHtml(item.title)}</th>${Object.keys(ROLES).map((roleId) => {
      const level = PERMISSIONS[item.id]?.[roleId] || 'none';
      return `<td><span class="matrix-level is-${LEVELS[level].tone}">${LEVELS[level].label}</span></td>`;
    }).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function renderStatusList() {
  return ownerStatus().map((item) => `<li class="owner-status ${item.ready ? 'is-ready' : 'is-missing'}"><span>${item.ready ? '✓' : '○'}</span><div><strong>${escapeHtml(item.label)}</strong><small>${item.ready ? `已发现 ${item.count} 个本地 owner` : '尚未在当前浏览器建立'}</small></div></li>`).join('');
}

function shellHtml() {
  normalizeActiveView();
  const active = findView(activeView) || findView('today');
  const caseRecord = readCurrentCase();
  const role = ROLES[currentRole];
  const storedOwners = ownerStatus().filter((item) => item.ready).length;
  return `<div class="admin-app ${mobileOpen ? 'is-mobile-open' : ''}">
    <div class="admin-mobile-scrim" data-close-mobile></div>
    <aside class="admin-sidebar" aria-label="TradeOS 业务对象菜单">
      <div class="admin-brand"><span class="admin-brand__mark">T</span><div><strong>TradeOS</strong><small>TradeProof Workspace</small></div></div>
      <label class="role-switcher"><span>当前角色视图</span><select id="role-select">${roleOptions()}</select><small>${escapeHtml(role.description)}</small></label>
      <nav class="admin-nav">${renderMenu()}</nav>
      <div class="sidebar-boundary"><strong>演示权限投影</strong><span>只控制菜单可见性，不是服务器鉴权。</span><small>所有数据仍在当前浏览器；外部执行始终关闭。</small></div>
    </aside>
    <main class="admin-main">
      <header class="admin-header">
        <button class="mobile-menu-button" type="button" data-mobile-menu aria-label="打开业务菜单">☰</button>
        <div class="admin-heading"><small>${escapeHtml(active.title.split(' / ')[0])}</small><h1>${escapeHtml(active.title.split(' / ')[1] || active.title)}</h1></div>
        <div class="admin-header__actions">
          <button type="button" class="header-action" data-open-status>流程状态 <b>${storedOwners}/8</b></button>
          <button type="button" class="header-action" data-open-permissions>权限矩阵</button>
          <span class="role-badge">${escapeHtml(role.short)}</span>
        </div>
      </header>
      <section class="case-context" aria-label="当前案件上下文">
        <div><small>当前案件</small><strong>${escapeHtml(caseRecord?.title || '尚未建立 Trade Case')}</strong><span>${escapeHtml(caseRecord?.caseId || '从“市场机会”创建，或导入本地案件 JSON')}</span></div>
        <div class="case-context__meta"><span>阶段：${escapeHtml(caseRecord?.stage || '未开始')}</span><span>存储：浏览器本地</span><span class="boundary-chip">无正式资格 / 排名 / 授标</span></div>
      </section>
      <section class="workspace-frame-shell">
        <div class="workspace-toolbar"><div><span class="live-indicator"></span><strong>${escapeHtml(active.title)}</strong><small>${escapeHtml(LEVELS[permissionFor(active.id)].label)}</small></div><div><button type="button" data-refresh-frame>刷新页面</button><a href="${escapeHtml(active.href || './operations.html')}" target="_blank" rel="noopener">独立打开</a></div></div>
        <iframe id="workspace-frame" title="${escapeHtml(active.title)}" src="${escapeHtml(active.href || './operations.html')}"></iframe>
      </section>
    </main>
    <dialog id="permissions-dialog" class="admin-dialog"><form method="dialog"><header><div><small>ROLE × BUSINESS OBJECT</small><h2>角色—菜单—业务对象权限矩阵</h2></div><button value="cancel" aria-label="关闭">×</button></header><p class="dialog-note">该矩阵是当前浏览器中的前端角色视图，用于验证信息架构和菜单可见性。它不会阻止用户直接访问 HTML，也不代表生产账户、组织、RLS 或后端授权已经实现。</p>${renderMatrix()}<footer><span>权限动作仅限查看、本地编辑、本地导出或本地案件决定；自动发送、支付、融资、授标和其他外部执行均未开放。</span><button value="cancel">关闭</button></footer></form></dialog>
    <dialog id="status-dialog" class="admin-dialog status-dialog"><form method="dialog"><header><div><small>LOCAL WORKFLOW OWNERS</small><h2>当前浏览器流程状态</h2></div><button value="cancel" aria-label="关闭">×</button></header><ul class="owner-status-list">${renderStatusList()}</ul><div class="status-guidance"><strong>${caseRecord ? '案件已建立，可继续完成缺失对象。' : '先建立或导入 Trade Case。'}</strong><span>菜单按业务对象组织；缺失对象不会显示为零完成度，也不会被视为已验证。</span></div><footer><span>清空浏览器存储会丢失这些本地记录。</span><button value="cancel">关闭</button></footer></form></dialog>
    <dialog id="integrations-dialog" class="admin-dialog integrations-dialog"><form method="dialog"><header><div><small>INTEGRATION STATUS</small><h2>集成状态</h2></div><button value="cancel" aria-label="关闭">×</button></header><div class="integration-grid">${['Email / Document Channel','ERP','Logistics','Warehouse','Customs / Inspection','Insurance','Bank / Funder','Registry / Indexer'].map((name) => `<article><span class="integration-dot"></span><strong>${name}</strong><small>未连接 · preview only</small></article>`).join('')}</div><p class="dialog-note">当前没有 connector send、外部 write-back、云存储、registry write、chain submission 或资金执行。</p><footer><span>这里只展示未来集成对象，不创建连接。</span><button value="cancel">关闭</button></footer></form></dialog>
  </div>`;
}

function injectChildFrameStyle(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc?.head) return;
    const style = doc.createElement('style');
    style.dataset.tradeosAdminEmbed = 'true';
    style.textContent = `
      body{background:#07101b!important}
      .topbar,.nav,.announcement{display:none!important}
      .shell,.wrap{width:100%!important;max-width:none!important;margin:0!important;padding:22px!important}
      .hero{margin-top:0!important}
      @media(max-width:720px){.shell,.wrap{padding:14px!important}}
    `;
    doc.head.querySelector('[data-tradeos-admin-embed]')?.remove();
    doc.head.append(style);
  } catch {
    // Same-origin pages are expected. A standalone fallback remains available.
  }
}

function bind() {
  const roleSelect = document.querySelector('#role-select');
  roleSelect?.addEventListener('change', (event) => {
    currentRole = event.target.value;
    localStorage.setItem(ROLE_STORAGE_KEY, currentRole);
    normalizeActiveView();
    updateUrl(activeView, false);
    render();
  });

  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    const action = button.dataset.action;
    if (action === 'permissions') return document.querySelector('#permissions-dialog')?.showModal();
    if (action === 'integrations') return document.querySelector('#integrations-dialog')?.showModal();
    activeView = button.dataset.view;
    mobileOpen = false;
    updateUrl(activeView, true);
    render();
  }));

  document.querySelectorAll('[data-toggle-group]').forEach((button) => button.addEventListener('click', () => {
    const section = button.closest('.admin-nav__group');
    const collapsed = section.classList.toggle('is-collapsed');
    button.setAttribute('aria-expanded', String(!collapsed));
  }));

  document.querySelector('[data-mobile-menu]')?.addEventListener('click', () => { mobileOpen = true; render(); });
  document.querySelector('[data-close-mobile]')?.addEventListener('click', () => { mobileOpen = false; render(); });
  document.querySelector('[data-open-permissions]')?.addEventListener('click', () => document.querySelector('#permissions-dialog')?.showModal());
  document.querySelector('[data-open-status]')?.addEventListener('click', () => document.querySelector('#status-dialog')?.showModal());

  const frame = document.querySelector('#workspace-frame');
  frame?.addEventListener('load', () => injectChildFrameStyle(frame));
  document.querySelector('[data-refresh-frame]')?.addEventListener('click', () => frame?.contentWindow?.location.reload());
}

function updateUrl(view, push) {
  const url = new URL(location.href);
  url.searchParams.set('view', view);
  history[push ? 'pushState' : 'replaceState']({}, '', url);
}

function render() {
  root.innerHTML = shellHtml();
  bind();
  document.title = `TradeOS · ${findView(activeView)?.title || '统一运营后台'}`;
}

window.addEventListener('popstate', () => {
  activeView = new URLSearchParams(location.search).get('view') || 'today';
  render();
});
window.addEventListener('storage', render);
render();
