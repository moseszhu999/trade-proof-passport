#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";

const REQUIRED_TOP_LEVEL = [
  "schemaVersion",
  "passportId",
  "createdAt",
  "updatedAt",
  "tradeCase",
  "parties",
  "facts",
  "evidence",
  "confirmations",
  "lifecycle",
  "disclosure"
];

const FACT_STATUSES = new Set([
  "asserted",
  "confirmed",
  "disputed",
  "superseded",
  "expired",
  "revoked"
]);

const DECISIONS = new Set([
  "confirm",
  "reject",
  "request_change",
  "acknowledge"
]);

const PASSPORT_STATUSES = new Set([
  "draft",
  "active",
  "superseded",
  "expired",
  "revoked"
]);

const DISCLOSURE_PROFILES = new Set([
  "private",
  "shared",
  "public_summary"
]);

const DIGEST_LENGTHS = {
  sha256: 64,
  sha384: 96,
  sha512: 128,
  keccak256: 64
};

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates];
}

function isDateTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function validate(passport) {
  const errors = [];
  const warnings = [];

  if (!passport || typeof passport !== "object" || Array.isArray(passport)) {
    return { errors: ["Passport root must be a JSON object."], warnings };
  }

  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in passport)) errors.push(`Missing required top-level field: ${field}`);
  }

  if (passport.schemaVersion !== "0.1") {
    errors.push('schemaVersion must equal "0.1".');
  }

  for (const field of ["createdAt", "updatedAt"]) {
    if (!isDateTime(passport[field])) errors.push(`${field} must be a valid date-time.`);
  }

  if (!passport.tradeCase || typeof passport.tradeCase !== "object") {
    errors.push("tradeCase must be an object.");
  } else {
    if (!passport.tradeCase.caseReference) errors.push("tradeCase.caseReference is required.");
    if (!passport.tradeCase.goodsDescription) errors.push("tradeCase.goodsDescription is required.");
  }

  for (const field of ["parties", "facts", "evidence", "confirmations"]) {
    if (!Array.isArray(passport[field])) errors.push(`${field} must be an array.`);
  }

  const parties = Array.isArray(passport.parties) ? passport.parties : [];
  const facts = Array.isArray(passport.facts) ? passport.facts : [];
  const evidence = Array.isArray(passport.evidence) ? passport.evidence : [];
  const confirmations = Array.isArray(passport.confirmations) ? passport.confirmations : [];

  const partyIds = parties.map((item) => item?.partyId).filter(Boolean);
  const factIds = facts.map((item) => item?.factId).filter(Boolean);
  const evidenceIds = evidence.map((item) => item?.evidenceId).filter(Boolean);
  const confirmationIds = confirmations.map((item) => item?.confirmationId).filter(Boolean);

  for (const [label, values] of [
    ["partyId", partyIds],
    ["factId", factIds],
    ["evidenceId", evidenceIds],
    ["confirmationId", confirmationIds]
  ]) {
    for (const duplicate of duplicateValues(values)) {
      errors.push(`Duplicate ${label}: ${duplicate}`);
    }
  }

  const partySet = new Set(partyIds);
  const evidenceSet = new Set(evidenceIds);
  const factMap = new Map(facts.map((fact) => [fact?.factId, fact]));

  parties.forEach((party, index) => {
    if (!party?.partyId) errors.push(`parties[${index}].partyId is required.`);
    if (!party?.role) errors.push(`parties[${index}].role is required.`);
    if (!party?.displayName) errors.push(`parties[${index}].displayName is required.`);
  });

  evidence.forEach((item, index) => {
    if (!item?.evidenceId) errors.push(`evidence[${index}].evidenceId is required.`);
    if (!item?.type) errors.push(`evidence[${index}].type is required.`);
    if (!item?.title) errors.push(`evidence[${index}].title is required.`);
    if (!DISCLOSURE_PROFILES.has(item?.disclosure)) {
      errors.push(`evidence[${index}].disclosure is invalid.`);
    }

    const algorithm = item?.digest?.algorithm;
    const value = item?.digest?.value;

    if (!algorithm || !(algorithm in DIGEST_LENGTHS)) {
      errors.push(`evidence[${index}].digest.algorithm is unsupported.`);
    } else if (typeof value !== "string" || !/^[a-fA-F0-9]+$/.test(value)) {
      errors.push(`evidence[${index}].digest.value must be hexadecimal.`);
    } else if (value.length !== DIGEST_LENGTHS[algorithm]) {
      errors.push(
        `evidence[${index}].digest.value must be ${DIGEST_LENGTHS[algorithm]} hex characters for ${algorithm}.`
      );
    }

    if (item?.issuedBy && !partySet.has(item.issuedBy)) {
      errors.push(`evidence[${index}] references unknown issuedBy party: ${item.issuedBy}`);
    }
  });

  facts.forEach((fact, index) => {
    if (!fact?.factId) errors.push(`facts[${index}].factId is required.`);
    if (!fact?.type) errors.push(`facts[${index}].type is required.`);
    if (!fact?.statement) errors.push(`facts[${index}].statement is required.`);
    if (!FACT_STATUSES.has(fact?.status)) errors.push(`facts[${index}].status is invalid.`);
    if (!Number.isInteger(fact?.version) || fact.version < 1) {
      errors.push(`facts[${index}].version must be a positive integer.`);
    }
    if (!partySet.has(fact?.assertedBy)) {
      errors.push(`facts[${index}] references unknown assertedBy party: ${fact?.assertedBy}`);
    }
    if (!isDateTime(fact?.assertedAt)) errors.push(`facts[${index}].assertedAt is invalid.`);

    if (!Array.isArray(fact?.evidenceRefs)) {
      errors.push(`facts[${index}].evidenceRefs must be an array.`);
    } else {
      for (const evidenceRef of fact.evidenceRefs) {
        if (!evidenceSet.has(evidenceRef)) {
          errors.push(`facts[${index}] references unknown evidence: ${evidenceRef}`);
        }
      }
    }

    if (fact?.supersedesFactId) {
      if (fact.supersedesFactId === fact.factId) {
        errors.push(`facts[${index}] cannot supersede itself.`);
      } else if (!factMap.has(fact.supersedesFactId)) {
        errors.push(`facts[${index}] supersedes unknown fact: ${fact.supersedesFactId}`);
      }
    }
  });

  confirmations.forEach((confirmation, index) => {
    if (!confirmation?.confirmationId) {
      errors.push(`confirmations[${index}].confirmationId is required.`);
    }

    const fact = factMap.get(confirmation?.factId);
    if (!fact) {
      errors.push(`confirmations[${index}] references unknown fact: ${confirmation?.factId}`);
    } else if (confirmation.factVersion !== fact.version) {
      errors.push(
        `confirmations[${index}] addresses fact version ${confirmation.factVersion}, but ${confirmation.factId} is version ${fact.version}.`
      );
    }

    if (!partySet.has(confirmation?.partyId)) {
      errors.push(`confirmations[${index}] references unknown party: ${confirmation?.partyId}`);
    }
    if (!DECISIONS.has(confirmation?.decision)) {
      errors.push(`confirmations[${index}].decision is invalid.`);
    }
    if (!isDateTime(confirmation?.decidedAt)) {
      errors.push(`confirmations[${index}].decidedAt is invalid.`);
    }
  });

  if (!PASSPORT_STATUSES.has(passport.lifecycle?.status)) {
    errors.push("lifecycle.status is invalid.");
  }

  if (!DISCLOSURE_PROFILES.has(passport.disclosure?.profile)) {
    errors.push("disclosure.profile is invalid.");
  }

  if (passport.lifecycle?.status === "revoked") {
    if (!passport.lifecycle.revokedAt) warnings.push("Revoked passport has no revokedAt timestamp.");
    if (!passport.lifecycle.revocationReason) warnings.push("Revoked passport has no revocationReason.");
  }

  if (facts.length === 0) warnings.push("Passport contains no facts.");
  if (confirmations.length === 0) warnings.push("Passport contains no confirmations.");

  return { errors, warnings };
}

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: node tools/verify-passport.mjs <passport.json>");
    process.exit(2);
  }

  let passport;
  try {
    passport = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    console.error(`FAIL: could not read valid JSON from ${filePath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  const { errors, warnings } = validate(passport);

  for (const warning of warnings) console.warn(`WARN: ${warning}`);

  if (errors.length > 0) {
    console.error(`FAIL: ${errors.length} validation error(s)`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`PASS: ${passport.passportId}`);
  console.log(`Facts: ${passport.facts.length}`);
  console.log(`Evidence records: ${passport.evidence.length}`);
  console.log(`Confirmations: ${passport.confirmations.length}`);
}

await main();
