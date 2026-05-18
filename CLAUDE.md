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
