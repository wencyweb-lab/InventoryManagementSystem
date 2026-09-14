# Stocky Migration Audit

Last verified: 2026-07-28

## Scope and source of truth

This audit compares the bundled Laravel 8/Vue 2/MySQL application in `../Legacy Code` with this Next.js 16/React 19/TypeScript/Mongoose migration. The source review covered Laravel and Vue routes, controllers, policies, models, migrations, seeders, SQL schema/data, Blade/Vue views, application documentation, and owned integration points. Composer `vendor` and generated assets were treated as dependencies rather than business modules.

The deeper legacy dossier is `../LEGACY_CODE_ARCHITECTURE.md`. The AdminCN visual migration is documented in `UI_DESIGN_SYSTEM.md`.

## Current measured implementation

| Area | Current result |
|---|---:|
| Next.js API route-handler files | 63 |
| Next.js pages | 76 |
| Mongoose model files | 23 |
| React component files | 35 |
| Seeded legacy permission names | 88 |
| Automated domain tests | 18 passing assertions across 5 test files |
| TypeScript | Passing (`tsc --noEmit`) |
| Production build | Passing (82 generated pages plus dynamic API routes) |
| Production login smoke test | Passing (owner session, 88 permissions, dashboard page/API HTTP 200) |

MongoDB embeds transaction details inside document headers, so the number of model files intentionally differs from the legacy Eloquent class count. `Payments.ts`, `Returns.ts`, and `Settings.ts` contain related schema families; `ProductWarehouse` remains a separate stock-truth collection.

## Preserved domain architecture

```text
React page/component
  -> authenticated Next.js route handler
    -> exact permission + record-scope guard
      -> request validation
        -> MongoDB transaction session
          -> canonical financial calculation
          -> atomic reference allocation
          -> conditional base-unit stock mutation
          -> persisted document and communication/payment side effects
```

### Stock and unit invariants

- `ProductWarehouse.qte` is always a base-unit quantity.
- Transaction-to-base conversion is `qty / operator_value` for `/`; otherwise it is `qty * operator_value`.
- Display conversion is the inverse of storage conversion.
- Stock identity is `(product_id, warehouse_id, variant_id-or-null)` and is uniquely indexed.
- Stock-consuming operations use a conditional `qte >= delta` update and reject insufficient stock.
- Missing stock rows fail the operation instead of silently committing a commercial document.
- Create, edit, delete, POS, payment, return, transfer, and adjustment operations use transaction-capable MongoDB sessions.

### Stock state machine

| Document | Trigger status | Stock effect |
|---|---|---|
| Purchase | `received` | add stock |
| Sale / POS | `completed` | subtract stock |
| Sale return | `received` | add stock |
| Purchase return | `completed` | subtract stock |
| Transfer | `sent` | subtract source |
| Transfer | `completed` | subtract source and add destination |
| Adjustment | per-line `add` / `sub` | direct base-unit delta |
| Quotation | any | no effect |

Edits reverse the previous effect and apply the new effect inside one transaction. Deletes reverse the current effect before soft deletion.

### Financial invariants

- The server recomputes line discount, net price, tax, subtotal, order tax, and grand total; forged browser totals are ignored.
- Discount method `1` is percentage and method `2` is fixed.
- Tax method `1` is exclusive and method `2` is inclusive.
- Payment status is derived from the remaining due amount as `paid`, `partial`, or `unpaid` with cent tolerance.
- Payments, parent paid amount, payment state, reference allocation, and stock effects commit atomically where applicable.
- Invalid conversions, negative values, zero quantities, excessive discounts, overpayments, same-warehouse transfers, and insufficient balances are rejected.

### Authorization and data scope

- Every write/read API authenticates independently of navigation middleware.
- Route handlers enforce the legacy permission name for their operation.
- Users without `record_view` are scoped to their own commercial records and related payments/reports.
- The sidebar filters navigation for usability only; it is not the security boundary.
- Active status, roles, and permission data are refreshed instead of relying only on a long-lived browser state.

## Implemented feature parity

### Products and master data

- Product CRUD, multiple validated images, variants, base/sale/purchase units, tax configuration, warehouse stock, alerts, barcode printing, CSV import, and scoped XLSX export.
- Categories, brands, units, warehouses, currencies, and expense categories have management APIs and UI.
- Imports are parsed and validated before writes; spreadsheet exports neutralize formula injection.

### Commercial documents and stock operations

- Purchases, sales, quotations, sale returns, purchase returns, transfers, adjustments, expenses, and POS have list/create/edit/detail flows appropriate to the document type.
- Quotations can preload a sale without mutating stock themselves.
- POS supports warehouse/customer defaults, product and variant stock, exact barcode submission, tendered/change calculation, payment method, payment notes, receipt visibility settings, print, and warehouse-change cart protection.
- Sale, purchase, and return payments support add/edit/delete and derived parent status.

### People, settings, and communications

- Customers, suppliers, users, roles, profile, system/POS/SMTP/payment-gateway/SMS settings, and backup management are present.
- SMTP and Twilio secrets are encrypted with authenticated encryption and are never returned in plaintext.
- Email and SMS delivery use saved party contact details, permission/record scope, idempotency keys, and communication logs.
- Browser print layouts provide document/receipt PDF output without trusting a remote rendering service.

### Reports

- Profit and loss, sales, purchases, four payment families, customer/supplier summaries and details, warehouse inventory, and stock alerts are implemented.
- The dashboard uses live seven-day sales/purchase data, revenue composition, inventory alerts, latest sales, and top-customer widgets.

## AdminCN UI migration

The previous dark-only dashboard has been replaced by an application-wide AdminCN-derived system:

- neutral light/dark tokens with persisted system/theme selection;
- grouped permission-aware parent/child navigation;
- desktop compact sidebar and mobile drawer;
- sticky breadcrumb header, live stock notifications, profile menu, and footer;
- reusable Card and Button primitives plus shared form/table/status conventions;
- template-style metric cards, nested chart surfaces, progress widgets, and dense tables;
- responsive redesigns for dashboard, login, POS, reports, profile, CRUD lists, forms, dialogs, transaction details, payments, and settings surfaces.

The original AdminCN MIT notice is retained in `LICENSE-ADMINCN.md`.

## Remaining operational/external work

These are deployment or external-service gaps, not missing local CRUD screens:

1. The configured MongoDB in `.env.local` is currently a standalone server. Production write flows require the documented replica set; `docker-compose.yml` provides a local single-node `rs0` option and `npm run check:env` verifies topology.
2. Stripe settings are stored safely, but live Stripe charge/refund orchestration still requires explicit payment intent, webhook, idempotency, and reconciliation policy before it should be enabled.
3. SMTP and Twilio adapters require valid external credentials and provider-side verification to complete a real delivery test.
4. Password reset, the legacy 15-language catalog, and cloud object storage are not implemented.
5. Browser-print PDF is implemented; byte-identical server-generated legacy PDFs are not.
6. Database integration tests and a manual permission/status transition matrix still require a disposable replica-set database with seeded fixtures. The current database was deliberately not reset or seeded because that would be destructive.
7. Dependency audit previously reported vulnerabilities in the installed dependency tree. Remediation needs a controlled upgrade/regression pass rather than an unreviewed forced audit fix.

## Verification completed

```text
npm run typecheck  -> pass
npm test           -> 18/18 pass
npm run build      -> pass
docker compose config -> pass
npm run check:env  -> correctly rejects the current standalone MongoDB topology
```

The successful build covers every current page and API route. Live login, CRUD, stock mutation, provider delivery, and transaction rollback verification remain environment-dependent and must be run against an authorized disposable replica-set database.
