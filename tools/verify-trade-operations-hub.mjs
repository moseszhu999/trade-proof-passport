#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOperationsHubModel, learningForOpportunity } from '../docs/operations.mjs';
import {
  addFileMetadata,
  caseActionQueue,
  createTradeCase,
  decideRequirement,
  exportTradeCase,
  importTradeCase,
  ingestText,
  validateTradeCase
} from '../docs/trade-case-core.mjs';

const collection = JSON.parse(await readFile(new URL('../docs/data/opportunity-radar-latest.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../docs/operations.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../docs/operations.css', import.meta.url), 'utf8');
const script = await readFile(new URL('../docs/operations.mjs', import.meta.url), 'utf8');
const core = await readFile(new URL('../docs/trade-case-core.mjs', import.meta.url), 'utf8');
const schema = JSON.parse(await readFile(new URL('../schema/trade-case.schema.json', import.meta.url), 'utf8'));
const fixedNow = new Date('2026-08-03T00:00:00.000Z');

const baseModel = buildOperationsHubModel(collection, { now: fixedNow });
assert.equal(baseModel.schemaVersion, 'tradeproof.trade-daily-operations-hub.v0.2');
assert.deepEqual(baseModel.regionOrder, ['today_market', 'current_case', 'action_queue', 'agent_status', 'risk_close']);
assert.equal(baseModel.todayMarket.opportunities.length, 5);
assert.equal(baseModel.currentCase.state, 'empty');
assert.equal(baseModel.intelligence.syntheticTrendGenerated, false);
assert.equal(baseModel.todayMarket.opportunities.every((item) => item.participation.chinaSupplierEligibility === 'unknown'), true);
assert.equal(baseModel.todayMarket.opportunities.every((item) => item.learning.officialRequirement === false), true);
assert.equal(learningForOpportunity(collection.opportunities[0]).evidenceClassification, 'agent_guidance');

let tradeCase = await createTradeCase(collection.opportunities[0], fixedNow);
assert.equal(tradeCase.schemaVersion, 'tradeproof.trade-case.v0.2');
assert.equal(tradeCase.state, 'holder_controlled_draft');
assert.equal(tradeCase.formalWritePerformed, false);
assert.equal(tradeCase.boundaries.serverPersistence, false);
assert.equal((await validateTradeCase(tradeCase)).length, 0);

tradeCase = await ingestText(tradeCase, {
  kind: 'official_notice_text',
  title: 'Eligibility and delivery extract',
  text: 'The economic operator must provide ISO 9001 certification and evidence of three reference projects. Delivery and installation shall be completed at the hospital site before 30 September 2026. Subcontracting must be declared.'
}, new Date('2026-08-03T00:01:00.000Z'));
assert.equal(tradeCase.requirementCandidates.length >= 4, true);
assert.equal(tradeCase.requirementCandidates.every((item) => item.status === 'candidate_unconfirmed'), true);
assert.equal(tradeCase.requirementCandidates.every((item) => item.officialRequirement === false), true);

tradeCase = await ingestText(tradeCase, {
  kind: 'email_or_message_text',
  title: 'Buyer clarification',
  text: 'Please confirm the sample delivery date and provide the test report before Friday.'
}, new Date('2026-08-03T00:02:00.000Z'));
assert.equal(tradeCase.communications.some((item) => item.kind === 'email_or_message_text'), true);
assert.equal(tradeCase.communications.flatMap((item) => item.actionCandidates ?? []).length > 0, true);

tradeCase = await addFileMetadata(tradeCase, [{ name: 'specification.pdf', type: 'application/pdf', size: 2048, lastModified: 1770000000000 }], new Date('2026-08-03T00:03:00.000Z'));
assert.equal(tradeCase.fileReferences.length, 1);
assert.equal(tradeCase.fileReferences[0].contentRead, false);
assert.equal(tradeCase.fileReferences[0].uploaded, false);

const firstRequirement = tradeCase.requirementCandidates[0];
tradeCase = await decideRequirement(tradeCase, firstRequirement.requirementId, 'confirm_source_requirement', new Date('2026-08-03T00:04:00.000Z'));
const confirmed = tradeCase.requirementCandidates.find((item) => item.requirementId === firstRequirement.requirementId);
assert.equal(confirmed.status, 'confirmed_in_supplied_source');
assert.equal(confirmed.officialRequirement, true);
assert.equal(confirmed.humanConfirmationRequired, false);
assert.equal(tradeCase.decisions.at(-1).principalClass, 'holder_human');
assert.equal(tradeCase.decisions.at(-1).formalTradeDecision, false);
assert.equal((await validateTradeCase(tradeCase)).length, 0);

const serialized = await exportTradeCase(tradeCase);
const imported = await importTradeCase(serialized);
assert.equal(imported.caseDigest, tradeCase.caseDigest);
assert.equal(imported.caseId, tradeCase.caseId);
const tampered = JSON.parse(serialized);
tampered.title = 'tampered';
assert.equal((await validateTradeCase(tampered)).includes('caseDigest mismatch'), true);

const queue = caseActionQueue(tradeCase);
assert.equal(queue.some((item) => item.kind === 'communication_action_review'), true);
assert.equal(queue.every((item) => item.formalWritePerformed === false), true);
const caseModel = buildOperationsHubModel(collection, { localCase: tradeCase, now: fixedNow });
assert.equal(caseModel.currentCase.state, 'ready');
assert.equal(caseModel.currentCase.sourceOwner, 'holder_controlled_trade_case');
assert.equal(caseModel.agentStatus.items.some((item) => item.workflow === '案件资料解析'), true);
assert.equal(caseModel.riskClose.pendingRequirementCount > 0, true);

assert.equal(schema.properties.schemaVersion.const, 'tradeproof.trade-case.v0.2');
for (const marker of ['data-trade-operations-root', 'local-collection-file', 'local-case-file']) {
  assert.equal(html.includes(marker), true, `HTML must contain ${marker}`);
}
for (const marker of ['today-market', 'current-case', 'action-queue', 'agent-status', 'risk-close', 'learning-intelligence', 'official-notice-intake', 'communication-intake', 'file-metadata-intake']) {
  assert.equal(script.includes(marker), true, `Script must render ${marker}`);
}
for (const marker of ['holder_controlled_draft', 'candidate_unconfirmed', 'contentRead: false', 'uploaded: false', 'externalMessageSent: false']) {
  assert.equal(core.includes(marker), true, `Core must contain ${marker}`);
}
assert.equal(css.includes('@media(max-width:880px)'), true);
assert.equal(/mailto:|tel:|whatsapp|wechat|微信号/i.test(html), false, 'Hub must not expose contact details.');
assert.equal(/fetch\(|XMLHttpRequest|WebSocket/.test(core), false, 'Trade Case core must not perform network access.');

console.log('PASS: Trade Daily Operations Hub v0.2');
console.log(`Opportunities: ${baseModel.todayMarket.opportunities.length}`);
console.log(`Requirement candidates: ${tradeCase.requirementCandidates.length}`);
console.log(`Communication action candidates: ${tradeCase.communications.flatMap((item) => item.actionCandidates ?? []).length}`);
console.log('Holder-controlled case export/import: PASS');
console.log('Official-source candidate confirmation boundary: PASS');
console.log('Email/message local intake boundary: PASS');
console.log('File metadata-only boundary: PASS');
console.log('Tamper-evident case digest: PASS');
