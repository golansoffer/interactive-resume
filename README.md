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
