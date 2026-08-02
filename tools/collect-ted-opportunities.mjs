#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  buildDayOneReport,
  dedupeOpportunities,
  normalizeTedNotice,
  renderMarkdownReport,
  validateOpportunity
} from './opportunity-core.mjs';

const ENDPOINT = 'https://api.ted.europa.eu/v3/notices/search';
const DEFAULT_FIELDS = [
  'publication-number',
  'publication-date',
  'notice-title',
  'buyer-name',
  'buyer-country',
  'notice-type',
  'classification-cpv',
  'deadline-receipt-tender-date-lot'
];

function parseArgs(argv) {
  const options = {
    limit: 10,
    out: 'artifacts/opportunity-day-one/ted-opportunities.json',
    report: 'artifacts/opportunity-day-one/report.md'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    index += 1;
    if (key === '--limit') options.limit = Number(value);
    else if (key === '--since') options.since = value;
    else if (key === '--query') options.query = value;
    else if (key === '--out') options.out = value;
    else if (key === '--report') options.report = value;
    else if (key === '--fixture') options.fixture = value;
    else if (key === '--observed-at') options.observedAt = value;
    else throw new Error(`Unknown option: ${key}`);
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 250) {
    throw new Error('--limit must be an integer from 1 to 250.');
  }
  return options;
}

function dateSevenDaysAgo() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function normalizeTedDate(value) {
  if (!value) return dateSevenDaysAgo();
  const compact = value.replaceAll('-', '');
  if (!/^\d{8}$/.test(compact)) throw new Error('--since must be YYYY-MM-DD or YYYYMMDD.');
  return compact;
}

async function fetchTed(payload, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'TradeProofOpportunityRadar/0.1 (+https://github.com/moseszhu999/trade-proof-passport)'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`TED API ${response.status}: ${text.slice(0, 500)}`);
    return JSON.parse(text);
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1500));
    return fetchTed(payload, attempt + 1);
  } finally {
    clearTimeout(timeout);
  }
}

async function loadInput(options, payload) {
  if (options.fixture) return JSON.parse(await readFile(resolve(options.fixture), 'utf8'));
  return fetchTed(payload);
}

async function writeText(path, content) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content);
}

export async function collectTedOpportunities(options) {
  const since = normalizeTedDate(options.since);
  const query = options.query ?? `publication-date >= ${since} AND notice-type=cn-standard`;
  const payload = {
    query,
    fields: DEFAULT_FIELDS,
    page: 1,
    limit: options.limit,
    scope: 'ACTIVE',
    checkQuerySyntax: false,
    paginationMode: 'PAGE_NUMBER'
  };
  const observedAt = options.observedAt ?? new Date().toISOString();
  const response = await loadInput(options, payload);
  if (!Array.isArray(response.notices)) throw new Error('TED response does not contain notices[].');

  const normalized = response.notices.map((notice) => normalizeTedNotice(notice, { observedAt }));
  for (const opportunity of normalized) {
    const errors = validateOpportunity(opportunity);
    if (errors.length > 0) throw new Error(`${opportunity.opportunityId}: ${errors.join('; ')}`);
  }
  const { opportunities, duplicates } = dedupeOpportunities(normalized);
  const collection = {
    schemaVersion: 'tradeproof.opportunity-collection.v0.1',
    generatedAt: observedAt,
    sourceId: 'ted-search-api',
    endpoint: ENDPOINT,
    query,
    counts: buildDayOneReport(opportunities, duplicates),
    duplicates,
    opportunities
  };
  await writeText(options.out, `${JSON.stringify(collection, null, 2)}\n`);
  await writeText(options.report, renderMarkdownReport(collection));
  return collection;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  collectTedOpportunities(parseArgs(process.argv.slice(2)))
    .then((collection) => {
      console.log(`PASS: collected ${collection.counts.uniqueOpportunities} unique TED opportunities`);
      console.log(`Duplicates rejected: ${collection.counts.duplicateObservationsRejected}`);
      console.log(`Eligibility review required: ${collection.counts.requiresEligibilityReview}`);
    })
    .catch((error) => {
      console.error(`FAIL: ${error.stack ?? error.message}`);
      process.exitCode = 1;
    });
}
