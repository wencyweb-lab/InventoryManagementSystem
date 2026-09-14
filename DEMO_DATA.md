# Comprehensive MongoDB demo data

Last applied and verified: 2026-07-28

## Purpose and safety

`npm run seed:demo` is a dry run. `npm run seed:demo -- --apply` creates a full JSON snapshot under `storage/backups/demo-seed-pre-*.json` and then performs stable, non-destructive upserts.

The seed preserves the legacy SQL owner, settings, client, currency, SMTP configuration, permissions, and unrelated user records. Demo entities use stable `Demo` names, `DM...` codes, and reserved references in the `9100`–`9900` range. Re-running the command updates those same records rather than duplicating them.

Do not confuse this with `npm run seed`, which is the destructive first-install seed.

## Demo logins

| Role | Email | Password | Permissions |
|---|---|---|---:|
| Manager | `manager.demo@stocky.local` | `Demo123!` | 31 |
| Cashier | `cashier.demo@stocky.local` | `Demo123!` | 9 |

The imported owner remains available as `admin@example.com` with all 88 permissions.

Administrator (Owner - All 88 Permissions)
Email: admin@example.com
Password: 123456
Name: William Castillo
Role: Owner

## Current database coverage

| Area | Records |
|---|---:|
| Users / roles / permissions | 3 / 3 / 88 |
| Currencies / categories / brands / units | 3 / 3 / 3 / 5 |
| Warehouses / customers / suppliers | 3 / 5 / 3 |
| Products / warehouse-variant stock identities | 5 / 21 |
| Purchases / sales / quotations | 4 / 8 / 2 |
| Sale returns / purchase returns | 2 / 2 |
| Transfers / adjustments | 2 / 4 |
| Expense categories / expenses | 3 / 4 |
| Sale / purchase payments | 6 / 3 |
| Sale-return / purchase-return payments | 1 / 1 |
| System / POS / SMTP settings | 1 / 1 / 1 |
| Payment gateway / SMS settings | 1 / 1 |
| Communication logs / counters | 2 / 16 |

All 32 model-backed collections contain data after the seed.

## Data integrity rules

- Products include base units, purchase-unit conversion, inclusive/exclusive taxes, alert quantities, and a three-variant T-shirt.
- Each warehouse begins with an explicit opening-balance adjustment, so initial stock is auditable rather than hidden.
- Received purchases add base-unit stock; pending purchases do not.
- Completed sales subtract stock; the pending sale does not.
- Received sale returns add stock and completed purchase returns subtract it.
- The completed transfer moves stock between warehouses; the pending transfer has no effect.
- A damage adjustment subtracts stock directly in base units.
- Every payment-bearing document's `paid_amount` equals its payment rows, and its paid/partial/unpaid state is recalculated from the grand total.
- The seed aborts if any derived stock is negative, any payment total/status is inconsistent, a stock row differs from the ledger, or any model collection remains empty.

## Verified application APIs

The production smoke test authenticated all three users and returned HTTP 200 from the dashboard API. Owner-scoped list APIs returned the expected products, purchases, sales, quotations, returns, transfers, adjustments, expenses, customers, and suppliers.

The configured MongoDB is still standalone. Reading and authentication work, but creating/editing stock-changing records through application APIs requires a replica set or sharded cluster because those operations use transactions.
