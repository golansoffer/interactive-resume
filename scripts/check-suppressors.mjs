#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const scriptDir = import.meta.dirname;
const ROOT = join(scriptDir, '..');

const SCAN_ROOTS = ['src', 'scripts'];
const IGNORE_FILES = new Set(['routeTree.gen.ts', 'check-suppressors.mjs']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.tsbuild']);

const PATTERNS = [
  { name: '@ts-ignore', regex: /@ts-ignore\b/u },
  { name: '@ts-expect-error', regex: /@ts-expect-error\b/u },
  { name: '@ts-nocheck', regex: /@ts-nocheck\b/u },
  { name: 'eslint-disable', regex: /eslint-disable\b/u },
  { name: 'oxlint-disable', regex: /oxlint-disable\b/u },
  { name: 'as any', regex: /\bas\s+any\b/u },
  { name: 'as unknown as', regex: /\bas\s+unknown\s+as\b/u },
  { name: 'as NonNullable<', regex: /\bas\s+NonNullable\s*</u },
  { name: 'postfix non-null assertion (!)', regex: /\w!\s*[.?[(]/u },
  { name: 'definite-assignment field (!:)', regex: /^\s*(?:public|private|protected|readonly|static|\s)*[a-zA-Z_$][\w$]*!\s*:/mu },
];

const SOURCE_EXTENSION = /\.(?:ts|tsx|mts|cts|mjs|cjs|js|jsx)$/u;

function walk(dir, hits) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (IGNORE_DIRS.has(entry)) continue;
      walk(full, hits);
      continue;
    }
    if (IGNORE_FILES.has(entry)) continue;
    if (!SOURCE_EXTENSION.test(entry)) continue;
    const content = readFileSync(full, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const { name, regex } of PATTERNS) {
        if (regex.test(line)) {
          hits.push({ file: relative(ROOT, full), line: i + 1, pattern: name, text: line.trim() });
        }
      }
    }
  }
}

const hits = [];
for (const root of SCAN_ROOTS) {
  const full = join(ROOT, root);
  try {
    walk(full, hits);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

if (hits.length > 0) {
  console.error(`Suppressor scan failed: ${hits.length} forbidden pattern(s) found.\n`);
  for (const hit of hits) {
    console.error(`  ${hit.file}:${hit.line}  [${hit.pattern}]  ${hit.text}`);
  }
  console.error('\nFix the producer-side type instead of suppressing the consumer-side check.');
  process.exit(1);
}

console.log('Suppressor scan clean.');
