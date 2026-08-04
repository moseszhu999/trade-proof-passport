const root = document.querySelector('[data-trade-operations-root]');
const status = document.querySelector('[data-load-status]');
let resolved = false;

function escapeHtml(value) {
  return String(value ?? '未知错误').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function showFailure(reason) {
  if (resolved || !root) return;
  const detail = escapeHtml(reason);
  if (status) status.textContent = '页面资源加载失败';
  root.innerHTML = `
    <section class="fatal" role="alert">
      <strong>TradeOS 工作台未能正常载入</strong>
      <span>${detail}</span>
      <p>请刷新页面；若仍然失败，可先返回招商首页。页面不会因此执行任何外部业务操作。</p>
      <div class="actions"><a href="./">返回招商首页</a><button type="button" data-reload-page>重新加载</button></div>
    </section>`;
  root.querySelector('[data-reload-page]')?.addEventListener('click', () => window.location.reload());
}

window.addEventListener('error', (event) => {
  showFailure(event.error?.message || event.message || 'JavaScript module failed to load.');
});

window.addEventListener('unhandledrejection', (event) => {
  showFailure(event.reason?.message || event.reason || 'An asynchronous operation failed.');
});

const observer = new MutationObserver(() => {
  if (root?.children.length > 0 && !root.querySelector('.fatal')) {
    resolved = true;
    observer.disconnect();
  }
});

if (root) observer.observe(root, { childList: true, subtree: true });

window.setTimeout(() => {
  if (!resolved && root?.children.length === 0) {
    showFailure('页面资源加载超时。可能是 GitHub Pages 网络或静态资源暂时不可达。');
  }
}, 12000);
