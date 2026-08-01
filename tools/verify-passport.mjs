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

const FACT_STATUSES = new Set(["asserted", "confirmed", "disputed", "superseded", "expired", "revoked"]);
const DECISIONS = new Set(["confirm", "reject", "request_change", "acknowledge"]);
const PASSPORT_STATUSES = new Set(["draft", "active", "superseded", "expired", "revoked"]);
const DISCLOSURE_PROFILES = new Set(["private", "shared", "public_summary"]);
const PROVENANCE_METHODS = new Set(["manual", "document_parser", "system_event", "agent_assisted"]);
const PROVENANCE_LOCATORS = ["page", "field", "cell", "jsonPointer", "eventId"];
const LINEAGE_RELATIONS = new Set(["derived_from", "responds_to", "reuses_pattern_from"]);
const LINEAGE_SOURCE_TYPES = new Set(["TradeProofPassport", "RealWorldProofCard", "RealWorldProofRequest"]);
const DIGEST_LENGTHS = { sha256: 64, sha384: 96, sha512: 128, keccak256: 64 };

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

function isBytes32(value) {
  return typeof value === "string" && /^0x[0-9a-f]{64}$/.test(value);
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

  if (passport.schemaVersion !== "0.1") errors.push('schemaVersion must equal "0.1".');
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
  if (passport.provenance !== undefined && !Array.isArray(passport.provenance)) {
    errors.push("provenance must be an array when present.");
  }
  if (passport.lineage !== undefined && !Array.isArray(passport.lineage)) {
    errors.push("lineage must be an array when present.");
  }

  const parties = Array.isArray(passport.parties) ? passport.parties : [];
  const facts = Array.isArray(passport.facts) ? passport.facts : [];
  const evidence = Array.isArray(passport.evidence) ? passport.evidence : [];
  const provenance = Array.isArray(passport.provenance) ? passport.provenance : [];
  const confirmations = Array.isArray(passport.confirmations) ? passport.confirmations : [];
  const lineage = Array.isArray(passport.lineage) ? passport.lineage : [];

  if (lineage.length > 16) errors.push("lineage may contain at most 16 records.");

  const partyIds = parties.map((item) => item?.partyId).filter(Boolean);
  const factIds = facts.map((item) => item?.factId).filter(Boolean);
  const evidenceIds = evidence.map((item) => item?.evidenceId).filter(Boolean);
  const provenanceIds = provenance.map((item) => item?.provenanceId).filter(Boolean);
  const confirmationIds = confirmations.map((item) => item?.confirmationId).filter(Boolean);

  for (const [label, values] of [
    ["partyId", partyIds],
    ["factId", factIds],
    ["evidenceId", evidenceIds],
    ["provenanceId", provenanceIds],
    ["confirmationId", confirmationIds]
  ]) {
    for (const duplicate of duplicateValues(values)) errors.push(`Duplicate ${label}: ${duplicate}`);
  }

  const partySet = new Set(partyIds);
  const evidenceSet = new Set(evidenceIds);
  const factMap = new Map(facts.map((fact) => [fact?.factId, fact]));
  const provenanceMap = new Map(provenance.map((item) => [item?.provenanceId, item]));
  const referencedProvenance = new Set();

  parties.forEach((party, index) => {
    if (!party?.partyId) errors.push(`parties[${index}].partyId is required.`);
    if (!party?.role) errors.push(`parties[${index}].role is required.`);
    if (!party?.displayName) errors.push(`parties[${index}].displayName is required.`);
  });

  evidence.forEach((item, index) => {
    if (!item?.evidenceId) errors.push(`evidence[${index}].evidenceId is required.`);
    if (!item?.type) errors.push(`evidence[${index}].type is required.`);
    if (!item?.title) errors.push(`evidence[${index}].title is required.`);
    if (!DISCLOSURE_PROFILES.has(item?.disclosure)) errors.push(`evidence[${index}].disclosure is invalid.`);

    const algorithm = item?.digest?.algorithm;
    const value = item?.digest?.value;
    if (!algorithm || !(algorithm in DIGEST_LENGTHS)) {
      errors.push(`evidence[${index}].digest.algorithm is unsupported.`);
    } else if (typeof value !== "string" || !/^[a-fA-F0-9]+$/.test(value)) {
      errors.push(`evidence[${index}].digest.value must be hexadecimal.`);
    } else if (value.length !== DIGEST_LENGTHS[algorithm]) {
      errors.push(`evidence[${index}].digest.value must be ${DIGEST_LENGTHS[algorithm]} hex characters for ${algorithm}.`);
    }

    if (item?.issuedBy && !partySet.has(item.issuedBy)) {
      errors.push(`evidence[${index}] references unknown issuedBy party: ${item.issuedBy}`);
    }
  });

  provenance.forEach((item, index) => {
    if (!item?.provenanceId) errors.push(`provenance[${index}].provenanceId is required.`);
    if (!factMap.has(item?.factId)) errors.push(`provenance[${index}] references unknown fact: ${item?.factId}`);
    if (!evidenceSet.has(item?.evidenceId)) errors.push(`provenance[${index}] references unknown evidence: ${item?.evidenceId}`);

    const locator = item?.locator;
    if (!locator || typeof locator !== "object" || Array.isArray(locator)) {
      errors.push(`provenance[${index}].locator must be an object.`);
    } else {
      const populated = PROVENANCE_LOCATORS.filter((key) => locator[key] !== undefined);
      if (populated.length === 0) errors.push(`provenance[${index}].locator must contain at least one locator field.`);
      if (locator.page !== undefined && (!Number.isInteger(locator.page) || locator.page < 1)) {
        errors.push(`provenance[${index}].locator.page must be a positive integer.`);
      }
      for (const key of ["field", "cell", "jsonPointer", "eventId"]) {
        if (locator[key] !== undefined && (typeof locator[key] !== "string" || locator[key].length === 0)) {
          errors.push(`provenance[${index}].locator.${key} must be a non-empty string.`);
        }
      }
    }

    const extraction = item?.extraction;
    if (!extraction || typeof extraction !== "object" || Array.isArray(extraction)) {
      errors.push(`provenance[${index}].extraction must be an object.`);
    } else {
      if (!PROVENANCE_METHODS.has(extraction.method)) errors.push(`provenance[${index}].extraction.method is invalid.`);
      if (
        extraction.confidence !== undefined &&
        (typeof extraction.confidence !== "number" || extraction.confidence < 0 || extraction.confidence > 1)
      ) {
        errors.push(`provenance[${index}].extraction.confidence must be between 0 and 1.`);
      }
      if (extraction.method === "agent_assisted" && !extraction.agentProfile) {
        warnings.push(`Agent-assisted provenance ${item?.provenanceId} has no agentProfile.`);
      }
    }

    if (item?.review !== undefined) {
      if (!item.review || typeof item.review !== "object" || Array.isArray(item.review)) {
        errors.push(`provenance[${index}].review must be an object.`);
      } else {
        if (!partySet.has(item.review.reviewedBy)) errors.push(`provenance[${index}] references unknown reviewer: ${item.review.reviewedBy}`);
        if (!isDateTime(item.review.reviewedAt)) errors.push(`provenance[${index}].review.reviewedAt is invalid.`);
      }
    }
  });

  facts.forEach((fact, index) => {
    if (!fact?.factId) errors.push(`facts[${index}].factId is required.`);
    if (!fact?.type) errors.push(`facts[${index}].type is required.`);
    if (!fact?.statement) errors.push(`facts[${index}].statement is required.`);
    if (!FACT_STATUSES.has(fact?.status)) errors.push(`facts[${index}].status is invalid.`);
    if (!Number.isInteger(fact?.version) || fact.version < 1) errors.push(`facts[${index}].version must be a positive integer.`);
    if (!partySet.has(fact?.assertedBy)) errors.push(`facts[${index}] references unknown assertedBy party: ${fact?.assertedBy}`);
    if (!isDateTime(fact?.assertedAt)) errors.push(`facts[${index}].assertedAt is invalid.`);

    if (!Array.isArray(fact?.evidenceRefs)) {
      errors.push(`facts[${index}].evidenceRefs must be an array.`);
    } else {
      for (const evidenceRef of fact.evidenceRefs) {
        if (!evidenceSet.has(evidenceRef)) errors.push(`facts[${index}] references unknown evidence: ${evidenceRef}`);
      }
      if (fact.status === "confirmed" && fact.evidenceRefs.length === 0) {
        errors.push(`facts[${index}] is confirmed but has no evidence reference.`);
      }
    }

    if (fact?.provenanceRefs !== undefined) {
      if (!Array.isArray(fact.provenanceRefs)) {
        errors.push(`facts[${index}].provenanceRefs must be an array when present.`);
      } else {
        for (const provenanceRef of fact.provenanceRefs) {
          const source = provenanceMap.get(provenanceRef);
          if (!source) {
            errors.push(`facts[${index}] references unknown provenance: ${provenanceRef}`);
            continue;
          }
          referencedProvenance.add(provenanceRef);
          if (source.factId !== fact.factId) errors.push(`facts[${index}] references provenance for another fact: ${provenanceRef}`);
          if (Array.isArray(fact.evidenceRefs) && !fact.evidenceRefs.includes(source.evidenceId)) {
            errors.push(`facts[${index}] provenance ${provenanceRef} uses evidence not cited by the fact.`);
          }
        }
      }
    }

    if (fact?.supersedesFactId) {
      if (fact.supersedesFactId === fact.factId) errors.push(`facts[${index}] cannot supersede itself.`);
      else if (!factMap.has(fact.supersedesFactId)) errors.push(`facts[${index}] supersedes unknown fact: ${fact.supersedesFactId}`);
    }
  });

  for (const item of provenance) {
    if (item?.provenanceId && !referencedProvenance.has(item.provenanceId)) {
      warnings.push(`Provenance record is not referenced by its fact: ${item.provenanceId}`);
    }
  }

  confirmations.forEach((confirmation, index) => {
    if (!confirmation?.confirmationId) errors.push(`confirmations[${index}].confirmationId is required.`);
    const fact = factMap.get(confirmation?.factId);
    if (!fact) {
      errors.push(`confirmations[${index}] references unknown fact: ${confirmation?.factId}`);
    } else if (confirmation.factVersion !== fact.version) {
      errors.push(`confirmations[${index}] addresses fact version ${confirmation.factVersion}, but ${confirmation.factId} is version ${fact.version}.`);
    }
    if (!partySet.has(confirmation?.partyId)) errors.push(`confirmations[${index}] references unknown party: ${confirmation?.partyId}`);
    if (!DECISIONS.has(confirmation?.decision)) errors.push(`confirmations[${index}].decision is invalid.`);
    if (!isDateTime(confirmation?.decidedAt)) errors.push(`confirmations[${index}].decidedAt is invalid.`);
  });

  const lineageKeys = [];
  lineage.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`lineage[${index}] must be an object.`);
      return;
    }
    if (!LINEAGE_RELATIONS.has(item.relation)) errors.push(`lineage[${index}].relation is invalid.`);
    if (!LINEAGE_SOURCE_TYPES.has(item.sourceArtifactType)) errors.push(`lineage[${index}].sourceArtifactType is invalid.`);
    if (!isBytes32(item.sourceDigest)) errors.push(`lineage[${index}].sourceDigest must be lowercase bytes32 hex.`);
    if (item.sourceCardDigest !== undefined && !isBytes32(item.sourceCardDigest)) {
      errors.push(`lineage[${index}].sourceCardDigest must be lowercase bytes32 hex.`);
    }
    if (item.sourceRequestDigest !== undefined && !isBytes32(item.sourceRequestDigest)) {
      errors.push(`lineage[${index}].sourceRequestDigest must be lowercase bytes32 hex.`);
    }
    if (item.sourceArtifactType === "RealWorldProofCard" && !isBytes32(item.sourceCardDigest)) {
      errors.push(`lineage[${index}] from RealWorldProofCard requires sourceCardDigest.`);
    }
    if (!isDateTime(item.recordedAt)) errors.push(`lineage[${index}].recordedAt is invalid.`);
    lineageKeys.push([
      item.relation,
      item.sourceArtifactType,
      item.sourceDigest,
      item.sourceCardDigest ?? "",
      item.sourceRequestDigest ?? ""
    ].join("|"));
  });
  for (const duplicate of duplicateValues(lineageKeys)) errors.push(`Duplicate lineage record: ${duplicate}`);

  if (!PASSPORT_STATUSES.has(passport.lifecycle?.status)) errors.push("lifecycle.status is invalid.");
  if (!DISCLOSURE_PROFILES.has(passport.disclosure?.profile)) errors.push("disclosure.profile is invalid.");

  if (passport.lifecycle?.status === "revoked") {
    if (!passport.lifecycle.revokedAt) warnings.push("Revoked passport has no revokedAt timestamp.");
    if (!passport.lifecycle.revocationReason) warnings.push("Revoked passport has no revocationReason.");
  }

  if (facts.length === 0) warnings.push("Passport contains no facts.");
  if (confirmations.length === 0) warnings.push("Passport contains no confirmations.");
  if (provenance.length === 0) warnings.push("Passport contains no field-level RWP provenance.");

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
  console.log(`Provenance records: ${Array.isArray(passport.provenance) ? passport.provenance.length : 0}`);
  console.log(`Confirmations: ${passport.confirmations.length}`);
  console.log(`Lineage records: ${Array.isArray(passport.lineage) ? passport.lineage.length : 0}`);
}

await main();
