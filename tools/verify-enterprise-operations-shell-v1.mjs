import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('docs/operations.html', 'utf8');
const css = readFileSync('docs/enterprise-operations-shell-v1.css', 'utf8');
const script = readFileSync('docs/enterprise-operations-shell-v1.mjs', 'utf8');

for (const required of [
  'trade-ops-sidebar',
  'trade-ops-header',
  'Ask TradeOS',
  'data-trade-operations-root',
  'enterprise-operations-shell-v1.css',
  'enterprise-operations-shell-v1.mjs',
]) {
  assert.ok(html.includes(required), `operations shell missing ${required}`);
}

assert.ok(html.indexOf('operations.mjs') < html.indexOf('enterprise-operations-shell-v1.mjs'), 'shell enhancer must load after canonical operations runtime');
assert.ok(css.includes('.trade-ops-layout'), 'enterprise layout styles required');
assert.ok(css.includes('.trade-agent-drawer'), 'agent drawer styles required');
assert.ok(script.includes('draft_only · formalBusinessWritePerformed=false'), 'proposal-only boundary required');
assert.ok(script.includes('不构成 proof、authority、eligibility、shortlist、award'), 'formal truth boundary required');
assert.doesNotMatch(script, /fetch\s*\(/, 'shell enhancement must not add network calls');
assert.doesNotMatch(script, /localStorage\.setItem\([^)]*(proof|decision|award|eligibility)/i, 'shell must not persist formal trade state');

console.log('TradeOS enterprise operations shell v1: PASS');
