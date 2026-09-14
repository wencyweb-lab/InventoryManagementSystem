# Migration completion plan and evidence

The July audit is historical, not a current parity certification. Compare owned Laravel controllers, routes, Vue views, SQL/import scripts and Next.js behavior. Do not equate compiling pages with verified workflows.

1. Repair shared correctness: asynchronous route parameters, atomic writes, request validation, password recovery and session revocation.
2. Audit commercial operations: document references, status transitions, unit conversions, stock precision, bulk deletion and payment lifecycle.
3. Close report gaps: customer/supplier payment activity, warehouse activity and valuation, report loading/error behavior.
4. Compare remaining capabilities: card payments, communications/PDF attachments, localization, imports/assets, exports and legacy navigation.
5. Verify with unit tests, TypeScript, production build and a separate local MongoDB replica set. Never seed or reset the configured application database.
6. Update the audit with measured results and explicit remaining gaps. Full parity requires runtime workflow evidence, provider tests and language/document comparison.

## Findings recorded during this pass

- Public recovery endpoint disclosed usable reset links on email failure; tokens were plaintext and expiry relied on TTL deletion.
- Transaction helper replaced commit/abort with no-ops on standalone MongoDB.
- Shared API handlers read unresolved Next.js 16 route parameters.
- Product bulk deletion bypassed the nonzero-stock protection used by single deletion.
- Commercial deletion left payments active in reports.
- Pending documents could reference missing entities because validation only occurred during stock effects.
- Customer/supplier detail reports omit legacy payment activity; warehouse report omits commercial activity.
- Payment gateway settings exist but charge/refund orchestration does not.
- Legacy localization is absent. Browser print does not establish PDF/attachment parity.

Verification results will be recorded in MIGRATION_AUDIT.md after the checks complete.
