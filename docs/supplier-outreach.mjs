import { DISCLOSURE_CONFIRMATION_TEXT, createContactBook, createDisclosureApproval, upsertContact, validateContactBook, validateDisclosureApproval } from './supplier-contact-core.mjs';
import { buildEmlExport, buildOutreachWorkspaceModel, createOutreachDraft, validateOutreachDraft } from './supplier-outreach-core.mjs';

const CASE_KEY = 'tradeproof.trade.case.v0.2';
const REVIEW_KEY = 'tradeproof.supplier.review.v0.4';
const REQUEST_KEY = 'tradeproof.supplier.response.request.v0.5';
const CONTACT_BOOK_KEY = 'tradeproof.supplier.contact.book.v0.6';
const APPROVALS_KEY = 'tradeproof.contact.disclosure.approvals.v0.6';
const DRAFTS_KEY = 'tradeproof.supplier.outreach.drafts.v0.6';
const COLLECTION_URL = './data/supplier-candidates-hospital-furniture-v0.4.json';

const root = document.querySelector('[data-supplier-outreach-root]');
const statusNode = document.querySelector('[data-status]');
let caseRecord = null;
let review = null;
let request = null;
let collection = null;
let contactBook = null;
let approvals = [];
let drafts = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function candidateById(id) {
  return collection?.candidates?.find((item) => item.candidateId === id) ?? null;
}

function contactByCandidate(id) {
  return contactBook?.contacts?.find((item) => item.candidateId === id) ?? null;
}

function approvalByContact(id) {
  return approvals.find((item) => item.contactId === id) ?? null;
}

function draftByCandidate(id) {
  return drafts.find((item) => item.candidateId === id) ?? null;
}

function persist() {
  writeJson(CONTACT_BOOK_KEY, contactBook);
  writeJson(APPROVALS_KEY, approvals);
  writeJson(DRAFTS_KEY, drafts);
}

function downloadText(fileName, mediaType, content) {
  const blob = new Blob([content], { type: mediaType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function summary(model) {
  const cards = [
    ['已选供应商', model.counts.selectedCandidates],
    ['已录入联系人', model.counts.contactsAvailable],
    ['已批准披露', model.counts.disclosureApprovals],
    ['本地草稿', model.counts.draftsReady],
    ['外部发送', model.counts.externalSends],
    ['正式提交', model.counts.formalSubmissions]
  ];
  return `<section class="summary-grid">${cards.map(([label, value]) => `<article class="summary-card"><small>${escapeHtml(label)}</small><strong>${value}</strong></article>`).join('')}</section>`;
}

function contactForm(candidate, contact) {
  return `<form data-contact-form="${escapeHtml(candidate.candidateId)}" class="field-grid">
    <label class="field"><span>联系人姓名</span><input name="displayName" value="${escapeHtml(contact?.displayName ?? '')}" autocomplete="off"></label>
    <label class="field"><span>公司或部门</span><input name="organization" value="${escapeHtml(contact?.organization ?? candidate.displayName ?? '')}" autocomplete="off"></label>
    <label class="field is-wide"><span>邮箱（仅本机保存）</span><input name="address" type="email" required value="${escapeHtml(contact?.address ?? '')}" autocomplete="off"></label>
    <label class="field is-wide"><span>来源说明</span><textarea name="sourceNote" placeholder="例如：用户从名片、既有邮件或供应商主动提供的信息中录入">${escapeHtml(contact?.sourceNote ?? '')}</textarea></label>
    <div class="actions field is-wide"><button type="submit">保存本地联系人</button></div>
  </form>`;
}

function approvalPanel(candidate, contact, approval) {
  if (!contact) return '<div class="empty">先由用户本地录入联系人。系统不会从官网、搜索引擎或第三方数据库抓取邮箱。</div>';
  if (approval && validateDisclosureApproval(approval, contact).length === 0) {
    return `<div class="approval-box"><strong>已批准披露</strong><p>完整地址：<span class="masked">${escapeHtml(contact.address)}</span></p><small>scope=prepare_outreach_draft_only · externalSendApproved=false</small></div>`;
  }
  return `<div class="approval-box">
    <p>默认只显示：<span class="masked">${escapeHtml(contact.maskedAddress)}</span></p>
    <label class="field"><span>输入精确确认短语</span><input data-approval-text="${escapeHtml(candidate.candidateId)}" placeholder="${DISCLOSURE_CONFIRMATION_TEXT}" autocomplete="off"></label>
    <div class="actions"><button type="button" data-approve="${escapeHtml(candidate.candidateId)}">批准本地披露与草稿生成</button></div>
    <small>该批准不包含外部发送许可。</small>
  </div>`;
}

function draftPanel(candidate, contact, approval, draft) {
  const canCreate = Boolean(contact && approval && validateDisclosureApproval(approval, contact).length === 0 && request?.selectedCandidateIds?.includes(candidate.candidateId));
  if (!draft) {
    return `<div class="actions"><button type="button" data-create-draft="${escapeHtml(candidate.candidateId)}" ${canCreate ? '' : 'disabled'}>生成本地外联草稿</button></div><p class="note">生成草稿前必须：供应商已进入本地候选名单、已生成统一问题包、已录入联系人并批准披露。</p>`;
  }
  return `<div>
    <div class="status-list">
      <div class="status-row"><span>草稿状态</span><strong>${escapeHtml(draft.state)}</strong></div>
      <div class="status-row"><span>外部发送</span><strong>false</strong></div>
      <div class="status-row"><span>正式提交</span><strong>false</strong></div>
      <div class="status-row"><span>需手动附加回复模板</span><strong>true</strong></div>
    </div>
    <h4>${escapeHtml(draft.subject)}</h4>
    <pre class="draft-preview">${escapeHtml(draft.body)}</pre>
    <div class="actions"><button type="button" data-export-eml="${escapeHtml(candidate.candidateId)}">导出 .eml 草稿</button><button type="button" class="is-secondary" data-remove-draft="${escapeHtml(candidate.candidateId)}">删除本地草稿</button></div>
  </div>`;
}

function candidateCard(row) {
  const candidate = candidateById(row.candidateId);
  const contact = contactByCandidate(row.candidateId);
  const approval = contact ? approvalByContact(contact.contactId) : null;
  const draft = draftByCandidate(row.candidateId);
  return `<article class="outreach-card">
    <header><div><small>${escapeHtml(row.candidateId)}</small><h3>${escapeHtml(row.displayName)}</h3></div><span class="badge">${escapeHtml(row.draftState)}</span></header>
    <div class="status-list">
      <div class="status-row"><span>联系人</span><strong>${escapeHtml(row.contactState)}</strong></div>
      <div class="status-row"><span>默认显示</span><strong class="masked">${escapeHtml(row.maskedAddress ?? '未录入')}</strong></div>
      <div class="status-row"><span>披露批准</span><strong>${escapeHtml(row.disclosureState)}</strong></div>
      <div class="status-row"><span>已纳入问题包</span><strong>${row.requestIncluded}</strong></div>
    </div>
    ${contactForm(candidate, contact)}
    ${approvalPanel(candidate, contact, approval)}
    ${draftPanel(candidate, contact, approval, draft)}
  </article>`;
}

function render() {
  const model = buildOutreachWorkspaceModel({ caseRecord, request, collection, review, contactBook, approvals, drafts });
  root.innerHTML = `<div class="workspace">
    ${summary(model)}
    <section>
      <div class="section-head"><div><small>HOLDER-CONTROLLED CONTACT RELEASE</small><h2>受控联系人披露与外联准备</h2></div><span class="badge">本地草稿 · 不自动发送</span></div>
      <p>这里负责准备工作，不负责发送。联系人来源必须是用户自己录入；完整地址只有在当前浏览器明确批准后才显示。</p>
      <div class="outreach-grid">${model.candidates.length ? model.candidates.map(candidateCard).join('') : '<div class="empty">尚无本地候选供应商。请先在“供应商候选”中选择企业，并在“供应商回复”中生成统一问题包。</div>'}</div>
    </section>
  </div>`;
  bindEvents();
}

function bindEvents() {
  for (const form of document.querySelectorAll('[data-contact-form]')) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const candidateId = form.dataset.contactForm;
      const data = new FormData(form);
      try {
        contactBook = upsertContact(contactBook, {
          candidateId,
          displayName: data.get('displayName'),
          organization: data.get('organization'),
          address: data.get('address'),
          sourceNote: data.get('sourceNote')
        });
        if (validateContactBook(contactBook).length) throw new Error(validateContactBook(contactBook).join('; '));
        persist();
        render();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  for (const button of document.querySelectorAll('[data-approve]')) {
    button.addEventListener('click', () => {
      const candidateId = button.dataset.approve;
      const contact = contactByCandidate(candidateId);
      const confirmationText = document.querySelector(`[data-approval-text="${CSS.escape(candidateId)}"]`)?.value ?? '';
      try {
        const approval = createDisclosureApproval({ caseRecord, candidateId, contact, confirmationText });
        approvals = [...approvals.filter((item) => item.contactId !== contact.contactId), approval];
        persist();
        render();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  for (const button of document.querySelectorAll('[data-create-draft]')) {
    button.addEventListener('click', () => {
      const candidateId = button.dataset.createDraft;
      const candidate = candidateById(candidateId);
      const contact = contactByCandidate(candidateId);
      const approval = contact ? approvalByContact(contact.contactId) : null;
      try {
        const draft = createOutreachDraft({ caseRecord, request, candidate, contact, approval });
        if (validateOutreachDraft(draft).length) throw new Error(validateOutreachDraft(draft).join('; '));
        drafts = [...drafts.filter((item) => item.candidateId !== candidateId), draft];
        persist();
        render();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  for (const button of document.querySelectorAll('[data-export-eml]')) {
    button.addEventListener('click', () => {
      const draft = draftByCandidate(button.dataset.exportEml);
      try {
        const exported = buildEmlExport(draft);
        downloadText(exported.fileName, exported.mediaType, exported.content);
      } catch (error) {
        alert(error.message);
      }
    });
  }

  for (const button of document.querySelectorAll('[data-remove-draft]')) {
    button.addEventListener('click', () => {
      drafts = drafts.filter((item) => item.candidateId !== button.dataset.removeDraft);
      persist();
      render();
    });
  }
}

async function initialize() {
  try {
    caseRecord = readJson(CASE_KEY);
    review = readJson(REVIEW_KEY, { selectedCandidateIds: [] });
    request = readJson(REQUEST_KEY);
    collection = await fetch(COLLECTION_URL).then((response) => {
      if (!response.ok) throw new Error(`Supplier collection HTTP ${response.status}`);
      return response.json();
    });
    contactBook = readJson(CONTACT_BOOK_KEY) ?? createContactBook(caseRecord, review.selectedCandidateIds ?? []);
    contactBook.selectedCandidateIds = [...new Set(review.selectedCandidateIds ?? [])];
    contactBook.contacts = (contactBook.contacts ?? []).filter((item) => contactBook.selectedCandidateIds.includes(item.candidateId));
    approvals = readJson(APPROVALS_KEY, []);
    drafts = readJson(DRAFTS_KEY, []);
    if (validateContactBook(contactBook).length) contactBook = createContactBook(caseRecord, review.selectedCandidateIds ?? []);
    persist();
    render();
    statusNode.textContent = request ? `已读取问题包 ${request.requestId}` : '尚未读取统一问题包';
  } catch (error) {
    root.innerHTML = `<div class="fatal"><strong>外联准备工作台加载失败</strong><span>${escapeHtml(error.message)}</span></div>`;
    statusNode.textContent = '加载失败';
  }
}

initialize();
