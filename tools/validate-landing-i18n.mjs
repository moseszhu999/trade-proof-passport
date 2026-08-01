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
  'Before RWA,',
  '现实资产之前，',
  'RWA の前に、',
  'Share proofs, not secrets',
  '只分享证明，不交出秘密',
  '秘密ではなく証明を共有',
  'RWP Core + Viral Proof Cards are live.',
  'RWP Core 与 Viral Proof Card 已上线。',
  'RWP Core と Viral Proof Card が公開されました。',
  "href = './rwp.html'",
  "setAttribute('href', './rwp.html')",
  'data-rwp-home-link',
  'applyRwpEntryPoints',
  'tradeProofLocale'
], 'internationalization and RWP entry contract');

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

if (getMessage('en', 'heroLine1') !== 'Before RWA,') throw new Error('English RWP headline mismatch.');
if (getMessage('zh-CN', 'heroLine1') !== '现实资产之前，') throw new Error('Chinese RWP headline mismatch.');
if (getMessage('ja-JP', 'heroLine1') !== 'RWA の前に、') throw new Error('Japanese RWP headline mismatch.');
for (const locale of supportedLocales) {
  const announcement = getMessage(locale, 'announcement');
  if (!announcement.includes('./rwp.html')) throw new Error(`${locale} announcement does not link to RWP.`);
  if (!getMessage(locale, 'openExample').toLowerCase().includes('proof card')) {
    throw new Error(`${locale} secondary hero CTA does not identify Proof Card.`);
  }
}

const allocations = [...landing.matchAll(/<b>(45|20|15|10|5)%<\/b>/g)].map((match) => Number(match[1]));
const total = allocations.reduce((sum, value) => sum + value, 0);
if (allocations.length !== 6 || total !== 100) {
  throw new Error(`Expected six allocation slices totaling 100%; found ${allocations.join(', ')} (total ${total}).`);
}

console.log('PASS: launch-site visual contract');
console.log('PASS: accessible six-slice token allocation pie chart totals 100%');
console.log('PASS: English, Simplified Chinese and Japanese RWP narratives are complete');
console.log('PASS: homepage nav, announcement and hero CTA route to Viral Proof Cards');
