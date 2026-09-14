"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/layout/ModeToggle";

const humanize = (segment: string) => {
  if (/^[a-f\d]{24}$/i.test(segment)) return "Details";
  return segment.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export default function Topbar({ collapsed, onToggleSidebar, onOpenMobile }: { collapsed: boolean; onToggleSidebar: () => void; onOpenMobile: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const segments = pathname.split("/").filter(Boolean);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setAlerts(data?.alerts?.slice(0, 5) ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 print:hidden">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobile} aria-label="Open navigation"><Menu /></Button>
          <Button type="button" variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleSidebar} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm sm:flex">
            {segments.map((segment, index) => {
              const href = `/${segments.slice(0, index + 1).join("/")}`;
              const last = index === segments.length - 1;
              return (
                <Fragment key={href}>
                  {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  {last ? <span className="truncate font-medium text-foreground">{humanize(segment)}</span> : <Link href={href} className="truncate text-muted-foreground transition-colors hover:text-foreground">{humanize(segment)}</Link>}
                </Fragment>
              );
            })}
          </nav>
        </div>

        <div ref={menuRef} className="relative flex items-center gap-1.5">
          <ModeToggle />
          <div className="relative">
            <Button type="button" variant="ghost" size="icon" className="relative" onClick={() => { setNotificationsOpen((value) => !value); setProfileOpen(false); }} aria-label="Stock notifications">
              <Bell />
              {alerts.length > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-card" />}
            </Button>
            {notificationsOpen && (
              <div className="absolute right-0 top-11 w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl animate-scale-in">
                <div className="flex items-center justify-between border-b px-4 py-3"><div><p className="text-sm font-semibold">Stock alerts</p><p className="text-xs text-muted-foreground">Items that need attention</p></div><span className="badge-danger">{alerts.length}</span></div>
                <div className="max-h-72 overflow-y-auto p-2">
                  {alerts.length ? alerts.map((alert, index) => (
                    <Link key={`${alert.productCode}-${index}`} href="/dashboard/reports/stock-alerts" onClick={() => setNotificationsOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-xs font-semibold text-destructive">{alert.currentQty}</span>
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{alert.productName}</span><span className="block truncate text-xs text-muted-foreground">{alert.productCode} · alert at {alert.alertQty}</span></span>
                    </Link>
                  )) : <p className="px-3 py-8 text-center text-sm text-muted-foreground">No low-stock alerts</p>}
                </div>
              </div>
            )}
          </div>

          <button type="button" onClick={() => { setProfileOpen((value) => !value); setNotificationsOpen(false); }} className="flex h-10 items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-muted" aria-label="Open profile menu">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{user?.name?.[0]?.toUpperCase() ?? "U"}<span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success ring-2 ring-card" /></span>
            <span className="hidden max-w-28 text-left md:block"><span className="block truncate text-xs font-semibold leading-4">{user?.name ?? "User"}</span><span className="block truncate text-[0.68rem] leading-3 text-muted-foreground">{user?.roles?.[0] ?? "Team member"}</span></span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 w-60 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl animate-scale-in">
              <div className="px-2 py-2.5"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div>
              <div className="my-1 h-px bg-border" />
              <Link href="/dashboard/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"><User className="h-4 w-4" /> My account</Link>
              <Link href="/dashboard/settings/system" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"><Settings className="h-4 w-4" /> Settings</Link>
              <div className="my-1 h-px bg-border" />
              <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-destructive hover:bg-destructive/10"><LogOut className="h-4 w-4" /> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
