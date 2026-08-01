#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { compileSeasonAllocation } from '../docs/season-allocation.mjs';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath) {
  console.error('Usage: node tools/compile-season-allocation.mjs <input.json> [output.json]');
  process.exit(2);
}

try {
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  const output = compileSeasonAllocation(input);
  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (outputPath) writeFileSync(outputPath, serialized, 'utf8');
  else process.stdout.write(serialized);
} catch (error) {
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
