import { readFileSync } from 'node:fs';
import { getMessage, messages, normalizeLocale, supportedLocales } from '../docs/index-i18n.mjs';

const landing = readFileSync('docs/index.html', 'utf8');
const i18nModule = readFileSync('docs/index-i18n.mjs', 'utf8');
const requireValues = (source, values, label) => {
  for (const value of values) {
    if (!source.includes(value)) throw new Error(`Missing ${label}: ${value}`);
  }
};

requireValues(landing, [
  'Token allocation pie chart',
  'conic-gradient(',
  './index-i18n.mjs',
  'languageSelect',
  'No sale is active.',
  '0xad1c714140ceb8ed7c5234d939a06926f5edaba2'
], 'launch landing contract');

requireValues(i18nModule, [
  "supportedLocales = ['en', 'zh-CN', 'ja-JP']",
  '让贸易证据可验证。',
  '貿易のための証明。',
  'tradeProofLocale'
], 'internationalization contract');

if (supportedLocales.join(',') !== 'en,zh-CN,ja-JP') {
  throw new Error(`Unexpected locale set: ${supportedLocales.join(',')}`);
}
if (normalizeLocale('zh-Hans') !== 'zh-CN' || normalizeLocale('ja') !== 'ja-JP' || normalizeLocale('fr') !== 'en') {
  throw new Error('Locale normalization is not deterministic.');
}

const canonicalKeys = Object.keys(messages.en).sort();
for (const locale of supportedLocales) {
  const localeKeys = Object.keys(messages[locale] || {}).sort();
  if (localeKeys.join('\n') !== canonicalKeys.join('\n')) {
    const missing = canonicalKeys.filter((key) => !localeKeys.includes(key));
    const extra = localeKeys.filter((key) => !canonicalKeys.includes(key));
    throw new Error(`${locale} key mismatch. Missing: ${missing.join(', ')}. Extra: ${extra.join(', ')}.`);
  }
}
if (getMessage('zh-CN', 'heroLine1') !== '让贸易证据可验证。') throw new Error('Chinese translation mismatch.');
if (getMessage('ja-JP', 'heroLine1') !== '貿易のための証明。') throw new Error('Japanese translation mismatch.');

const allocations = [...landing.matchAll(/<b>(45|20|15|10|5)%<\/b>/g)].map((match) => Number(match[1]));
const total = allocations.reduce((sum, value) => sum + value, 0);
if (allocations.length !== 6 || total !== 100) {
  throw new Error(`Expected six allocation slices totaling 100%; found ${allocations.join(', ')} (total ${total}).`);
}

console.log('PASS: launch-site visual contract');
console.log('PASS: accessible six-slice token allocation pie chart totals 100%');
console.log('PASS: English, Simplified Chinese and Japanese translations are complete');
