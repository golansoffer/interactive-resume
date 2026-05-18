# Interactive Resume — Repo Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `/Users/golan/Documents/repos/interactive-resume/` — a React 19 + XState v5 + TanStack Router (file-based) + Vite app with the strictest TypeScript configuration possible (build-failing errors at three layers: `tsc`, `oxlint`, suppressor scan). No 3D libraries, no styling system, no domain code in this phase.

**Architecture:** Single-package pnpm project. Hexagonal layering applied via folders (`src/core/` pure, `src/features/` vertical slices, `src/routes/` URL adapter, `src/components/` shared UI primitives, `src/lib/` framework adapters). TanStack Router generates `routeTree.gen.ts` at build time. CLAUDE.md and 10 client-relevant agents copied (adapted) from `/Users/golan/Documents/repos/project-04/real-time-players-app/`.

**Tech Stack:** pnpm, Vite, React 19, TypeScript (strictest), `@tanstack/react-router` + `@tanstack/router-plugin`, `xstate` v5 + `@xstate/react`, `zod`, Vitest + jsdom + `@testing-library/react`, `oxlint`.

**Spec:** `docs/superpowers/specs/2026-05-19-interactive-resume-setup-design.md`

**Project root:** `/Users/golan/Documents/repos/interactive-resume/` — referred to below as `$ROOT`. All file paths are absolute or relative to `$ROOT`.

---

## Task 1: Initialize pnpm project skeleton

**Files:**
- Create: `$ROOT/package.json`
- Create: `$ROOT/.npmrc`

- [ ] **Step 1: Verify project root exists and is empty except for `docs/`**

Run:
```bash
ls -A /Users/golan/Documents/repos/interactive-resume/
```
Expected output: `docs` (only). The `docs/` folder already contains the spec from brainstorming.

- [ ] **Step 2: Create `package.json`**

Write file `/Users/golan/Documents/repos/interactive-resume/package.json`:

```json
{
  "name": "interactive-resume",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "3D interactive resume — explore the companies I've worked at as scenes.",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "lint": "oxlint",
    "lint:suppressors": "node scripts/check-suppressors.mjs",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "pnpm typecheck && pnpm lint && pnpm lint:suppressors && pnpm test"
  }
}
```

- [ ] **Step 3: Create `.npmrc` to pin engine-strictness and avoid hoisting surprises**

Write file `/Users/golan/Documents/repos/interactive-resume/.npmrc`:

```
engine-strict=true
strict-peer-dependencies=true
```

- [ ] **Step 4: Verify pnpm sees the project**

Run from `$ROOT`:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm --version
```
Expected: a pnpm version number (≥9).

- [ ] **Step 5: Commit (we will `git init` later — this step is a no-op for now)**

No git yet. Move on to Task 2.

---

## Task 2: Install runtime dependencies

**Files:**
- Modify: `$ROOT/package.json` (pnpm writes `dependencies`)
- Create: `$ROOT/pnpm-lock.yaml`
- Create: `$ROOT/node_modules/` (gitignored)

Install all runtime deps at their latest stable. No version pinning — `pnpm add` resolves to latest.

- [ ] **Step 1: Install React and React DOM**

Run from `$ROOT`:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm add react react-dom
```
Expected: pnpm reports two packages installed, writes lockfile.

- [ ] **Step 2: Install TanStack Router**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm add @tanstack/react-router
```
Expected: pnpm installs the runtime router package.

- [ ] **Step 3: Install XState and the React binding**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm add xstate @xstate/react
```
Expected: pnpm installs both packages.

- [ ] **Step 4: Install Zod (boundary parsers)**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm add zod
```
Expected: pnpm installs zod.

- [ ] **Step 5: Verify dependencies block in `package.json`**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && cat package.json
```
Expected: `dependencies` contains `react`, `react-dom`, `@tanstack/react-router`, `xstate`, `@xstate/react`, `zod` — each pinned to a `^<major>.<minor>.<patch>` resolved by pnpm.

---

## Task 3: Install dev dependencies

**Files:**
- Modify: `$ROOT/package.json` (pnpm writes `devDependencies`)
- Modify: `$ROOT/pnpm-lock.yaml`

- [ ] **Step 1: Install Vite + React plugin + router plugin**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm add -D vite @vitejs/plugin-react @tanstack/router-plugin @tanstack/router-devtools
```
Expected: pnpm installs four dev packages.

- [ ] **Step 2: Install TypeScript and React types**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm add -D typescript @types/react @types/react-dom @types/node
```
Expected: pnpm installs four dev packages.

- [ ] **Step 3: Install Vitest, jsdom, Testing Library**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm add -D vitest jsdom @testing-library/react @testing-library/dom
```
Expected: pnpm installs four dev packages.

- [ ] **Step 4: Install oxlint**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm add -D oxlint
```
Expected: pnpm installs oxlint.

- [ ] **Step 5: Verify all dev deps present**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && cat package.json
```
Expected: `devDependencies` contains: `vite`, `@vitejs/plugin-react`, `@tanstack/router-plugin`, `@tanstack/router-devtools`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `oxlint`.

---

## Task 4: TypeScript configuration

**Files:**
- Create: `$ROOT/tsconfig.base.json`
- Create: `$ROOT/tsconfig.json`
- Create: `$ROOT/tsconfig.node.json`

- [ ] **Step 1: Create `tsconfig.base.json`**

Write file `/Users/golan/Documents/repos/interactive-resume/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  },
  "exclude": ["node_modules", "dist", "build"]
}
```

- [ ] **Step 2: Create `tsconfig.json` (app config)**

Write file `/Users/golan/Documents/repos/interactive-resume/tsconfig.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `tsconfig.node.json` (Vite config compilation)**

Write file `/Users/golan/Documents/repos/interactive-resume/tsconfig.node.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Verify TS can read the configs (will error because no source files exist yet)**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm exec tsc --showConfig -p tsconfig.json | head -20
```
Expected: prints a resolved config JSON without parse errors. (It will not type-check anything yet.)

---

## Task 5: Vite + router plugin configuration

**Files:**
- Create: `$ROOT/vite.config.ts`
- Create: `$ROOT/index.html`

- [ ] **Step 1: Create `vite.config.ts`**

Write file `/Users/golan/Documents/repos/interactive-resume/vite.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

Note: `defineConfig` is imported from `vitest/config` (not `vite`) so the `test` block is typed without a separate `vitest.config.ts`. Router plugin runs **before** the React plugin per TanStack docs.

- [ ] **Step 2: Create `index.html`**

Write file `/Users/golan/Documents/repos/interactive-resume/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Interactive Resume</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Task 6: App entry and placeholder routes

**Files:**
- Create: `$ROOT/src/main.tsx`
- Create: `$ROOT/src/routes/__root.tsx`
- Create: `$ROOT/src/routes/index.tsx`
- Create: `$ROOT/src/vite-env.d.ts`

- [ ] **Step 1: Create `src/vite-env.d.ts` (triple-slash ref so Vite/client types load)**

Write file `/Users/golan/Documents/repos/interactive-resume/src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 2: Create the root route layout**

Write file `/Users/golan/Documents/repos/interactive-resume/src/routes/__root.tsx`:

```typescript
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout(): JSX.Element {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools /> : null}
    </>
  );
}
```

- [ ] **Step 3: Create the index route (placeholder landing page)**

Write file `/Users/golan/Documents/repos/interactive-resume/src/routes/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

function IndexPage(): JSX.Element {
  return <main>interactive resume — scaffolding</main>;
}
```

- [ ] **Step 4: Create `src/main.tsx`**

Write file `/Users/golan/Documents/repos/interactive-resume/src/main.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
```

Note on the null check: this is a parse-at-boundary site (DOM → app). Per Iron Law 3, validation lives at boundaries. The `throw` is the parse failure mode; downstream code receives a non-null `HTMLElement`.

- [ ] **Step 5: Trigger one Vite run so the router plugin generates `routeTree.gen.ts`**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm exec vite build 2>&1 | tail -20
```
Expected: build may print warnings about generated route tree being new; eventually exits 0 and produces `src/routeTree.gen.ts` plus `dist/`. If `dist/` exists, the route tree was generated.

Verify:
```bash
ls /Users/golan/Documents/repos/interactive-resume/src/routeTree.gen.ts
```
Expected: file exists.

---

## Task 7: Empty domain folders with `.gitkeep`

**Files:**
- Create: `$ROOT/src/core/.gitkeep`
- Create: `$ROOT/src/features/.gitkeep`
- Create: `$ROOT/src/components/.gitkeep`
- Create: `$ROOT/src/lib/.gitkeep`
- Create: `$ROOT/public/.gitkeep`

- [ ] **Step 1: Create empty folder placeholders**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && mkdir -p src/core src/features src/components src/lib public && touch src/core/.gitkeep src/features/.gitkeep src/components/.gitkeep src/lib/.gitkeep public/.gitkeep
```
Expected: five empty `.gitkeep` files created.

- [ ] **Step 2: Verify**

Run:
```bash
ls /Users/golan/Documents/repos/interactive-resume/src/
```
Expected output (alphabetical):
```
__tests__   (will be added in Task 8)
components
core
features
lib
main.tsx
routeTree.gen.ts
routes
vite-env.d.ts
```
(At this point `__tests__` does not yet exist — only the others.)

---

## Task 8: Vitest smoke test

**Files:**
- Create: `$ROOT/src/__tests__/smoke.test.ts`

- [ ] **Step 1: Write the smoke test**

Write file `/Users/golan/Documents/repos/interactive-resume/src/__tests__/smoke.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('boots the test runner', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm test
```
Expected: vitest runs, prints `✓ src/__tests__/smoke.test.ts (1 test)` and exits 0.

---

## Task 9: oxlint configuration

**Files:**
- Create: `$ROOT/.oxlintrc.json`

- [ ] **Step 1: Write the oxlint config**

Write file `/Users/golan/Documents/repos/interactive-resume/.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "ignorePatterns": [
    "src/routeTree.gen.ts",
    "**/dist/**",
    "**/build/**",
    "**/node_modules/**"
  ],
  "plugins": ["typescript", "react", "import", "unicorn", "oxc"],
  "categories": {
    "correctness": "error",
    "suspicious": "error",
    "pedantic": "error"
  },
  "rules": {
    "typescript/ban-ts-comment": "error",
    "typescript/consistent-type-imports": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/no-non-null-asserted-nullish-coalescing": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "no-console": "warn",
    "react/react-in-jsx-scope": "off"
  },
  "overrides": [
    {
      "files": ["**/services/**/*.ts", "**/services/**/*.tsx", "scripts/**/*.mjs"],
      "rules": { "no-console": "off" }
    }
  ],
  "settings": { "react": { "version": "detect" } },
  "env": { "browser": true, "es2024": true }
}
```

- [ ] **Step 2: Run oxlint**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm lint
```
Expected: oxlint finishes with zero errors and zero warnings (the codebase is tiny and clean). Exit code 0.

If oxlint reports unknown-rule errors (rule names that have moved in the installed version), record the failure and stop. Resolve by consulting the oxlint version installed in `node_modules/oxlint/configuration_schema.json` and adjusting rule names — do not silently drop rules. After fixing, re-run.

---

## Task 10: Suppressor scan script

**Files:**
- Create: `$ROOT/scripts/check-suppressors.mjs`

- [ ] **Step 1: Write the suppressor scan script**

Write file `/Users/golan/Documents/repos/interactive-resume/scripts/check-suppressors.mjs`:

```javascript
#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const SCAN_ROOTS = ['src', 'scripts'];
const IGNORE_FILES = new Set(['routeTree.gen.ts']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git']);

const PATTERNS = [
  { name: '@ts-ignore', regex: /@ts-ignore\b/ },
  { name: '@ts-expect-error', regex: /@ts-expect-error\b/ },
  { name: '@ts-nocheck', regex: /@ts-nocheck\b/ },
  { name: 'eslint-disable', regex: /eslint-disable\b/ },
  { name: 'oxlint-disable', regex: /oxlint-disable\b/ },
  { name: 'as any', regex: /\bas\s+any\b/ },
  { name: 'as unknown as', regex: /\bas\s+unknown\s+as\b/ },
  { name: 'as NonNullable<', regex: /\bas\s+NonNullable\s*</ },
  { name: 'postfix non-null assertion (!)', regex: /\w!\s*[.?[(]/ },
  { name: 'definite-assignment field (!:)', regex: /^\s*(?:public|private|protected|readonly|static|\s)*[a-zA-Z_$][\w$]*!\s*:/m },
];

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
    if (!/\.(?:ts|tsx|mts|cts|mjs|cjs|js|jsx)$/.test(entry)) continue;
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
```

- [ ] **Step 2: Run the suppressor scan**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm lint:suppressors
```
Expected output:
```
Suppressor scan clean.
```
Exit code 0.

- [ ] **Step 3: Negative test — verify the script actually catches a violation**

Temporarily add a suppressor at the bottom of `src/__tests__/smoke.test.ts`:

```typescript
// @ts-ignore — temporary test of suppressor scanner
const _unused = null;
```

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm lint:suppressors
```
Expected: exits 1, prints `Suppressor scan failed: 1 forbidden pattern(s) found.` and lists the file/line.

- [ ] **Step 4: Revert the smoke test back to its clean form**

Restore `/Users/golan/Documents/repos/interactive-resume/src/__tests__/smoke.test.ts` to:

```typescript
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('boots the test runner', () => {
    expect(true).toBe(true);
  });
});
```

Re-run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm lint:suppressors
```
Expected: `Suppressor scan clean.` exit 0.

---

## Task 11: Run typecheck end-to-end

**Files:** none modified

- [ ] **Step 1: Run `pnpm typecheck`**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm typecheck
```
Expected: TS reports zero errors. Exit code 0.

If `tsc` complains that `JSX.Element` is not found (because React 19's types changed the global JSX namespace), update the affected route component return types from `JSX.Element` to `React.JSX.Element` and import `React`:

```typescript
import type { JSX } from 'react';
```

…then use `JSX.Element` from that import in `__root.tsx` and `routes/index.tsx`. Re-run typecheck to confirm.

---

## Task 12: Adapt CLAUDE.md from the source repo

**Files:**
- Create: `$ROOT/CLAUDE.md`

**Source:** `/Users/golan/Documents/repos/project-04/real-time-players-app/CLAUDE.md`

- [ ] **Step 1: Read the source file**

Run:
```bash
cat /Users/golan/Documents/repos/project-04/real-time-players-app/CLAUDE.md
```
Confirm you have the full file in context.

- [ ] **Step 2: Write `$ROOT/CLAUDE.md`**

Write file `/Users/golan/Documents/repos/interactive-resume/CLAUDE.md` — the following is the **complete, adapted text** (not a diff). Copy it verbatim into the new file:

```markdown
# Project Rules

The Four Iron Laws are absolute. They are the physics of this codebase. Every line obeys them. No exceptions. Code that breaks a law is wrong and gets rewritten, not patched.

> **Note:** Architecture docs (`docs/architecture.md`, `docs/primitives.md`) will be added in a follow-up session. Until then, the Iron Laws and Supporting Rules below are the source of truth. Keep them loaded for every change.

---

## The Four Iron Laws

These are the foundation. Everything else in this file follows from them. No exceptions, at any scale.

### 1. Hexagonal Architecture (Ports & Adapters)

The foundational philosophy of the entire project. Three layers:

- **Core (Hexagon):** Pure domain logic, types, state machines, parsers. Zero external dependencies — no React, no router, no DOM. Could run anywhere.
- **Ports:** TypeScript types/interfaces defining contracts. Inbound ports (events, commands) and outbound ports (callbacks, props types). Defined alongside core.
- **Adapters:** Thin translation layers connecting external systems to ports. No business logic. Route files (URL adapter), widgets (wiring adapter), React components (UI adapter), data-fetching hooks (data adapter), DOM/animation/3D wrappers (services adapters).

**The Dependency Rule:** `Adapters -> Ports -> Core`. Never reversed. No adapter imports another adapter. **No information leaks across layers** — layers cross only through declared ports; reaching across is the violation even if it compiles. (Operational form: *No information leaks between responsibilities* in Supporting Rules.)

**Recursive application.** This rule fractals downward. *Inside* any adapter, sub-layers obey the same dependency rule between themselves: each sub-layer is an inner hexagon with its own ports, and reaching across is forbidden at every scale. The no-leak rule applies at every scale.

**Litmus test:** Could you swap React for Solid, TanStack Router for another router, the 3D library for another — and keep core + ports untouched? If no, something leaked.

### 2. Discriminated Unions Everywhere

Every domain type is a discriminated union tagged by `kind`. Each variant is a **flat, simple object** — `kind` plus only the fields that variant needs. No nested complex objects. If a field would be complex, model it as its own union.

```typescript
// YES
type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly data: ReadonlyArray<Item> }
  | { readonly kind: 'failed'; readonly error: string };

// NO — optional soup, illegal states possible
type State = { loading?: boolean; error?: string; data?: Item[] };
```

### 3. Make Illegal States Unrepresentable

**If a function runs, its preconditions are already guaranteed by the type. Core assumes correctness. Validation lives at boundaries — never internally.**

Every type forbids invalid combinations at compile time. Every flow is finite. Fields that exist in only one state live on that variant only — never as optionals on a shared type.

**This is:** Tell, don't ask. Structural correctness. Validity by construction. Correct-by-design. Parse, don't validate. Fail fast at boundaries, not internally.

**Applies to ports too.** The same logic governs cross-layer flows: ports carry **only** parsed domain types (Iron Law 2 — discriminated unions). A layer cannot accidentally hand the wrong shape to its neighbor because the port type forbids it. "Illegal cross-layer states" — a route holding a store, a component holding api, a reducer holding React — are unrepresentable by construction when the port shape is right.

**No type-system suppressors anywhere.** Every mechanism that bypasses the type checker, lint, or structural narrow is banned at the lint layer (oxlint `error` severity and the `pnpm lint:suppressors` full-scan gate, both build-failing):

- Postfix `!` (`x.foo!`, `arr[i]!`, `result!.bar`) — split the producer into a discriminated union variant; the consumer narrows.
- `field!:` definite-assignment declarations — model the field as a discriminated union with an `unset` variant; never trust definite assignment.
- `as NonNullable<T>`, `as T` casts on lookup results, double `as unknown as T` — re-shape the producer so the consumer reads `T` directly. Casts at parse boundaries (post-zod, post-`parseX`) are the only legitimate use.
- `||` / `??` on lookup-shaped expressions (`map.get(k) ?? default`, `arr.find(p) ?? default`, `arr.at(i) ?? default`, `obj?.field ?? default`) — re-shape the producer to a **TotalMap-style proof-bearing lookup** (a data structure whose type guarantees every queried key has a value, so the lookup returns `T`, not `T | undefined` — the type itself is the proof that the lookup succeeds), or fold the absence into a discriminated union variant. Defaults at parse boundaries for genuinely-optional input fields are the only legitimate use.
- Truthy-check narrows on lookup results (`if (map.get(k)) { … }`, `if (arr.find(p)) { … }`) — same as above; producer re-shape, not consumer guard.
- `=== undefined` / `=== null` / `typeof !== 'undefined'` narrows on lookup-shaped expressions — same as above.
- `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` — never. Type errors are a signal the type is wrong; fix the type.
- `eslint-disable`, `oxlint-disable` comments (line, block, file scope, any rule) — never. Lint rules either fit the codebase or they don't. If a rule fires legitimately on a path the architecture permits (e.g. `console.*` in `services/` adapters), use a config-layer override scoped by glob — not an inline disable.
- `any` and `unknown`-cast-to-concrete-type when hiding nullability — if the type is genuinely unknown at the boundary, use a parser; if it's known but mistyped, fix the type.

Suppressor-bypass attempts at the producer-side are no exception. The fix is upstream: re-shape the type, split the variant, fold the absence into the discriminator. The runtime contract is enforced by structure, not by check.

**Banned in core:**
- Defensive null/undefined checks on already-typed values
- `"should never happen"` branches, unreachable asserts, impossible-case fallbacks
- Boolean flags controlling flow — model as a union variant
- Optional fields used as implicit state conditionals
- Runtime asserts compensating for weak types

Reaching for a runtime check inside core means the type is wrong. Split into variants.

### 4. Design Discipline — Solve More With Less

**Write code that matches the shape of the problem.** This rule is **anti-defensive, not anti-line-count.** A junior dev writes a long algorithm with manual `if`s for every edge case; a pro writes precise code that handles all of it through a better mental model. The pro's version is sometimes shorter — and sometimes longer — but always *precise* rather than *defensive*. Short code is evidence of understanding, never the goal.

**More code is fine — even preferred — when it:**
- Adds a discriminated-union variant that makes an illegal state unrepresentable.
- Splits one branchy function into per-case handlers with cleaner execution paths.
- Expands a type to forbid invalid combinations at compile time.

**Less code is the goal only for defensive cruft:**
- Null-guards on already-typed values.
- "Should never happen" / unreachable branches.
- Special-case `if`/`switch` ladders that exist because the type is wrong.
- Wrappers, indirections, and flexibility knobs added "just in case."
- Optional fields used as implicit state flags.

**Other principles:**
- Each layer exposes the **minimum**; invalid states should be unrepresentable, not guarded against.
- **No abstraction, indirection, or flexibility** exists until it has already earned its place by removing more complexity than it adds.
- **Clarity outranks brevity.** Compression that hurts readability is the opposite of this principle. Never chase line count for its own sake.

**Bad code is a symptom — the fix is at the root.** The visible mess (an awkward branch, a cast, a helper, a duplicate block) is never the bug. The bug is upstream: a wrong type, a missing variant, a leaked layer, a broken abstraction. This applies to **everything written in this repo** — code you touch, plans you draft, solutions you propose. If a plan needs a workaround, the frame is wrong; remodel before writing. If a solution feels forced, the shape is wrong; stop and rethink. Patching the symptom is forbidden at every scale.

Symptoms that the model is wrong:
- A growing ladder of `if`/`switch` branches for "special cases"
- Utility helpers whose only job is to paper over a shape mismatch
- Wrapper layers, adapters-of-adapters, or pass-through indirections added "for flexibility"
- Configuration knobs and optional flags accumulating on a single function
- Copy-pasted blocks that *almost* match but diverge in one detail driven by a missing type variant
- Defensive `any` / `!` / nullable checks silencing the type checker instead of fixing the type
- **A layer reaching into another layer's internals.** Missing-port symptom — fix the port, not the call site. (See *No information leaks* below.)
- **Functions with long parameter lists** (≤5 is the soft target; 6+ triggers scrutiny — see *Deep modules, not shallow ones* below). Shallow-module symptom — deepen the module instead of bundling params into options objects.

The fix is always upstream: re-model the types, split or merge variants, move the responsibility to the layer it belongs in. A better frame deletes *defensive* code; it does not necessarily delete total code.

**Forbidden phrases** — each is a confession the root was not fixed: *"quick fix"*, *"for now"*, *"good enough"*, *"we can clean up later"*, *"clean up later"*, *"as a first step"*, *"first step"*, *"minimal version"*, *"stub for X"*, *"stub"*, *"workaround"*, *"temporary"*, *"will refactor later"*, *"refactor later"*, `// TODO` / `// HACK` / `// FIXME` left behind. If you catch any of these in your own draft (code, plan, brainstorm option, PR description), STOP — the proposal is not an option; either deliver the complete root-level fix or split into properly-scoped complete waves. Debt accumulates like cancer; one patch breeds the next. **Zero accumulation. No exceptions.**

---

## Supporting Rules

These follow from the four laws above.

**Parse, don't validate.** At every system boundary (API, forms, DB, URL, DOM), parse raw input into a domain type once. Downstream code receives the parsed type and never re-checks. Parsing happens at the adapter boundary. The parsed type is what flows across ports.

**Functional programming.** Pure functions by default. Immutable data. No mutation. Side effects live in adapters only. Core is pure.

**Early returns.** Guard clauses first. No deep nesting. No `else` after `return`. Happy path at lowest indentation.

**No useEffect.** Banned except in wiring adapters (composition roots — `widget/<surface>/use<Surface>.ts`) for syncing with external systems (browser APIs, animation loops, third-party libraries). Derived state -> `useMemo`. Event responses -> event handlers. The composition root is the only layer permitted to bridge externalities to ports.

**Naming:** `camelCase` properties/variables/functions. `PascalCase` types/interfaces. `snake_case` strings for `kind` values.

**Comments.** Default to none. Code is the source of truth; identifiers carry intent; types carry shape. Add a comment only when the *why* is non-obvious (a hidden constraint, a subtle invariant, a workaround). Never explain *what*. Never reference callers, related files, or "this exists because of X" — that rationale belongs in the PR/commit, not the source.

**No information leaks between responsibilities — universal.** This rule is the operational expression of **Iron Law 1 applied recursively** at every scale: not just between hexagons (core / adapters), but between sub-layers within each hexagon. A feature is a vertical slice with strict layer boundaries. Each layer owns **one concern** and is unaware of every other layer's internals; layers cross only through declared ports (props, events, hook return values, function parameters, return values, parsed types). **This applies wherever a "layer" exists.** If a layer needs something from another, the answer is a port, not an import. Reaching across is the violation — even if it compiles.

How this completes the other Iron Laws:
- **Iron Law 1 (Hexagonal):** the dependency rule fractals down — sub-layers within each adapter form inner hexagons under the same rule.
- **Iron Law 2 (Discriminated Unions):** every port carries discriminated unions; that's the *what* that crosses.
- **Iron Law 3 (Illegal States Unrepresentable):** wrong-layer flows become unrepresentable when port shapes are right; the type system enforces the boundary.
- **Iron Law 4 (Design Discipline):** when tempted to reach across, the fix is upstream — re-shape the port, don't patch the call site.

**Deep modules, not shallow ones — long parameter lists are a symptom.** A long parameter list means the module is **shallow** (wide interface; callers pay cognitive load while the module hides nothing). Fix is to **deepen the module** (absorb complexity behind a smaller interface — module hides more, caller knows less), never to bundle params. **Banned cosmetic patches** — each is a re-shaping of the call site that leaves the module unchanged:

- **Extract Parameter Object** — lifting positional params into a single named config struct (`fn(cfg: Cfg)` where `Cfg = { a, b, c, … }`).
- **Options bag** — single object-literal param bundling many fields (`fn({ a, b, c, … })`).
- **Named args** — wrapping positional params in an object purely for label-at-call-site, no behavioral change.
- **Builder pattern** — fluent chained-method API (`x.withA(a).withB(b).build()`).
- **Classitis** — splitting one coherent operation across multiple classes/modules that ping-pong intermediate state.

The real fix is upstream: a missing discriminated-union variant absorbs toggle/mode params (Iron Law 2); the op is recomposed so data never crosses; the params were wrong-layer (Iron Law 1). **Litmus:** if a wrapper cleans the call site without changing the module, the smell is unchanged. **Soft anchor:** ≤5 params is the target; 6+ triggers scrutiny, not rejection — ships only when every param is a distinct non-bundleable domain entity at the right layer and no upstream reshape (split variant, deepen module, move responsibility) shrinks the count. Bundling is never the fix.

**Client-side feature shape.** Each feature is a vertical slice under `src/features/<feature>/`:

```
features/<feature>/
├── types/       — domain types (state shapes, value types). Pure.
├── schema/      — zod parsers at the API boundary.
├── api/         — data adapter (fetch, GraphQL, etc.). The only data-source caller.
├── services/    — non-domain externalities (DOM, timers, third-party libraries). Pure callbacks; no React.
├── components/  — pure UI. Props in, events out. No hooks for data, FSM, or URL.
└── widget/<surface>/
    ├── use<Surface>.ts      — wires api + reducer → { state, actions }.
    └── <Surface>Widget.tsx  — thin shell: hands { state, actions } to the component.
```

Layer responsibilities:
- **routes** know urls, params, navigation. Unaware of api, db, server, stores, FSMs, pixels.
- **widgets (use\<X\>.ts)** wire api + reducer into `{ state, actions }`. Unaware of url, pixels, css.
- **components** render pixels and emit events. Unaware of api, db, url, stores, FSM internals.
- **api** calls http. Unaware of url, react, components, FSM.
- **services** wrap externalities (DOM, timers, third-party libraries). Unaware of react, domain, FSM.
- **types/schema** are data and parsers only. Aware of nothing else.

A component never sees the api; the api never sees the url; the reducer never sees React; the route never sees a store.

**Core feature shape.** Core is the pure hexagon (`src/core/`): domain types, reducers, projections, parsers, decision functions. Inside core, the same rule still applies between sub-layers:

- **types** — data shapes only. No logic.
- **domain reducers** — pure `(state, event) → state`. Unaware of event-sourcing plumbing, persistence, transport, time, randomness.
- **policies / decision functions** — pure `(state, command) → events | rejection`. Same constraints.
- **parsers** — boundary parsing only. Aware of nothing else.

Core imports nothing from React, the router, or any framework. A reducer never imports a projection; a projection never imports a reducer.

**Universal cross-layer rule.** A reducer never sees React. A parser never sees the network. A handler never sees the domain logic it routes to (it dispatches a command). A component never sees the api. **Even if it compiles, reaching across is the violation.**

---

## Agent Orchestration

When a task produces or modifies code, spawn agents — you orchestrate, you don't write code yourself. For questions/explanations, respond directly.

### Agent Roster

| Agent | Domain |
|---|---|
| `prompt-optimizer` | *(optional)* Refines vague/ambiguous prompts before other agents run |
| `bdd-tdd-spec-writer` | BDD scenarios + TDD test bullets before implementation |
| `core-architecture-guardian` | Ensures domain logic lives in core, not in adapters. Runs in plan or code mode. |
| `state-machine-agent` | Designs state as discriminated unions with pure transitions |
| `data-adapter-builder` | Builds `api/`, `schema/`, `services/` — data adapters, zod parsers, externality wrappers |
| `ui-component-builder` | Controlled, event-based React components with discriminated union props |
| `styles-motion` | Styling, design tokens, animations, motion |
| `feature-wiring` | Wires data → state machine → UI props → event routing |
| `route-url-adapter` | Builds route files, URL schemas (`validateSearch`), navigation handlers. Enforces URL-first state hierarchy. |
| `rules-guardian` | Final audit against these rules. Always runs last. |

### Pipelines

Pick the matching pipeline. Run top-to-bottom. `rules-guardian` always last. `prompt-optimizer` only when the request is genuinely vague — unclear scope, conflicting requirements, can't tell what "done" looks like. Skip it for concrete, specific, or well-scoped asks.

- **Full UI Feature:** `bdd-tdd-spec-writer` -> `core-architecture-guardian` (plan) -> `state-machine-agent` -> `data-adapter-builder` -> `ui-component-builder` -> `styles-motion` -> `feature-wiring` -> `route-url-adapter` -> `core-architecture-guardian` (code) -> `rules-guardian`
- **State + UI:** `bdd-tdd-spec-writer` -> `state-machine-agent` -> `ui-component-builder` -> `styles-motion` -> `feature-wiring` -> `route-url-adapter` -> `rules-guardian`
- **Core/Domain Only:** `bdd-tdd-spec-writer` -> `core-architecture-guardian` -> `rules-guardian`
- **UI Component Only:** `ui-component-builder` -> `styles-motion` -> `rules-guardian`
- **Data Adapter Only:** `bdd-tdd-spec-writer` -> `data-adapter-builder` -> `rules-guardian`
- **Route / URL Only:** `route-url-adapter` -> `rules-guardian`
- **Refactor/Cleanup:** `core-architecture-guardian` -> `rules-guardian`
- **Bug Fix:** `bdd-tdd-spec-writer` -> relevant implementation agents -> `rules-guardian`

### Orchestration Rules

- You do not do an agent's job yourself. Each agent owns its domain.
- Never spawn an agent whose domain is not touched by the task.
- If an agent's output invalidates earlier work, re-run affected agents.
- When unsure which pipeline, use the fuller one.
```

- [ ] **Step 3: Verify the file was written**

Run:
```bash
wc -l /Users/golan/Documents/repos/interactive-resume/CLAUDE.md
```
Expected: a non-trivial line count (≈210–230 lines).

---

## Task 13: Copy agent files from source repo

**Files:**
- Create: `$ROOT/.claude/agents/prompt-optimizer.md`
- Create: `$ROOT/.claude/agents/bdd-tdd-spec-writer.md`
- Create: `$ROOT/.claude/agents/core-architecture-guardian.md`
- Create: `$ROOT/.claude/agents/state-machine-agent.md`
- Create: `$ROOT/.claude/agents/data-adapter-builder.md`
- Create: `$ROOT/.claude/agents/ui-component-builder.md`
- Create: `$ROOT/.claude/agents/styles-motion.md`
- Create: `$ROOT/.claude/agents/feature-wiring.md`
- Create: `$ROOT/.claude/agents/route-url-adapter.md`
- Create: `$ROOT/.claude/agents/rules-guardian.md`

**Source dir:** `/Users/golan/Documents/repos/project-04/real-time-players-app/.claude/agents/`

- [ ] **Step 1: Create target directory**

Run:
```bash
mkdir -p /Users/golan/Documents/repos/interactive-resume/.claude/agents
```

- [ ] **Step 2: Copy the 10 client-relevant agent files verbatim**

Run:
```bash
SRC=/Users/golan/Documents/repos/project-04/real-time-players-app/.claude/agents
DST=/Users/golan/Documents/repos/interactive-resume/.claude/agents
for f in prompt-optimizer bdd-tdd-spec-writer core-architecture-guardian state-machine-agent data-adapter-builder ui-component-builder styles-motion feature-wiring route-url-adapter rules-guardian; do
  cp "$SRC/$f.md" "$DST/$f.md"
done
ls "$DST"
```

Expected: `ls` prints all ten `.md` files. `server-feature-builder.md` is intentionally **not** copied.

- [ ] **Step 3: Verify no copy of `server-feature-builder.md` exists**

Run:
```bash
ls /Users/golan/Documents/repos/interactive-resume/.claude/agents/server-feature-builder.md 2>&1
```
Expected: `ls: ... No such file or directory`.

---

## Task 14: `.gitignore` and `README.md`

**Files:**
- Create: `$ROOT/.gitignore`
- Create: `$ROOT/README.md`

- [ ] **Step 1: Write `.gitignore`**

Write file `/Users/golan/Documents/repos/interactive-resume/.gitignore`:

```
node_modules
dist
build
.DS_Store
*.local
.env*.local

src/routeTree.gen.ts
```

- [ ] **Step 2: Write `README.md`**

Write file `/Users/golan/Documents/repos/interactive-resume/README.md`:

```markdown
# Interactive Resume

A 3D website resume where guests explore the companies I've worked at as interactive scenes.

## Stack

- React 19 + Vite
- TypeScript (strictest configuration; no suppressors, no `any`, no `!`)
- TanStack Router (file-based)
- XState v5
- Zod (boundary parsing)
- Vitest + Testing Library
- oxlint

3D rendering library to be chosen in a follow-up session.

## Commands

```bash
pnpm install
pnpm dev      # vite dev server
pnpm check    # typecheck + lint + suppressor scan + tests
pnpm build    # production build
```

## Rules

See `CLAUDE.md` for the Iron Laws and supporting rules.
```

---

## Task 15: Run the full `check` script and verify all gates pass

**Files:** none modified

- [ ] **Step 1: Run `pnpm check`**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm check
```

Expected output (in order):
1. `tsc -b --noEmit` — zero output, exit 0
2. `oxlint` — zero errors, zero warnings, exit 0
3. `node scripts/check-suppressors.mjs` — prints `Suppressor scan clean.`, exit 0
4. `vitest run` — runs the smoke test, reports 1 passed, exit 0

Final exit code: 0.

If any gate fails, stop and report the failure. Do not proceed to git init.

- [ ] **Step 2: Run `pnpm dev` and verify the page renders**

Run (in a separate terminal, or background):
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm dev
```
Expected: Vite prints `Local: http://localhost:5173/` and the dev server stays running.

Verify in a browser at `http://localhost:5173/`:
- Page title: `Interactive Resume`
- Body text: `interactive resume — scaffolding`
- No errors in the browser console.

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 3: Run `pnpm build` and verify `dist/`**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && pnpm build
```
Expected: build completes with no errors. `dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css` (if any) exist.

Verify:
```bash
ls /Users/golan/Documents/repos/interactive-resume/dist/
```
Expected: `index.html` and `assets/` directory.

---

## Task 16: Initialize git and commit

**Files:**
- Create: `$ROOT/.git/`

- [ ] **Step 1: Confirm with user before running `git init`**

Per the spec, `git init` is the final scaffolding step. Confirm with the user that they want this run now. If yes, proceed.

- [ ] **Step 2: Run `git init`**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && git init
```
Expected: Git reports `Initialized empty Git repository in .git/`.

- [ ] **Step 3: Verify `.gitignore` is working**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && git status --short | head -40
```
Expected: untracked files include `.claude/`, `.gitignore`, `.npmrc`, `.oxlintrc.json`, `CLAUDE.md`, `README.md`, `docs/`, `index.html`, `package.json`, `pnpm-lock.yaml`, `scripts/`, `src/`, `tsconfig*.json`, `vite.config.ts`. **Not listed:** `node_modules/`, `dist/`, `src/routeTree.gen.ts`.

- [ ] **Step 4: Stage and commit**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && git add . && git status --short
```
Confirm `routeTree.gen.ts`, `node_modules/`, `dist/` are **not** in the staged set.

Then:
```bash
cd /Users/golan/Documents/repos/interactive-resume && git commit -m "$(cat <<'EOF'
chore: initial scaffold

React 19 + Vite + TypeScript (strictest) + TanStack Router (file-based)
+ XState v5 + Vitest + oxlint. CLAUDE.md and 10 agents adapted from
real-time-players-app. 3D libraries and styling deferred to follow-up
sessions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: a single commit lands the full scaffold.

- [ ] **Step 5: Verify clean tree**

Run:
```bash
cd /Users/golan/Documents/repos/interactive-resume && git status
```
Expected: `nothing to commit, working tree clean`.

---

## Self-Review

- **Spec coverage:** Every section of `docs/superpowers/specs/2026-05-19-interactive-resume-setup-design.md` maps to a task — stack (T1–T3), folder structure (T6–T7), TS config (T4), lint config (T9), suppressor scan (T10), routing (T5–T6), state machines (T2 install only), CLAUDE.md adaptation (T12), agent copies (T13), `.gitignore` + README (T14), verification (T15), git init (T16). Smoke test (T8) is explicit. The deferred "Open questions" section in the spec is correctly absent from the plan.

- **Placeholder scan:** Searched for "TBD", "TODO", "implement later", "fill in details", "similar to" — none present. Every code block contains the full text to write.

- **Type consistency:** `JSX.Element` return type used in both `__root.tsx` (T6/Step 2) and `routes/index.tsx` (T6/Step 3); Task 11 includes a remediation step if React 19's types require importing `JSX` from `react`. The `router` declaration-merging block in `main.tsx` uses `typeof router` which matches the `createRouter` call above it. All script names (`dev`, `build`, `typecheck`, `lint`, `lint:suppressors`, `test`, `check`) defined in T1 are used consistently in T9, T10, T11, T15. Suppressor scan output strings (`Suppressor scan clean.` and `Suppressor scan failed:`) defined in T10/Step 1 match the expected output in T10/Step 2 and T15/Step 1.

- **Risk note:** Task 11's React-19 JSX remediation is conditional — if `tsc` errors on `JSX.Element`, the worker applies the fix; otherwise they skip it. This is explicit, not a placeholder.
