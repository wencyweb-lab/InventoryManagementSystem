# Stocky Inventory Management System

This directory contains the Next.js 16.2, React 19.2, Tailwind CSS 4.3, shadcn 4.16, TypeScript, and Mongoose migration of the legacy Laravel 8/Vue 2 Stocky application.

The application shell and screen design system are adapted from the bundled AdminCN template. See `UI_DESIGN_SYSTEM.md` for component conventions and `LICENSE-ADMINCN.md` for its MIT license notice.

## Local setup

1. Copy `.env.example` to `.env.local` and replace `NEXTAUTH_SECRET`.
2. Start a transaction-capable MongoDB instance:

   ```powershell
   docker compose up -d
   ```

3. Verify the connection and topology:

   ```powershell
   npm run check:env
   ```

4. On a new, disposable database only, seed the initial owner account and master data:

   ```powershell
   npm run seed
   ```

5. Run the application:

   ```powershell
   npm run dev
   ```

The seed command clears seeded collections before recreating them. Do not run it against a database containing data you need to preserve.

## Importing the bundled legacy SQL data

Preview the bundled Laravel SQL dump without writing:

```powershell
npm run import:legacy
```

Apply idempotent upserts to the configured MongoDB:

```powershell
npm run import:legacy -- --apply
```

The importer creates a protected pre-import backup and preserves unrelated Mongo documents. See `LEGACY_SQL_IMPORT.md` for the exact imported rows, skipped Laravel-only tables, credentials, and source-data limitations.

## Adding comprehensive demo data

Preview the non-destructive demo dataset:

```powershell
npm run seed:demo
```

Back up the current database and apply idempotent demo upserts:

```powershell
npm run seed:demo -- --apply
```

Unlike `npm run seed`, this command does not clear imported or user-created records. It creates connected data across every model-backed collection and derives warehouse stock from auditable adjustments and transaction state. See `DEMO_DATA.md` for credentials, counts, stock logic, and re-run behavior.

## Why a replica set is mandatory

Creating or editing a sale, purchase, return, transfer, adjustment, POS checkout, or payment changes multiple documents. Stocky commits those changes in one MongoDB transaction so the commercial record, payment totals, reference counter, and base-unit stock cannot disagree. Standalone MongoDB servers do not support that guarantee; write APIs return a clear `503` until a replica set or sharded cluster is configured.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

The root design tokens are CSS-first Tailwind v4 variables in `app/globals.css`. Inter, Noto Serif Georgian, and JetBrains Mono are self-hosted at build time through `next/font` in `app/layout.tsx`.

See `FRAMEWORK_UPGRADE.md` for the exact upgraded versions and compatibility changes. See `MIGRATION_AUDIT.md` for the legacy parity analysis, preserved domain rules, completed scope, and remaining external integrations.
