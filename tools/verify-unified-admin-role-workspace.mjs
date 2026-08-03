import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('docs/admin.html', 'utf8');
const js = readFileSync('docs/admin-shell.mjs', 'utf8');
const css = readFileSync('docs/admin-shell.css', 'utf8');
const operations = readFileSync('docs/operations.html', 'utf8');

assert.match(html, /id="tradeos-admin-root"/);
assert.match(html, /admin-shell\.css/);
assert.match(html, /admin-shell\.mjs/);
assert.match(operations, /admin\.html/);

for (const role of ['buyer_lead','supplier_coordinator','evidence_reviewer','external_verifier','administrator']) {
  assert.match(js, new RegExp(role));
}
for (const object of ['today','opportunities','case_overview','requirements','supplier_candidates','supplier_responses','supplier_outreach','communications','evidence','verification','decisions','learning','permissions','integrations']) {
  assert.match(js, new RegExp(object));
}
for (const owner of [
  'tradeproof.trade.case.v0.2',
  'tradeproof.supplier.review.v0.4',
  'tradeproof.supplier.response.request.v0.5',
  'tradeproof.inbound.communication.timeline.v0.7',
  'tradeproof.supplier.evidence.queue.v0.8',
  'tradeproof.evidence.verification.workspace.v0.9',
  'tradeproof.supplier.decision.workspace.v1.0'
]) assert.match(js, new RegExp(owner.replaceAll('.', '\\.')));

assert.match(js, /只控制菜单可见性，不是服务器鉴权/);
assert.match(js, /无正式资格 \/ 排名 \/ 授标/);
assert.match(js, /外部执行始终关闭/);
assert.match(js, /connector send、外部 write-back/);
assert.match(css, /grid-template-columns:276px minmax\(0,1fr\)/);
assert.match(css, /@media\(max-width:780px\)/);
assert.doesNotMatch(js, /fetch\s*\(/);
assert.doesNotMatch(js, /XMLHttpRequest/);
assert.doesNotMatch(js, /WebSocket/);
assert.doesNotMatch(js, /numericScore\s*=\s*[0-9]/);

console.log('Unified admin role workspace verification passed.');
