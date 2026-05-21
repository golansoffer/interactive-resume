# Unsupported Device Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a visitor lands on the site from any device that is not a wide desktop with a fine pointer, render a professional "site requires desktop" screen at the root level — the heavy 3D scene tree must never mount on those devices. Reactive to viewport resize and orientation change.

**Architecture:** Pure DU (`{kind:'desktop'}|{kind:'unsupported'}`) lives in `src/lib/deviceSupport.ts` alongside a `matchMedia`-backed `readDeviceSupport()` snapshot and `subscribeDeviceSupport(onChange)` adapter. The composition root (`__root.tsx`) calls `useSyncExternalStore(subscribe, read)` and switches on the DU's `kind` — no `useState`, no `useEffect`. The unsupported screen is a pure presentational component that mirrors the existing HUD voice (`ShipSelectorWidget`).

**Tech Stack:** React 19 (`useSyncExternalStore`), TypeScript, TanStack Router, Tailwind v4, Vitest, jsdom, @testing-library/react.

**Project rules:** `/Users/golan/Documents/repos/interactive-resume/CLAUDE.md` — Iron Laws are enforced by `pnpm lint:suppressors` and reviewers. Read before any task.

**Gate query:** `(min-width: 1024px) and (any-pointer: fine)`. Admits desktops/laptops (incl. touchscreen laptops via `any-pointer`); rejects all phones, all tablets including iPad landscape, and narrow desktop windows.

---

## File structure

**Create (4 new files):**

```
src/lib/deviceSupport.ts            — DU + constructor + read + subscribe (one small module)
src/lib/deviceSupport.test.ts       — constructor matrix, read snapshot, subscribe lifecycle
src/components/UnsupportedDevice.tsx       — pure UI, HUD voice, no router/R3F/effects
src/components/UnsupportedDevice.test.tsx  — eyebrow / heading / subtitle / corner brackets
```

**Modify (2 existing files):**

```
src/routes/__root.tsx                       — gate Outlet via useSyncExternalStore + DU switch
src/__tests__/route-gate.smoke.test.tsx     — assert unsupported view renders and canvas does NOT mount when matchMedia matches:false
```

**Total:** ~150 LOC across 6 files. Single round-trip per task.

---

### Task 1: `deviceSupport` DU + pure constructor

Recommended subagent: `data-adapter-builder` (externality boundary lives here even though the constructor is pure).

**Files:**
- Create: `src/lib/deviceSupport.ts`
- Create: `src/lib/deviceSupport.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/deviceSupport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deviceSupportFromMatches, type DeviceSupport } from './deviceSupport';

describe('deviceSupportFromMatches — pure constructor', () => {
  it('returns the desktop variant when matches is true', () => {
    const result: DeviceSupport = deviceSupportFromMatches(true);
    expect(result).toEqual({ kind: 'desktop' });
  });

  it('returns the unsupported variant when matches is false', () => {
    const result: DeviceSupport = deviceSupportFromMatches(false);
    expect(result).toEqual({ kind: 'unsupported' });
  });

  it('returns referentially stable singletons (===) across calls with the same input', () => {
    expect(deviceSupportFromMatches(true)).toBe(deviceSupportFromMatches(true));
    expect(deviceSupportFromMatches(false)).toBe(deviceSupportFromMatches(false));
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm vitest run src/lib/deviceSupport.test.ts`
Expected: FAIL — `deviceSupport.ts` does not exist yet.

- [ ] **Step 3: Implement minimal code to pass**

Create `src/lib/deviceSupport.ts`:

```ts
export type DeviceSupport = { readonly kind: 'desktop' } | { readonly kind: 'unsupported' };

const DESKTOP: DeviceSupport = { kind: 'desktop' };
const UNSUPPORTED: DeviceSupport = { kind: 'unsupported' };

export const deviceSupportFromMatches = (matches: boolean): DeviceSupport =>
  matches ? DESKTOP : UNSUPPORTED;
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm vitest run src/lib/deviceSupport.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deviceSupport.ts src/lib/deviceSupport.test.ts
git commit -m "feat(lib): add deviceSupport DU and pure constructor"
```

---

### Task 2: `readDeviceSupport` snapshot (matchMedia adapter)

Recommended subagent: `data-adapter-builder`.

**Files:**
- Modify: `src/lib/deviceSupport.ts`
- Modify: `src/lib/deviceSupport.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/deviceSupport.test.ts`:

```ts
import { afterEach, beforeEach, vi } from 'vitest';
import { readDeviceSupport } from './deviceSupport';

type MQLStub = { readonly matches: boolean };

const stubWindowMatchMedia = (matches: boolean): void => {
  const mql: MQLStub = { matches };
  vi.stubGlobal('window', {
    matchMedia: vi.fn((_query: string): MQLStub => mql),
  });
};

const stubWindowWithoutMatchMedia = (): void => {
  vi.stubGlobal('window', {});
};

describe('readDeviceSupport — snapshot from matchMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns desktop when matchMedia reports matches:true', () => {
    stubWindowMatchMedia(true);
    expect(readDeviceSupport()).toEqual({ kind: 'desktop' });
  });

  it('returns unsupported when matchMedia reports matches:false', () => {
    stubWindowMatchMedia(false);
    expect(readDeviceSupport()).toEqual({ kind: 'unsupported' });
  });

  it('falls back to desktop when window.matchMedia is unavailable (never lock the user out)', () => {
    stubWindowWithoutMatchMedia();
    expect(readDeviceSupport()).toEqual({ kind: 'desktop' });
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm vitest run src/lib/deviceSupport.test.ts`
Expected: FAIL — `readDeviceSupport` is not exported.

- [ ] **Step 3: Implement `readDeviceSupport`**

Append to `src/lib/deviceSupport.ts`:

```ts
// (min-width:1024px) admits desktop-class viewports; (any-pointer:fine) admits any
// device that exposes a precise pointer (mouse/trackpad), even alongside a touchscreen.
// Together they exclude phones, tablets (incl. iPad landscape), and narrow desktop windows.
const DESKTOP_QUERY = '(min-width: 1024px) and (any-pointer: fine)';

const getMediaQueryList = (): MediaQueryList | undefined => {
  const win: Window | undefined = globalThis.window;
  if (win === undefined || typeof win.matchMedia !== 'function') return undefined;
  return win.matchMedia(DESKTOP_QUERY);
};

export const readDeviceSupport = (): DeviceSupport => {
  const mql = getMediaQueryList();
  if (mql === undefined) return DESKTOP;
  return deviceSupportFromMatches(mql.matches);
};
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm vitest run src/lib/deviceSupport.test.ts`
Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deviceSupport.ts src/lib/deviceSupport.test.ts
git commit -m "feat(lib): readDeviceSupport snapshot from matchMedia"
```

---

### Task 3: `subscribeDeviceSupport` listener (matchMedia adapter)

Recommended subagent: `data-adapter-builder`.

**Files:**
- Modify: `src/lib/deviceSupport.ts`
- Modify: `src/lib/deviceSupport.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/deviceSupport.test.ts`:

```ts
import { subscribeDeviceSupport } from './deviceSupport';

type ChangeHandler = (event: { readonly matches: boolean }) => void;
type ListenableMQL = {
  readonly matches: boolean;
  readonly addEventListener: ReturnType<typeof vi.fn>;
  readonly removeEventListener: ReturnType<typeof vi.fn>;
};

const stubListenableMatchMedia = (initial: boolean): ListenableMQL => {
  const mql: ListenableMQL = {
    matches: initial,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('window', { matchMedia: vi.fn((): ListenableMQL => mql) });
  return mql;
};

describe('subscribeDeviceSupport — matchMedia listener lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers a change listener on the MediaQueryList', () => {
    const mql = stubListenableMatchMedia(true);
    const onChange = vi.fn();
    subscribeDeviceSupport(onChange);
    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    expect(mql.addEventListener.mock.calls[0]?.[0]).toBe('change');
  });

  it('returns an unsubscribe that removes the same listener', () => {
    const mql = stubListenableMatchMedia(true);
    const onChange = vi.fn();
    const unsubscribe = subscribeDeviceSupport(onChange);
    const registered = mql.addEventListener.mock.calls[0]?.[1];
    unsubscribe();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', registered);
  });

  it('invokes onChange when the underlying MediaQueryList emits a change', () => {
    const mql = stubListenableMatchMedia(false);
    const onChange = vi.fn();
    subscribeDeviceSupport(onChange);
    const handler = mql.addEventListener.mock.calls[0]?.[1] as ChangeHandler | undefined;
    if (handler === undefined) throw new Error('handler was not registered');
    handler({ matches: true });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when window.matchMedia is unavailable', () => {
    vi.stubGlobal('window', {});
    const unsubscribe = subscribeDeviceSupport(vi.fn());
    expect(() => unsubscribe()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

Run: `pnpm vitest run src/lib/deviceSupport.test.ts`
Expected: FAIL — `subscribeDeviceSupport` is not exported.

- [ ] **Step 3: Implement `subscribeDeviceSupport`**

Append to `src/lib/deviceSupport.ts`:

```ts
export const subscribeDeviceSupport = (onChange: () => void): (() => void) => {
  const mql = getMediaQueryList();
  if (mql === undefined) return (): void => {};
  const handler = (): void => onChange();
  mql.addEventListener('change', handler);
  return (): void => mql.removeEventListener('change', handler);
};
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm vitest run src/lib/deviceSupport.test.ts`
Expected: PASS — 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deviceSupport.ts src/lib/deviceSupport.test.ts
git commit -m "feat(lib): subscribeDeviceSupport matchMedia listener"
```

---

### Task 4: `UnsupportedDevice` pure component

Recommended subagent: `ui-component-builder` for structure, then `styles-motion` for token alignment if any polish is needed.

**Files:**
- Create: `src/components/UnsupportedDevice.tsx`
- Create: `src/components/UnsupportedDevice.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/UnsupportedDevice.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { UnsupportedDevice } from './UnsupportedDevice';

afterEach(() => {
  cleanup();
});

describe('UnsupportedDevice — static splash for non-desktop visitors', () => {
  it('renders the HUD eyebrow with "SIGNAL · DESKTOP REQUIRED"', () => {
    render(<UnsupportedDevice />);
    expect(screen.getByText(/SIGNAL\s+·\s+DESKTOP REQUIRED/u)).toBeDefined();
  });

  it('renders the headline "Open this on desktop." as a level-1 heading', () => {
    render(<UnsupportedDevice />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toBe('Open this on desktop.');
  });

  it('renders an explanatory subtitle mentioning mouse, keyboard, and desktop browser', () => {
    render(<UnsupportedDevice />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('mouse');
    expect(text).toContain('keyboard');
    expect(text).toContain('desktop browser');
  });

  it('renders four decorative HUD corner brackets (aria-hidden)', () => {
    const { container } = render(<UnsupportedDevice />);
    const corners = container.querySelectorAll('[data-hud-corner]');
    expect(corners.length).toBe(4);
    corners.forEach((c) => {
      expect(c.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm vitest run src/components/UnsupportedDevice.test.tsx`
Expected: FAIL — `UnsupportedDevice` module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/UnsupportedDevice.tsx`:

```tsx
import type { CSSProperties, JSX } from 'react';
import { cn } from '@/lib/utils';

// Mirrors the ShipSelectorWidget aesthetic: dark backdrop with neutral radial pools,
// four HUD corner brackets, mono eyebrow, semibold title, muted subtitle. Pure UI —
// no router, no R3F, no effects.

const BACKDROP_STYLE: CSSProperties = {
  background:
    'radial-gradient(80% 60% at 30% 20%, #161616 0%, transparent 60%), ' +
    'radial-gradient(60% 50% at 80% 80%, #1c1c1c 0%, transparent 70%), ' +
    'linear-gradient(180deg, #080808 0%, #0e0e0e 100%)',
};

const containerClassName = cn(
  'relative flex h-screen w-screen items-center justify-center overflow-hidden',
  'text-(--color-fg) px-8',
);

const cornerBase = cn('pointer-events-none absolute h-8 w-8 border-(--color-fg)/15');
const cornerTopLeft = cn(cornerBase, 'left-4 top-4 border-l border-t');
const cornerTopRight = cn(cornerBase, 'right-4 top-4 border-r border-t');
const cornerBottomLeft = cn(cornerBase, 'bottom-4 left-4 border-b border-l');
const cornerBottomRight = cn(cornerBase, 'bottom-4 right-4 border-b border-r');

const eyebrowClassName = cn(
  'font-mono text-[10px] tracking-[0.4em] uppercase text-(--color-fg)/55',
);
const titleClassName = cn(
  'mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-(--color-fg)',
);
const subtitleClassName = cn(
  'mt-4 max-w-md text-xs md:text-sm leading-relaxed tracking-wide text-(--color-fg)/60',
);

export const UnsupportedDevice = (): JSX.Element => (
  <main className={containerClassName} style={BACKDROP_STYLE}>
    <span data-hud-corner className={cornerTopLeft} aria-hidden="true" />
    <span data-hud-corner className={cornerTopRight} aria-hidden="true" />
    <span data-hud-corner className={cornerBottomLeft} aria-hidden="true" />
    <span data-hud-corner className={cornerBottomRight} aria-hidden="true" />
    <div className="flex flex-col items-center text-center">
      <span className={eyebrowClassName}>{'// SIGNAL · DESKTOP REQUIRED'}</span>
      <h1 className={titleClassName}>Open this on desktop.</h1>
      <p className={subtitleClassName}>
        This interactive resume runs as a real-time 3D tour built for mouse, keyboard,
        and a wider screen. Visit again from a desktop browser to launch.
      </p>
    </div>
  </main>
);
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm vitest run src/components/UnsupportedDevice.test.tsx`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/UnsupportedDevice.tsx src/components/UnsupportedDevice.test.tsx
git commit -m "feat(components): UnsupportedDevice splash for non-desktop visitors"
```

---

### Task 5: Root-layout gate + integration test

Recommended subagent: `route-url-adapter` (route file = URL adapter; the composition root is the bridge).

**Files:**
- Modify: `src/routes/__root.tsx`
- Modify: `src/__tests__/route-gate.smoke.test.tsx`

- [ ] **Step 1: Extend the smoke test (failing)**

Open `src/__tests__/route-gate.smoke.test.tsx`. Add a second `describe` block to the existing file (after the closing brace of the existing `describe('route gate', ...)`):

```tsx
type ListenableMQL = {
  readonly matches: boolean;
  readonly addEventListener: () => void;
  readonly removeEventListener: () => void;
};

const installMatchMediaStub = (matches: boolean): void => {
  const mql: ListenableMQL = {
    matches,
    addEventListener: (): void => {},
    removeEventListener: (): void => {},
  };
  vi.stubGlobal('window', {
    ...globalThis.window,
    matchMedia: (): ListenableMQL => mql,
  });
};

describe('root-level device-support gate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('renders the UnsupportedDevice splash and does NOT mount the canvas when matchMedia matches:false', async () => {
    installMatchMediaStub(false);
    const { ui } = mountAt('/?ship=speederA');
    render(ui);
    expect(await screen.findByRole('heading', { level: 1, name: 'Open this on desktop.' })).toBeDefined();
    expect(screen.queryByTestId('canvas')).toBeNull();
    expect(screen.queryByText('Choose your ship')).toBeNull();
  });

  it('renders the normal scene when matchMedia matches:true', async () => {
    installMatchMediaStub(true);
    const { ui } = mountAt('/?ship=speederA');
    render(ui);
    expect(await screen.findByTestId('canvas')).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Open this on desktop.' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run smoke test, expect failure**

Run: `pnpm vitest run src/__tests__/route-gate.smoke.test.tsx`
Expected: FAIL — root layout does not gate yet.

- [ ] **Step 3: Implement the root-layout gate**

Replace `src/routes/__root.tsx` with:

```tsx
import type { JSX } from 'react';
import { useSyncExternalStore } from 'react';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { readDeviceSupport, subscribeDeviceSupport } from '@/lib/deviceSupport';
import { UnsupportedDevice } from '@/components/UnsupportedDevice';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout(): JSX.Element {
  const support = useSyncExternalStore(subscribeDeviceSupport, readDeviceSupport);
  switch (support.kind) {
    case 'unsupported':
      return <UnsupportedDevice />;
    case 'desktop':
      return (
        <>
          <Outlet />
          {import.meta.env.DEV ? <TanStackRouterDevtools /> : null}
        </>
      );
  }
}
```

- [ ] **Step 4: Run smoke test, expect pass**

Run: `pnpm vitest run src/__tests__/route-gate.smoke.test.tsx`
Expected: PASS — both new tests green, all original route-gate tests still pass (they don't stub matchMedia, so `readDeviceSupport` falls back to `desktop`).

- [ ] **Step 5: Commit**

```bash
git add src/routes/__root.tsx src/__tests__/route-gate.smoke.test.tsx
git commit -m "feat(routes): gate root layout on device-support DU; render UnsupportedDevice for non-desktop"
```

---

### Task 6: Full verification (typecheck + suite + browser smoke)

Recommended subagent: `rules-guardian` (read-only audit at end), then manual browser smoke.

**Files:** none (verification only).

- [ ] **Step 1: Typecheck the whole project**

Run: `pnpm tsc --noEmit`
Expected: clean — no `TS####` errors.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm vitest run`
Expected: all previously-passing tests still pass; the 3 pre-existing `starfieldSpec.test.ts` flakies are unchanged in count and identity (statistical-distribution assertions unrelated to this change).

- [ ] **Step 3: Lint suppressors gate**

Run: `pnpm lint:suppressors`
Expected: exit 0 — no postfix `!`, `as NonNullable`, `??` on lookup, `@ts-*`, `eslint-disable`, or `any`-hiding-nullability introduced.

- [ ] **Step 4: Browser smoke — desktop path**

Run: `pnpm dev` (background). Open the dev URL in a desktop browser at width ≥ 1024px with a mouse. Confirm:
- The ship-selector / scene renders normally.
- No "Open this on desktop." text appears anywhere.
- Resizing the window down to <1024px swaps to the UnsupportedDevice splash without a page reload.
- Resizing back up swaps back to the scene.

- [ ] **Step 5: Browser smoke — mobile emulation**

In DevTools, switch to a phone preset (e.g. iPhone 14). Reload. Confirm:
- Only the UnsupportedDevice splash renders.
- No R3F Canvas is in the DOM (inspect element).
- No 3D asset network requests fire.

- [ ] **Step 6: `rules-guardian` audit pass (subagent)**

Dispatch the `rules-guardian` agent for a read-only review of all changed files (`src/lib/deviceSupport.ts`, `src/lib/deviceSupport.test.ts`, `src/components/UnsupportedDevice.tsx`, `src/components/UnsupportedDevice.test.tsx`, `src/routes/__root.tsx`, `src/__tests__/route-gate.smoke.test.tsx`) against `CLAUDE.md`. Address any HARD REJECTs by re-running the affected earlier task.

- [ ] **Step 7: Final commit summary**

If `rules-guardian` produces no further changes, the feature is complete. Otherwise, commit fixes per the agent's findings.

---

## Self-review notes (post-write)

- **Spec coverage:** all five design decisions from the brainstorm (sci-fi voice, `1024 + any-pointer:fine` gate, no CTA, `useSyncExternalStore`, hex split into lib/component/route) are realized in Tasks 1–5.
- **Placeholder scan:** no "TBD", "TODO", "fill in later", or vague "add tests for the above" anywhere — every step has the actual code.
- **Type consistency:** `DeviceSupport` shape (`{kind:'desktop'} | {kind:'unsupported'}`), `readDeviceSupport`/`subscribeDeviceSupport` signatures, and `UnsupportedDevice` import path are identical across all task references.
- **Scope check:** one subsystem, one composition root, one new lib module, one new component. Fits a single plan; no decomposition needed.
- **Ambiguity:** the `(min-width:1024px) and (any-pointer:fine)` query is fixed and stated upfront; no later task reinterprets it.
