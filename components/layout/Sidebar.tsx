"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Package,
  ReceiptText,
  RotateCcw,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tag,
  Truck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  permission?: string;
  children?: NavItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      {
        label: "Point of Sale",
        href: "/pos",
        icon: Store,
        permission: "Pos_view",
      },
    ],
  },
  {
    label: "Inventory & Orders",
    items: [
      {
        label: "Products",
        icon: Package,
        children: [
          {
            label: "All products",
            href: "/dashboard/products",
            icon: Package,
            permission: "products_view",
          },
          {
            label: "Print barcodes",
            href: "/dashboard/products/barcode",
            icon: Tag,
            permission: "barcode_view",
          },
        ],
      },
      {
        label: "Purchases",
        icon: ShoppingCart,
        children: [
          {
            label: "All purchases",
            href: "/dashboard/purchases",
            icon: ShoppingCart,
            permission: "Purchases_view",
          },
          {
            label: "Purchase returns",
            href: "/dashboard/purchase-returns",
            icon: RotateCcw,
            permission: "Purchase_Returns_view",
          },
        ],
      },
      {
        label: "Sales",
        icon: ReceiptText,
        children: [
          {
            label: "All sales",
            href: "/dashboard/sales",
            icon: ReceiptText,
            permission: "Sales_view",
          },
          {
            label: "Quotations",
            href: "/dashboard/quotations",
            icon: ClipboardList,
            permission: "Quotations_view",
          },
          {
            label: "Sale returns",
            href: "/dashboard/sale-returns",
            icon: RotateCcw,
            permission: "Sale_Returns_view",
          },
        ],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Transfers",
        href: "/dashboard/transfers",
        icon: ArrowLeftRight,
        permission: "transfer_view",
      },
      {
        label: "Adjustments",
        href: "/dashboard/adjustments",
        icon: SlidersHorizontal,
        permission: "adjustment_view",
      },
      {
        label: "Expenses",
        icon: CircleDollarSign,
        children: [
          {
            label: "All expenses",
            href: "/dashboard/expenses",
            icon: CircleDollarSign,
            permission: "expense_view",
          },
          {
            label: "Categories",
            href: "/dashboard/expenses/categories",
            icon: Tag,
            permission: "expense_view",
          },
        ],
      },
      {
        label: "People",
        icon: Users,
        children: [
          {
            label: "Customers",
            href: "/dashboard/people/customers",
            icon: Users,
            permission: "Customers_view",
          },
          {
            label: "Suppliers",
            href: "/dashboard/people/suppliers",
            icon: Truck,
            permission: "Suppliers_view",
          },
          {
            label: "Users",
            href: "/dashboard/people/users",
            icon: Users,
            permission: "users_view",
          },
        ],
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        label: "Reports",
        icon: BarChart3,
        children: [
          {
            label: "Profit & loss",
            href: "/dashboard/reports/profit-loss",
            icon: BarChart3,
            permission: "Reports_profit",
          },
          {
            label: "Sales",
            href: "/dashboard/reports/sales",
            icon: ReceiptText,
            permission: "Reports_sales",
          },
          {
            label: "Purchases",
            href: "/dashboard/reports/purchases",
            icon: ShoppingCart,
            permission: "Reports_purchase",
          },
          {
            label: "Sales payments",
            href: "/dashboard/reports/payments-sales",
            icon: CreditCard,
            permission: "Reports_payments_Sales",
          },
          {
            label: "Purchase payments",
            href: "/dashboard/reports/payments-purchases",
            icon: CreditCard,
            permission: "Reports_payments_Purchases",
          },
          {
            label: "Sale return payments",
            href: "/dashboard/reports/payments-sale-returns",
            icon: CreditCard,
            permission: "Reports_payments_Sale_Returns",
          },
          {
            label: "Purchase return payments",
            href: "/dashboard/reports/payments-purchase-returns",
            icon: CreditCard,
            permission: "Reports_payments_purchase_Return",
          },
          {
            label: "Customers",
            href: "/dashboard/reports/customers",
            icon: Users,
            permission: "Reports_customers",
          },
          {
            label: "Suppliers",
            href: "/dashboard/reports/suppliers",
            icon: Truck,
            permission: "Reports_suppliers",
          },
          {
            label: "Warehouses",
            href: "/dashboard/reports/warehouse",
            icon: Building2,
            permission: "Warehouse_report",
          },
          {
            label: "Stock alerts",
            href: "/dashboard/reports/stock-alerts",
            icon: Package,
            permission: "Reports_quantity_alerts",
          },
        ],
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Settings",
        icon: Settings,
        children: [
          {
            label: "System",
            href: "/dashboard/settings/system",
            icon: Settings,
            permission: "setting_system",
          },
          {
            label: "Roles & permissions",
            href: "/dashboard/settings/roles",
            icon: Users,
            permission: "permissions_view",
          },
          {
            label: "Categories",
            href: "/dashboard/settings/categories",
            icon: Tag,
            permission: "category",
          },
          {
            label: "Brands",
            href: "/dashboard/settings/brands",
            icon: Tag,
            permission: "brand",
          },
          {
            label: "Units",
            href: "/dashboard/settings/units",
            icon: SlidersHorizontal,
            permission: "unit",
          },
          {
            label: "Currencies",
            href: "/dashboard/settings/currencies",
            icon: CircleDollarSign,
            permission: "currency",
          },
          {
            label: "Warehouses",
            href: "/dashboard/settings/warehouses",
            icon: Building2,
            permission: "warehouse",
          },
          {
            label: "POS settings",
            href: "/dashboard/settings/pos-settings",
            icon: Store,
            permission: "setting_system",
          },
          {
            label: "SMTP",
            href: "/dashboard/settings/smtp",
            icon: Settings,
            permission: "setting_system",
          },
          {
            label: "Payment gateway",
            href: "/dashboard/settings/payment-gateway",
            icon: CreditCard,
            permission: "setting_system",
          },
          {
            label: "SMS",
            href: "/dashboard/settings/sms",
            icon: MessageSquare,
            permission: "setting_system",
          },
          {
            label: "Backup",
            href: "/dashboard/settings/backup",
            icon: Package,
            permission: "backup",
          },
        ],
      },
    ],
  },
];

function NavEntry({
  item,
  collapsed,
  permissions,
  onNavigate,
  onExpand,
}: {
  item: NavItem;
  collapsed: boolean;
  permissions: string[];
  onNavigate: () => void;
  onExpand: () => void;
}) {
  const pathname = usePathname();
  const visibleChildren = item.children?.filter(
    (child) => !child.permission || permissions.includes(child.permission),
  );
  const childActive =
    visibleChildren?.some(
      (child) =>
        child.href &&
        (pathname === child.href || pathname.startsWith(`${child.href}/`)),
    ) ?? false;
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (item.permission && !permissions.includes(item.permission)) return null;
  if (item.children && !visibleChildren?.length) return null;

  if (visibleChildren) {
    return (
      <div>
        <button
          type="button"
          title={collapsed ? item.label : undefined}
          onClick={() => {
            if (collapsed) onExpand();
            else setOpen((value) => !value);
          }}
          className={cn(
            "sidebar-link w-full",
            (open || childActive) &&
              "bg-sidebar-accent/70 text-sidebar-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-left">
              {item.label}
            </span>
          )}
          {!collapsed && (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                open && "rotate-90",
              )}
            />
          )}
        </button>
        {!collapsed && open && (
          <div className="ml-4 mt-1 space-y-0.5 border-l pl-3">
            {visibleChildren.map((child) => (
              <NavEntry
                key={child.href ?? child.label}
                item={child}
                collapsed={false}
                permissions={permissions}
                onNavigate={onNavigate}
                onExpand={onExpand}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
  return (
    <Link
      href={item.href!}
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
      className={cn(
        "sidebar-link",
        active && "active",
        collapsed && "justify-center px-0",
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
    </Link>
  );
}

export default function Sidebar({
  collapsed,
  mobileOpen,
  onNavigate,
  onExpand,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: () => void;
  onExpand: () => void;
}) {
  const { data: session } = useSession();
  const permissions = ((session?.user as any)?.permissions as string[]) ?? [];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 print:hidden lg:sticky lg:top-0",
        collapsed ? "lg:w-[72px]" : "lg:w-64",
        mobileOpen
          ? "w-72 translate-x-0"
          : "w-72 -translate-x-full lg:translate-x-0",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border px-4",
          collapsed ? "lg:justify-center lg:px-2" : "justify-between",
        )}
      >
        <Logo compact={collapsed} />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onNavigate}
          aria-label="Close navigation"
        >
          <X />
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && <p className="sidebar-section">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavEntry
                  key={item.label}
                  item={item}
                  collapsed={collapsed}
                  permissions={permissions}
                  onNavigate={onNavigate}
                  onExpand={onExpand}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div
        className={cn(
          "border-t border-sidebar-border p-3",
          collapsed && "lg:px-2",
        )}
      >
        <div
          className={cn(
            "rounded-lg bg-sidebar-accent/70 p-3",
            collapsed && "lg:p-2",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2",
              collapsed && "lg:justify-center",
            )}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {!collapsed && (
              <span className="text-xs font-medium">
                Inventory services online
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
