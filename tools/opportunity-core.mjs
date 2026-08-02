import { createHash } from 'node:crypto';

export const OPPORTUNITY_SCHEMA_VERSION = 'tradeproof.trade-opportunity.v0.1';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Digest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function firstScalar(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = firstScalar(item);
      if (result !== null) return result;
    }
    return null;
  }
  if (isObject(value)) {
    for (const preferred of ['eng', 'ENG', 'en', 'EN']) {
      if (value[preferred] !== undefined) return firstScalar(value[preferred]);
    }
    for (const item of Object.values(value)) {
      const result = firstScalar(item);
      if (result !== null) return result;
    }
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function stringList(value) {
  const source = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return [...new Set(source.flatMap((item) => {
    if (Array.isArray(item)) return stringList(item);
    if (isObject(item)) return Object.values(item).flatMap((nested) => stringList(nested));
    const text = String(item).trim();
    return text ? [text] : [];
  }))].sort();
}

function noticeUrl(notice, publicationNumber) {
  const linked = firstScalar(notice.links);
  if (linked && /^https:\/\//i.test(linked)) return linked;
  return `https://ted.europa.eu/en/notice/-/detail/${encodeURIComponent(publicationNumber)}`;
}

function earliestDate(value) {
  const dates = stringList(value).filter((item) => /^\d{4}-?\d{2}-?\d{2}/.test(item));
  return dates.sort()[0] ?? null;
}

export function normalizeTedNotice(notice, { observedAt = new Date().toISOString() } = {}) {
  if (!isObject(notice)) throw new TypeError('TED notice must be an object.');
  const publicationNumber = firstScalar(notice['publication-number']);
  if (!publicationNumber) throw new Error('TED notice is missing publication-number.');

  const opportunity = {
    schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
    opportunityId: `opportunity:ted:${publicationNumber}`,
    source: {
      sourceId: 'ted-search-api',
      recordId: publicationNumber,
      authorityClass: 'official_public_procurement',
      url: noticeUrl(notice, publicationNumber)
    },
    observedAt,
    title: firstScalar(notice['notice-title']),
    buyer: {
      name: firstScalar(notice['buyer-name']),
      country: firstScalar(notice['buyer-country'])
    },
    classification: {
      opportunityType: firstScalar(notice['notice-type']),
      codes: stringList(notice['classification-cpv'])
    },
    dates: {
      publishedAt: firstScalar(notice['publication-date']),
      deadlineAt: earliestDate(
        notice['deadline-receipt-tender-date-lot'] ??
        notice['deadline-receipt-request-date-lot'] ??
        notice['deadline-receipt-tender']
      )
    },
    participation: {
      foreignSupplierEligibility: 'unknown',
      chinaSupplierEligibility: 'unknown'
    },
    state: 'observed_active_source',
    unknowns: [
      'foreign supplier eligibility requires notice-level review',
      'China supplier eligibility requires notice-level review',
      'buyer publication does not equal buyer endorsement of TradeProof'
    ],
    provenance: [
      { field: 'source.recordId', sourceField: 'publication-number', extraction: 'direct_field' },
      { field: 'title', sourceField: 'notice-title', extraction: 'bounded_normalization' },
      { field: 'buyer.name', sourceField: 'buyer-name', extraction: 'bounded_normalization' },
      { field: 'dates.publishedAt', sourceField: 'publication-date', extraction: 'direct_field' }
    ]
  };

  opportunity.opportunityDigest = sha256Digest(opportunity);
  return opportunity;
}

export function validateOpportunity(opportunity) {
  const errors = [];
  if (!isObject(opportunity)) return ['opportunity must be an object'];
  if (opportunity.schemaVersion !== OPPORTUNITY_SCHEMA_VERSION) errors.push('unexpected schemaVersion');
  if (!/^opportunity:/.test(opportunity.opportunityId ?? '')) errors.push('invalid opportunityId');
  if (!/^https:\/\//.test(opportunity.source?.url ?? '')) errors.push('source.url must be https');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(opportunity.observedAt ?? '')) errors.push('observedAt must be an ISO date-time');
  if (!Array.isArray(opportunity.classification?.codes)) errors.push('classification.codes must be an array');
  if (opportunity.participation?.foreignSupplierEligibility !== 'unknown') {
    errors.push('day-one TED normalization must not infer foreign supplier eligibility');
  }
  if (opportunity.participation?.chinaSupplierEligibility !== 'unknown') {
    errors.push('day-one TED normalization must not infer China supplier eligibility');
  }
  if (!Array.isArray(opportunity.provenance) || opportunity.provenance.length === 0) {
    errors.push('provenance must be non-empty');
  }
  const { opportunityDigest, ...unsigned } = opportunity;
  if (opportunityDigest !== sha256Digest(unsigned)) errors.push('opportunityDigest mismatch');
  return errors;
}

export function dedupeOpportunities(opportunities) {
  const byId = new Map();
  const duplicates = [];
  for (const opportunity of opportunities) {
    const existing = byId.get(opportunity.opportunityId);
    if (!existing) {
      byId.set(opportunity.opportunityId, opportunity);
      continue;
    }
    duplicates.push({
      opportunityId: opportunity.opportunityId,
      keptDigest: existing.opportunityDigest,
      rejectedDigest: opportunity.opportunityDigest
    });
  }
  return {
    opportunities: [...byId.values()].sort((a, b) => a.opportunityId.localeCompare(b.opportunityId)),
    duplicates
  };
}

export function buildDayOneReport(opportunities, duplicates = []) {
  const countries = {};
  const types = {};
  for (const opportunity of opportunities) {
    const country = opportunity.buyer.country ?? 'UNKNOWN';
    const type = opportunity.classification.opportunityType ?? 'UNKNOWN';
    countries[country] = (countries[country] ?? 0) + 1;
    types[type] = (types[type] ?? 0) + 1;
  }
  return {
    observed: opportunities.length + duplicates.length,
    uniqueOpportunities: opportunities.length,
    duplicateObservationsRejected: duplicates.length,
    requiresEligibilityReview: opportunities.filter(
      (item) => item.participation.chinaSupplierEligibility === 'unknown'
    ).length,
    countries,
    opportunityTypes: types
  };
}

export function renderMarkdownReport(collection) {
  const lines = [
    '# TradeProof Opportunity Radar — Day One',
    '',
    `Generated: ${collection.generatedAt}`,
    `Source: ${collection.sourceId}`,
    `Query: \`${collection.query}\``,
    '',
    '## Counts',
    '',
    `- Observed records: ${collection.counts.observed}`,
    `- Unique opportunities: ${collection.counts.uniqueOpportunities}`,
    `- Duplicate observations rejected: ${collection.counts.duplicateObservationsRejected}`,
    `- Eligibility review required: ${collection.counts.requiresEligibilityReview}`,
    '',
    '## Opportunities',
    ''
  ];
  for (const item of collection.opportunities) {
    lines.push(`- [${item.source.recordId}](${item.source.url}) — ${item.title ?? 'Untitled notice'} — ${item.buyer.name ?? 'Buyer not extracted'} (${item.buyer.country ?? 'country unknown'})`);
  }
  lines.push('', '## Boundary', '', 'These are source observations, not verified buyer endorsements, supplier eligibility decisions or transaction commitments.', '');
  return lines.join('\n');
}
