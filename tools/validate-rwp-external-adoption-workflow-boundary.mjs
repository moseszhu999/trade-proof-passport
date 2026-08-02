import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fullWorkflow = await readFile(
  new URL('../.github/workflows/validate.yml', import.meta.url),
  'utf8'
);
const contributionWorkflow = await readFile(
  new URL(
    '../.github/workflows/validate-external-adoption-submission.yml',
    import.meta.url
  ),
  'utf8'
);

assert.match(
  fullWorkflow,
  /if: github\.event_name != 'pull_request' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  'Executable full CI must skip fork pull requests.'
);
assert.match(
  contributionWorkflow,
  /pull_request_target:/,
  'External data submissions must use pull_request_target.'
);
assert.match(
  contributionWorkflow,
  /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
  'External submission validation must check out the exact trusted base SHA.'
);
assert.match(
  contributionWorkflow,
  /persist-credentials: false/,
  'Trusted-base checkout must not persist credentials.'
);
assert.match(
  contributionWorkflow,
  /permissions:\n  contents: read\n  pull-requests: read/,
  'External submission validation must remain read-only.'
);
assert.doesNotMatch(
  contributionWorkflow,
  /checkout[^\n]*head|ref:.*pull_request\.head\.sha|github\.head_ref/i,
  'External submission validation must never check out fork code.'
);
assert.match(
  contributionWorkflow,
  /verify-rwp-external-adoption-contribution\.mjs --event/,
  'External submission validation must use the bounded data verifier.'
);

console.log(
  'PASS: fork code is not executed; full CI is same-repository only and external submissions use trusted-base read-only data validation'
);
