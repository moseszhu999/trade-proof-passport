import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalizeJson } from '../docs/rwp-card.mjs';
import {
  RWP_EXTERNAL_ADOPTION_PILOT_ASSURANCE,
  RWP_EXTERNAL_ADOPTION_PILOT_BOUNDARIES,
  buildRwpExternalAdoptionPilot,
  validateRwpExternalAdoptionPilot
} from '../docs/rwp-external-adoption-pilot.mjs';

export const RWP_EXTERNAL_CONTRIBUTION_BASE_REPOSITORY =
  'moseszhu999/trade-proof-passport';
export const RWP_EXTERNAL_CONTRIBUTION_ROOT =
  'examples/rwp-adoption-pilots';
export const RWP_EXTERNAL_CONTRIBUTION_REQUIRED_FILES = Object.freeze([
  'pilot.json',
  'public-projection.json'
]);
export const RWP_EXTERNAL_CONTRIBUTION_OPTIONAL_FILES = Object.freeze([
  'README.md'
]);

const MAX_FILE_BYTES = Object.freeze({
  'pilot.json': 900_000,
  'public-projection.json': 120_000,
  'README.md': 30_000
});

const FORBIDDEN_SECRET_PATTERNS = Object.freeze([
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|pk)-(?:live|test|proj)-[a-z0-9_-]{12,}\b/i,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /"?(?:privateKey|private_key|mnemonic|seedPhrase|seed_phrase|apiToken|api_token|accessToken|access_token|password|bankAccount|bank_account|accountNumber|account_number|routingNumber|routing_number|iban)"?\s*:/i
]);

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isSha = (value) => /^[0-9a-f]{40}$/i.test(value ?? '');
const allowedNames = new Set([
  ...RWP_EXTERNAL_CONTRIBUTION_REQUIRED_FILES,
  ...RWP_EXTERNAL_CONTRIBUTION_OPTIONAL_FILES
]);

const detectForbiddenSecret = (text) =>
  FORBIDDEN_SECRET_PATTERNS.find((pattern) => pattern.test(text));

const parseContributionPath = (path) => {
  const match = new RegExp(
    `^${RWP_EXTERNAL_CONTRIBUTION_ROOT}/([a-z0-9][a-z0-9-]{2,62})/([^/]+)$`
  ).exec(path ?? '');
  if (!match) return null;
  return { slug: match[1], name: match[2] };
};

export const validateExternalContributionOrigin = (event, changedFiles) => {
  const errors = [];
  const pullRequest = event?.pull_request;
  if (!isRecord(pullRequest)) {
    return ['A GitHub pull_request event payload is required.'];
  }

  const baseRepository = pullRequest.base?.repo?.full_name;
  const headRepository = pullRequest.head?.repo?.full_name;
  const contributor = pullRequest.user?.login;
  const contributorType = pullRequest.user?.type;
  const baseOwner = pullRequest.base?.repo?.owner?.login;
  const headSha = pullRequest.head?.sha;

  if (baseRepository !== RWP_EXTERNAL_CONTRIBUTION_BASE_REPOSITORY) {
    errors.push(`Base repository must be ${RWP_EXTERNAL_CONTRIBUTION_BASE_REPOSITORY}.`);
  }
  if (!headRepository || headRepository === baseRepository) {
    errors.push('External adoption submissions must originate from an external fork.');
  }
  if (pullRequest.head?.repo?.fork !== true) {
    errors.push('The pull request head repository must be marked as a fork.');
  }
  if (!contributor || contributor === baseOwner) {
    errors.push('The contributor must differ from the base repository owner.');
  }
  if (contributorType === 'Bot') {
    errors.push('Bot-authored submissions are not accepted as independent adoption candidates.');
  }
  if (!isSha(headSha)) {
    errors.push('The pull request head SHA is missing or invalid.');
  }

  if (!Array.isArray(changedFiles) || changedFiles.length < 2 || changedFiles.length > 3) {
    errors.push('A contribution must change exactly two required files and at most one README.');
    return errors;
  }

  const parsed = [];
  for (const file of changedFiles) {
    const location = parseContributionPath(file?.filename);
    if (!location) {
      errors.push(
        `Contribution PRs are data-only; unexpected changed path: ${file?.filename ?? 'unknown'}.`
      );
      continue;
    }
    if (!allowedNames.has(location.name)) {
      errors.push(`Unsupported contribution file: ${file.filename}.`);
    }
    if (file.status !== 'added') {
      errors.push(`Contribution files are append-only and must be newly added: ${file.filename}.`);
    }
    parsed.push(location);
  }

  const slugs = new Set(parsed.map((item) => item.slug));
  if (slugs.size !== 1) {
    errors.push('All contribution files must belong to one new pilot slug.');
  }
  const names = new Set(parsed.map((item) => item.name));
  for (const required of RWP_EXTERNAL_CONTRIBUTION_REQUIRED_FILES) {
    if (!names.has(required)) errors.push(`Missing required contribution file: ${required}.`);
  }

  return errors;
};

export const validateExternalContributionPack = ({
  event,
  changedFiles,
  files
}) => {
  const errors = validateExternalContributionOrigin(event, changedFiles);
  if (!isRecord(files)) {
    errors.push('Fetched contribution files are required.');
    return errors;
  }

  const locations = changedFiles
    .map((file) => parseContributionPath(file?.filename))
    .filter(Boolean);
  const slug = locations[0]?.slug;

  for (const { name } of locations) {
    const text = files[name];
    if (typeof text !== 'string') {
      errors.push(`Fetched content is missing for ${name}.`);
      continue;
    }
    const size = Buffer.byteLength(text, 'utf8');
    if (size > MAX_FILE_BYTES[name]) {
      errors.push(`${name} exceeds the public contribution size limit.`);
    }
    const forbidden = detectForbiddenSecret(text);
    if (forbidden) {
      errors.push(`${name} contains a forbidden secret or sensitive account marker.`);
    }
  }

  let pilot;
  let publicProjection;
  try {
    pilot = JSON.parse(files['pilot.json']);
  } catch (error) {
    errors.push(`pilot.json is not valid JSON: ${error.message}`);
  }
  try {
    publicProjection = JSON.parse(files['public-projection.json']);
  } catch (error) {
    errors.push(`public-projection.json is not valid JSON: ${error.message}`);
  }

  if (pilot) {
    const pilotErrors = validateRwpExternalAdoptionPilot(pilot);
    errors.push(...pilotErrors.map((error) => `pilot.json: ${error}`));

    if (pilot.pilot?.syntheticByDefault !== false) {
      errors.push(
        'External submissions must use two explicitly supplied adopter Passports; the built-in synthetic default is not accepted.'
      );
    }
    if (pilot.pilot?.assurance !== RWP_EXTERNAL_ADOPTION_PILOT_ASSURANCE) {
      errors.push('Pilot assurance text does not match the bounded v0.1 contract.');
    }
    if (
      canonicalizeJson(pilot.pilot?.boundaries) !==
      canonicalizeJson(RWP_EXTERNAL_ADOPTION_PILOT_BOUNDARIES)
    ) {
      errors.push('Pilot boundaries do not match the bounded v0.1 contract.');
    }
    if (pilot.summary?.verifiedAdoptionUnits !== 2) {
      errors.push('The submitted Pilot must contain exactly two verified adoption units.');
    }
    if (pilot.summary?.duplicateSubmissionsRejected !== 1) {
      errors.push('The submitted Pilot must reject exactly one duplicate Adoption Card.');
    }
    if (pilot.summary?.pullRequestsCounted !== 0) {
      errors.push('A pull request must count as zero adoption units.');
    }
    if (pilot.summary?.pageViewsCounted !== 0 || pilot.summary?.starsCounted !== 0) {
      errors.push('Views and stars must count as zero adoption units.');
    }
  }

  if (pilot && publicProjection) {
    if (
      canonicalizeJson(publicProjection) !==
      canonicalizeJson(pilot.publicProjection)
    ) {
      errors.push(
        'public-projection.json must exactly match the validated Pilot publicProjection.'
      );
    }
  }

  if (slug && files['README.md']) {
    const readme = files['README.md'];
    if (!readme.includes('public') || !readme.includes('authorized')) {
      errors.push(
        'README.md must state that the committed material is public or explicitly authorized.'
      );
    }
  }

  return errors;
};

const githubRequest = async (url, token) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'trade-proof-passport-external-adoption-gate'
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${url}`);
  }
  return response.json();
};

const fetchChangedFiles = async (event, token) => {
  const baseRepo = event.pull_request.base.repo.full_name;
  const number = event.pull_request.number;
  const result = [];
  for (let page = 1; page <= 10; page += 1) {
    const values = await githubRequest(
      `https://api.github.com/repos/${baseRepo}/pulls/${number}/files?per_page=100&page=${page}`,
      token
    );
    result.push(...values);
    if (values.length < 100) break;
  }
  return result;
};

const fetchHeadFile = async (event, path, token) => {
  const headRepo = event.pull_request.head.repo.full_name;
  const headSha = event.pull_request.head.sha;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const value = await githubRequest(
    `https://api.github.com/repos/${headRepo}/contents/${encodedPath}?ref=${headSha}`,
    token
  );
  if (value.type !== 'file' || value.encoding !== 'base64') {
    throw new Error(`Expected one base64 file for ${path}.`);
  }
  return Buffer.from(value.content.replace(/\n/g, ''), 'base64').toString('utf8');
};

const runSelfTest = async () => {
  const basePassport = JSON.parse(
    await readFile(new URL('../examples/steel-cabinet-passport.json', import.meta.url), 'utf8')
  );
  const adopterOne = structuredClone(basePassport);
  adopterOne.passportId = 'tpp:external-contributor:one';
  adopterOne.tradeCase.caseReference = 'EXT-CONTRIBUTOR-ONE';
  adopterOne.createdAt = '2026-08-10T00:00:00.000Z';
  adopterOne.updatedAt = '2026-08-10T00:30:00.000Z';
  const adopterTwo = structuredClone(basePassport);
  adopterTwo.passportId = 'tpp:external-contributor:two';
  adopterTwo.tradeCase.caseReference = 'EXT-CONTRIBUTOR-TWO';
  adopterTwo.createdAt = '2026-08-11T00:00:00.000Z';
  adopterTwo.updatedAt = '2026-08-11T00:30:00.000Z';

  const pilot = buildRwpExternalAdoptionPilot(
    basePassport,
    [adopterOne, adopterTwo],
    { generatedAt: '2026-08-12T00:00:00.000Z' }
  );
  const slug = 'independent-cabinet-pilot';
  const root = `${RWP_EXTERNAL_CONTRIBUTION_ROOT}/${slug}`;
  const changedFiles = [
    { filename: `${root}/pilot.json`, status: 'added' },
    { filename: `${root}/public-projection.json`, status: 'added' },
    { filename: `${root}/README.md`, status: 'added' }
  ];
  const event = {
    pull_request: {
      number: 101,
      user: { login: 'independent-adopter', type: 'User' },
      base: {
        repo: {
          full_name: RWP_EXTERNAL_CONTRIBUTION_BASE_REPOSITORY,
          owner: { login: 'moseszhu999' }
        }
      },
      head: {
        sha: '0123456789abcdef0123456789abcdef01234567',
        repo: {
          full_name: 'independent-adopter/trade-proof-passport',
          fork: true
        }
      }
    }
  };
  const files = {
    'pilot.json': `${JSON.stringify(pilot, null, 2)}\n`,
    'public-projection.json': `${JSON.stringify(pilot.publicProjection, null, 2)}\n`,
    'README.md':
      '# Independent public pilot\n\nAll committed material is public or explicitly authorized for public release.\n'
  };

  assert.deepEqual(
    validateExternalContributionPack({ event, changedFiles, files }),
    []
  );

  const sameRepo = structuredClone(event);
  sameRepo.pull_request.head.repo.full_name =
    RWP_EXTERNAL_CONTRIBUTION_BASE_REPOSITORY;
  sameRepo.pull_request.head.repo.fork = false;
  assert.ok(
    validateExternalContributionPack({
      event: sameRepo,
      changedFiles,
      files
    }).some((error) => /external fork/.test(error))
  );

  const codeChange = [
    ...changedFiles,
    { filename: 'tools/unsafe-change.mjs', status: 'added' }
  ];
  assert.ok(
    validateExternalContributionPack({
      event,
      changedFiles: codeChange,
      files
    }).some((error) => /data-only|exactly two required files/.test(error))
  );

  const tamperedProjection = structuredClone(pilot.publicProjection);
  tamperedProjection.proofLiquidity.verifiedAdoptionUnits = 99;
  assert.ok(
    validateExternalContributionPack({
      event,
      changedFiles,
      files: {
        ...files,
        'public-projection.json': JSON.stringify(tamperedProjection)
      }
    }).some((error) => /exactly match/.test(error))
  );

  const syntheticDefault = buildRwpExternalAdoptionPilot(basePassport);
  assert.ok(
    validateExternalContributionPack({
      event,
      changedFiles,
      files: {
        ...files,
        'pilot.json': JSON.stringify(syntheticDefault),
        'public-projection.json': JSON.stringify(
          syntheticDefault.publicProjection
        )
      }
    }).some((error) => /synthetic default/.test(error))
  );

  assert.ok(
    validateExternalContributionPack({
      event,
      changedFiles,
      files: {
        ...files,
        'README.md': `${files['README.md']}\napiToken: "secret-value"\n`
      }
    }).some((error) => /forbidden secret/.test(error))
  );

  assert.equal(pilot.summary.verifiedAdoptionUnits, 2);
  assert.equal(pilot.summary.pullRequestsCounted, 0);
  console.log(
    'PASS: external-fork origin, append-only data scope, complete Pilot reconstruction, exact public projection and zero PR-count boundary'
  );
};

const runEventValidation = async () => {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const token = process.env.GITHUB_TOKEN;
  if (!eventPath || !token) {
    throw new Error('GITHUB_EVENT_PATH and GITHUB_TOKEN are required.');
  }
  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  const changedFiles = await fetchChangedFiles(event, token);
  const locations = changedFiles
    .map((file) => parseContributionPath(file.filename))
    .filter(Boolean);
  const slug = locations[0]?.slug;
  const files = {};

  for (const file of changedFiles) {
    const location = parseContributionPath(file.filename);
    if (!location || !allowedNames.has(location.name)) continue;
    files[location.name] = await fetchHeadFile(event, file.filename, token);
  }

  const errors = validateExternalContributionPack({
    event,
    changedFiles,
    files
  });
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }

  const pilot = JSON.parse(files['pilot.json']);
  console.log(
    `PASS: external adoption candidate ${slug} from ${event.pull_request.head.repo.full_name}@${event.pull_request.head.sha}`
  );
  console.log(
    `Verified protocol-adoption units: ${pilot.summary.verifiedAdoptionUnits}; duplicate submissions rejected: ${pilot.summary.duplicateSubmissionsRejected}`
  );
  console.log(
    'Boundary: GitHub fork/commit provenance is transport provenance only, not identity authentication, attestation, endorsement, ranking, or legal approval.'
  );
};

const mode = process.argv[2] ?? '--self-test';
if (mode === '--self-test') {
  await runSelfTest();
} else if (mode === '--event') {
  await runEventValidation();
} else {
  console.error(
    'Usage: node tools/verify-rwp-external-adoption-contribution.mjs [--self-test|--event]'
  );
  process.exit(1);
}
