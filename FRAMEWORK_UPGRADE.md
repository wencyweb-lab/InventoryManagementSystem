# Framework upgrade

Last verified: 2026-07-28

## Installed versions

| Package | Version |
|---|---:|
| Next.js | 16.2.12 |
| React / React DOM | 19.2.8 |
| Tailwind CSS | 4.3.3 |
| `@tailwindcss/postcss` | 4.3.3 |
| shadcn CLI | 4.16.0 |
| `tailwind-merge` | 3.6.0 |
| `tw-animate-css` | 1.4.0 |
| `next-themes` | 0.4.6 |
| ESLint | 9.39.5 |
| `eslint-config-next` | 16.2.12 |

ESLint 9 is intentional: Next 16 accepts ESLint 9 or newer, while the React lint plugin currently bundled by `eslint-config-next` crashes under ESLint 10.8 before it can analyze the project.

## Migration changes

- Replaced the Tailwind v3 directives and JavaScript configuration with Tailwind v4 CSS-first `@theme inline` tokens.
- Applied the supplied OKLCH light/dark palette, radius, shadow, spacing, tracking, chart, and sidebar variables.
- Added current shadcn Tailwind utilities and replaced deprecated `tailwindcss-animate` with `tw-animate-css`.
- Updated shadcn configuration to the `new-york` style and Tailwind v4's empty config path.
- Added Inter, Noto Serif Georgian, and JetBrains Mono through `next/font/google` while retaining Stocky's metadata and application providers.
- Updated local shadcn primitives with React 19-friendly component props and `data-slot` metadata.
- Replaced Next 14's `middleware.ts` convention with an explicit Next 16 `proxy.ts` wrapper for NextAuth.
- Replaced removed `next lint` usage with the ESLint flat-config CLI.

## Verification

- `npm run lint`: passes with warnings only; warnings identify existing hook dependency, unused import, and image-optimization cleanup work.
- `npm run typecheck`: passes after Next 16 route type generation.
- `npm test`: 18/18 domain tests pass.
- `npm run build`: passes under Next 16 Turbopack and generates all 82 pages.
- Production smoke: legacy owner login, authenticated session with 88 permissions, `/dashboard`, and `/api/dashboard` all pass.

The configured MongoDB remains a standalone server. Read-only/authentication paths work, but stock-changing workflows still require a replica set or sharded cluster for transactions.
