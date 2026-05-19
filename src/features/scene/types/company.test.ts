import { describe, expect, it } from 'vitest';

const TYPE_FILE_REL = '/src/features/scene/types/company.ts';

const sourceFiles = import.meta.glob('/src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const nonTestSources: ReadonlyArray<{ readonly path: string; readonly content: string }> = Object
  .entries(sourceFiles)
  .filter(([path]) => !/\.test\.(?:ts|tsx)$/u.test(path) && !path.endsWith('routeTree.gen.ts'))
  .map(([path, content]) => ({ path, content }));

describe('CompanyId branding invariant', () => {
  it('finds exactly one non-test source file in src/ defining asCompanyId, located at src/features/scene/types/company.ts', () => {
    const definitionPattern = /\bconst\s+asCompanyId\b|\bfunction\s+asCompanyId\b/u;
    const matches = nonTestSources
      .filter(({ content }) => definitionPattern.test(content))
      .map(({ path }) => path);
    expect(matches).toEqual([TYPE_FILE_REL]);
  });

  it('finds exactly one occurrence of the literal "as CompanyId" cast in non-test src/, located inside asCompanyId in src/features/scene/types/company.ts', () => {
    const castPattern = /\bas\s+CompanyId\b/u;
    const matches = nonTestSources.flatMap(({ path, content }) =>
      content
        .split('\n')
        .flatMap((line, index) =>
          castPattern.test(line) ? [{ path, line: index + 1 }] : [],
        ),
    );
    expect(matches.map((m) => m.path)).toEqual([TYPE_FILE_REL]);
  });
});
