import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const operations = read('docs/operations.html');
const guard = read('docs/pages-runtime-guard.mjs');
const notFound = read('docs/404.html');
const health = JSON.parse(read('docs/health.json'));

const failures = [];
const requireText = (source, token, label) => {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
};

requireText(operations, './pages-runtime-guard.mjs', 'operations entry');
requireText(operations, './operations.mjs', 'operations entry');
requireText(operations, './enterprise-operations-shell-v1.mjs', 'operations entry');
requireText(guard, "window.addEventListener('error'", 'runtime guard');
requireText(guard, "window.addEventListener('unhandledrejection'", 'runtime guard');
requireText(guard, '页面资源加载超时', 'runtime guard');
requireText(notFound, './operations.html', '404 recovery');
requireText(notFound, '打开招商首页', '404 recovery');

if (health.site !== 'trade-proof-passport' || health.status !== 'ok') {
  failures.push('health.json must identify trade-proof-passport with status=ok');
}
if (!health.entrypoints?.includes('index.html') || !health.entrypoints?.includes('operations.html')) {
  failures.push('health.json must list index.html and operations.html');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('PASS: GitHub Pages static publishing, health probe, route recovery and operations runtime guard');
