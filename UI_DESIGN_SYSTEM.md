# Stocky AdminCN UI system

Stocky's application UI is adapted from the local `shadcn-nextjs-admincn-admin-template-free-1.0.0` source under its MIT license. The inventory domain, routes, permissions, API payloads, and workflows remain Stocky-specific; the visual system and composition follow AdminCN.

## Foundations

- Neutral light and dark themes use CSS variables in `app/globals.css` and persist through `next-themes`.
- The default surface is white/near-black, with compact 10px radii, subtle one-pixel rings, small shadows, muted hover states, and dense typography.
- `components/ui/button.tsx` and `components/ui/card.tsx` are the core primitives. Existing migrated screens also consume compatibility classes such as `form-section`, `form-input`, `button-primary`, `button-outline`, and `data-table-shell`.
- Icons use Lucide. Charts use Recharts and theme variables so they work in both modes.

## Application shell

`DashboardShell` owns responsive navigation state. `Sidebar` provides permission-aware grouped parent/child navigation, desktop compact mode, mobile drawer behavior, active-route state, and service status. `Topbar` provides route-derived breadcrumbs, theme control, live low-stock notifications, profile actions, and sign out. All dashboard routes inherit the same max-width content canvas and footer.

## Screen patterns

- Index screens: `page-header` followed by a `DataTable` or `data-table-shell`.
- Create/edit screens: one or more `form-section` cards with compact labeled controls and right-aligned actions.
- Detail screens: header actions, summary cards, a dense line-item table, totals, communication actions, and payments.
- Reports: date controls, summary metrics, chart cards where aggregation is meaningful, and dense result tables.
- POS: standalone responsive shell using the same header, theme, cards, inputs, dialogs, and receipt treatment.
- Authentication: centered ring card over a neutral geometric decoration, consistent with the template's blank layout.

## Accessibility and behavior

Interactive elements retain visible focus rings, disabled states, labels, keyboard-submit behavior, route-aware navigation, click-outside menus, responsive overlays, and print-specific receipt/document layouts.
