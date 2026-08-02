#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOperationsHubModel, createLocalCase, learningForOpportunity } from '../docs/operations.mjs';

const collection = JSON.parse(await readFile(new URL('../docs/data/opportunity-radar-latest.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../docs/operations.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../docs/operations.css', import.meta.url), 'utf8');
const script = await readFile(new URL('../docs/operations.mjs', import.meta.url), 'utf8');
const fixedNow = new Date('2026-08-02T12:00:00.000Z');
const baseModel = buildOperationsHubModel(collection, { now: fixedNow });

assert.equal(baseModel.schemaVersion, 'tradeproof.trade-daily-operations-hub.v0.1');
assert.deepEqual(baseModel.regionOrder, ['today_market', 'current_case', 'action_queue', 'agent_status', 'risk_close']);
assert.equal(baseModel.todayMarket.state, 'ready');
assert.equal(baseModel.todayMarket.opportunities.length, 5);
assert.equal(baseModel.currentCase.state, 'empty');
assert.equal(baseModel.currentCase.noDataReason, 'no_local_case_created');
assert.equal(baseModel.actionQueue.items.length, 5);
assert.equal(baseModel.actionQueue.items.every((item) => item.formalWritePerformed === false), true);
assert.equal(baseModel.agentStatus.items.every((item) => item.formalWritePerformed === false), true);
assert.equal(baseModel.intelligence.state, 'unavailable');
assert.equal(baseModel.intelligence.syntheticTrendGenerated, false);
assert.equal(baseModel.todayMarket.opportunities.every((item) => item.participation.chinaSupplierEligibility === 'unknown'), true);
assert.equal(baseModel.todayMarket.opportunities.every((item) => item.source.url.startsWith('https://ted.europa.eu/')), true);
assert.equal(baseModel.todayMarket.opportunities.every((item) => item.learning.officialRequirement === false), true);
assert.equal(learningForOpportunity(baseModel.todayMarket.opportunities[0]).evidenceClassification, 'agent_guidance');

const localCase = createLocalCase(collection.opportunities[0], fixedNow);
assert.equal(localCase.formalWritePerformed, false);
assert.equal(localCase.state, 'local_draft');
const caseModel = buildOperationsHubModel(collection, { localCase, now: fixedNow });
assert.equal(caseModel.currentCase.state, 'ready');
assert.equal(caseModel.actionQueue.items[0].kind, 'case_next_action');
assert.equal(caseModel.actionQueue.items.length, 6);

for (const marker of ['data-trade-operations-root', 'local-collection-file']) {
  assert.equal(html.includes(marker), true, `HTML must contain ${marker}`);
}
for (const marker of ['today-market', 'current-case', 'action-queue', 'agent-status', 'risk-close', 'learning-intelligence']) {
  assert.equal(script.includes(marker), true, `Script must render ${marker}`);
}
assert.equal(html.includes('operations.mjs'), true);
assert.equal(css.includes('@media(max-width:880px)'), true);
assert.equal(/mailto:|tel:|whatsapp|wechat|微信号/i.test(html), false, 'Hub must not expose contact details.');
console.log('PASS: Trade Daily Operations Hub v0.1');
console.log(`Opportunities: ${baseModel.todayMarket.opportunities.length}`);
console.log(`Eligibility review tasks: ${baseModel.actionQueue.items.length}`);
console.log('Five-region operations contract: PASS');
console.log('Local draft case boundary: PASS');
console.log('Learning guidance / official requirement separation: PASS');
console.log('Synthetic market intelligence disabled: PASS');
