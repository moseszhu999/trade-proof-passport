import { readFileSync, writeFileSync } from 'node:fs';

const replaceOnce = (source, oldValue, newValue, label) => {
  if (source.includes(newValue)) return source;
  if (!source.includes(oldValue)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(oldValue, newValue);
};

const update = (path, transform) => {
  const source = readFileSync(path, 'utf8');
  const output = transform(source);
  if (output !== source) writeFileSync(path, output, 'utf8');
};

update('docs/season-allocation.mjs', (source) =>
  replaceOnce(
    source,
    "  if (eligible.length === 0) throw new Error('No eligible accounts');\n\n  eligible.sort((left, right) => compareHex(left.account, right.account));",
    "  if (eligible.length === 0) throw new Error('No eligible accounts');\n\n  eligible.sort((left, right) => compareHex(left.account, right.account));\n  excluded.sort((left, right) => compareHex(left.account, right.account));",
    'deterministic excluded-account ordering'
  )
);

update('docs/index.html', (source) => {
  source = replaceOnce(
    source,
    '<a href="#token">$TPROOF</a><a href="./tokenomics.html">Economics</a><a href="#roadmap">Roadmap</a>',
    '<a href="#token">$TPROOF</a><a href="./tokenomics.html">Economics</a><a href="./genesis.html">Genesis</a><a href="#roadmap">Roadmap</a>',
    'homepage navigation'
  );
  source = replaceOnce(
    source,
    '<a class="cta primary" href="./create.html">Earn your first proof activity</a><a class="cta" href="./tokenomics.html">Read Token Economics</a><button class="cta" id="shareProject" type="button">Share the project</button>',
    '<a class="cta primary" href="./create.html">Earn your first proof activity</a><a class="cta" href="./tokenomics.html">Read Token Economics</a><a class="cta" href="./genesis.html">Simulate Genesis Proof</a><button class="cta" id="shareProject" type="button">Share the project</button>',
    'homepage Token card'
  );
  source = replaceOnce(
    source,
    '<a class="cta primary" href="./create.html">Create a Passport →</a><a class="cta" href="./tokenomics.html">Explore Token Economics</a><a class="cta" href="./example.html">See the example</a>',
    '<a class="cta primary" href="./create.html">Create a Passport →</a><a class="cta" href="./tokenomics.html">Explore Token Economics</a><a class="cta" href="./genesis.html">Open Genesis Simulator</a><a class="cta" href="./example.html">See the example</a>',
    'homepage final CTA'
  );
  source = replaceOnce(
    source,
    '<a href="./respond.html">Respond</a><a href="./tokenomics.html">Tokenomics</a><a href="https://github.com/moseszhu999/trade-proof-passport" rel="noopener">GitHub</a>',
    '<a href="./respond.html">Respond</a><a href="./tokenomics.html">Tokenomics</a><a href="./genesis.html">Genesis Simulator</a><a href="https://github.com/moseszhu999/trade-proof-passport" rel="noopener">GitHub</a>',
    'homepage footer'
  );
  return source;
});

update('docs/tokenomics.html', (source) => {
  source = replaceOnce(
    source,
    '<a href="#loop">Value loop</a><a href="#allocation">Allocation</a><a href="#utility">Utility</a><a class="button" href="./create.html">Launch app ↗</a>',
    '<a href="#loop">Value loop</a><a href="#allocation">Allocation</a><a href="#utility">Utility</a><a href="./genesis.html">Simulator</a><a class="button" href="./create.html">Launch app ↗</a>',
    'tokenomics navigation'
  );
  source = replaceOnce(
    source,
    '<a class="button primary" href="../standard/tproof-token-economics-v0.1.md">Read the constitution</a><a class="button" href="../tokenomics/tproof-tokenomics-v0.1.json">Inspect the JSON</a><a class="button" href="https://github.com/moseszhu999/trade-proof-passport" rel="noopener">Verify on GitHub ↗</a>',
    '<a class="button primary" href="../standard/tproof-token-economics-v0.1.md">Read the constitution</a><a class="button" href="./genesis.html">Run Genesis simulator</a><a class="button" href="../tokenomics/tproof-tokenomics-v0.1.json">Inspect the JSON</a><a class="button" href="https://github.com/moseszhu999/trade-proof-passport" rel="noopener">Verify on GitHub ↗</a>',
    'tokenomics hero actions'
  );
  source = replaceOnce(
    source,
    '<div class="warning"><b>No token is live and no claim is active.</b> Genesis eligibility rules, anti-Sybil review, legal review, audited contracts and community approval must all exist before settlement.</div></article></section>',
    '<div class="warning"><b>No token is live and no claim is active.</b> Genesis eligibility rules, anti-Sybil review, legal review, audited contracts and community approval must all exist before settlement.</div><div class="actions"><a class="button primary" href="./genesis.html">Simulate the allocation →</a></div></article></section>',
    'tokenomics Genesis CTA'
  );
  return source;
});

update('docs/sitemap.xml', (source) =>
  replaceOnce(
    source,
    '  <url>\n    <loc>https://moseszhu999.github.io/trade-proof-passport/example.html</loc>',
    '  <url>\n    <loc>https://moseszhu999.github.io/trade-proof-passport/genesis.html</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.95</priority>\n  </url>\n  <url>\n    <loc>https://moseszhu999.github.io/trade-proof-passport/example.html</loc>',
    'Genesis sitemap URL'
  )
);

update('README.md', (source) => {
  source = replaceOnce(
    source,
    '- Token economics: `https://moseszhu999.github.io/trade-proof-passport/tokenomics.html`\n- Create a Passport:',
    '- Token economics: `https://moseszhu999.github.io/trade-proof-passport/tokenomics.html`\n- Genesis Proof simulator: `https://moseszhu999.github.io/trade-proof-passport/genesis.html`\n- Create a Passport:',
    'README live simulator'
  );
  source = replaceOnce(
    source,
    '```bash\nnode tools/verify-tokenomics.mjs\n```\n\nThe model separates three assets:',
    '```bash\nnode tools/verify-tokenomics.mjs\nnode tools/verify-season-allocation.mjs\nnode tools/compile-season-allocation.mjs examples/genesis-proof-allocation-input.json\n```\n\nThe allocation compiler is dependency-free and runs in both Node.js and the browser. It converts public closed-season Points into a deterministic square-root allocation, Solidity-compatible claim leaves, Merkle proofs, a Merkle root and a canonical dataset digest. It does not require a private eligibility database and does not activate a claim.\n\nThe model separates three assets:',
    'README allocation verification'
  );
  source = replaceOnce(
    source,
    'examples/steel-cabinet-passport.json\ntools/verify-passport.mjs\ntools/verify-tokenomics.mjs\ndocs/index.html\ndocs/tokenomics.html',
    'examples/steel-cabinet-passport.json\nexamples/genesis-proof-allocation-input.json\nexamples/genesis-proof-allocation-output.json\ntools/verify-passport.mjs\ntools/verify-tokenomics.mjs\ntools/compile-season-allocation.mjs\ntools/verify-season-allocation.mjs\ntools/verify-season-allocation-cast.mjs\ndocs/season-allocation.mjs\ndocs/index.html\ndocs/tokenomics.html\ndocs/genesis.html',
    'README repository structure'
  );
  source = replaceOnce(
    source,
    '4. **Contribution before liquidity** — non-transferable Proof Points and receipts precede Token distribution.\n5. **Privacy-bounded**',
    '4. **Contribution before liquidity** — non-transferable Proof Points and receipts precede Token distribution.\n5. **Public allocation data, not a private eligibility database** — deterministic inputs produce independently reproducible rewards, leaves, roots and digests.\n6. **Privacy-bounded**',
    'README allocation design principle'
  );
  source = source.replace('6. **Onchain integrity', '7. **Onchain integrity');
  source = source.replace('7. **Contributor ownership', '8. **Contributor ownership');
  source = source.replace('8. **Portable and open', '9. **Portable and open');
  return source;
});

update('tools/validate-tokenomics-page.mjs', (source) => {
  source = replaceOnce(
    source,
    "  '>Tokenomics<'\n], 'homepage tokenomics discovery');",
    "  '>Tokenomics<',\n  './genesis.html',\n  'Simulate Genesis Proof'\n], 'homepage tokenomics discovery');",
    'tokenomics validator homepage links'
  );
  source = replaceOnce(
    source,
    "  '../tokenomics/tproof-tokenomics-v0.1.json'\n], 'public tokenomics content');",
    "  '../tokenomics/tproof-tokenomics-v0.1.json',\n  './genesis.html',\n  'Run Genesis simulator',\n  'Simulate the allocation →'\n], 'public tokenomics content');",
    'tokenomics validator simulator links'
  );
  return source;
});

console.log('PASS: Genesis allocation discovery surfaces integrated');
