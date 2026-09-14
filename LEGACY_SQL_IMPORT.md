# Legacy SQL import

## Imported source

Source: `../Legacy Code/software_inventorydb22.sql`

SHA-256: `6b1bef514b0c638b7f45f1e9711b8529c1c9faa200e26d123d1015114c001382`

The dump contains data for the following application tables:

| SQL table | Rows | MongoDB handling |
|---|---:|---|
| `permissions` | 88 | Upsert by permission name |
| `permission_role` | 88 | Resolve permission references for roles |
| `roles` | 1 | Upsert Owner role |
| `role_user` | 1 | Resolve user role references |
| `users` | 1 | Upsert by normalized email |
| `clients` | 1 | Upsert by legacy code or email |
| `currencies` | 1 | Upsert by currency code |
| `pos_settings` | 1 | Update the singleton POS configuration |
| `settings` | 1 | Update the singleton system configuration |
| `servers` | 1 | Upsert SMTP settings; encrypt the password before storage |

The 90 Laravel migration-history rows and three Laravel Passport rows are intentionally ignored. Next.js/Mongoose does not consume Laravel migration state, and NextAuth replaces Passport clients/tokens.

## Legacy user

| Field | Value |
|---|---|
| Name | William Castillo |
| Username | William Castillo |
| Email | `admin@example.com` |
| Password | `123456` |
| Phone | `0123456789` |
| Status | Active |
| Role | Owner |
| Permissions | All 88 imported permissions |

The original Laravel bcrypt hash is retained. The importer verifies it with the same `bcryptjs` implementation used by NextAuth before reporting success.

## Commands

The importer defaults to a non-writing dry run:

```powershell
npm run import:legacy
```

Apply idempotent upserts to the database configured by `.env.local`:

```powershell
npm run import:legacy -- --apply
```

Use another dump path when necessary:

```powershell
npm run import:legacy -- --file="C:\path\to\dump.sql" --apply
```

Every apply run first writes a protected JSON snapshot of affected collections under `storage/backups/legacy-import-pre-*.json`. The importer never deletes unrelated MongoDB records, so the existing Main Warehouse and seed client remain available. Re-running the importer updates the same legacy records rather than creating duplicate roles/users/currencies.

## Current imported result

- Company: Inventory
- Company email: `phpsoftwarestore@gmail.com`
- Company phone: `8271897347`
- Address: Pisoli, Pune, India
- Currency: USD
- Default legacy client: `walk-in-customer`
- Existing warehouse preserved: Main Warehouse
- SMTP host: `mailtrap.io:2525`; its legacy password is encrypted at rest

## Source-data limitation

The SQL dump defines many business tables but contains no inserted rows for units, products, product variants, product warehouse stock, suppliers, purchases, sales, quotations, returns, transfers, adjustments, expenses, or payments. Consequently, those MongoDB collections correctly remain empty after an exact import. Test records for those modules must be created separately and must not be presented as data originating from this SQL file.

The currently configured MongoDB is reachable but standalone. Stock-mutating APIs require transactions and will return `503` until `MONGODB_URI` points to a replica set or sharded cluster. Use the included `docker-compose.yml` replica-set setup and run `npm run check:env` before testing commercial create/edit/delete flows.
