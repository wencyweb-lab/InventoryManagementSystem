import Link from "next/link";

export default function Footer() {
  return (
    <footer className="print:hidden">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-4 text-sm text-muted-foreground sm:px-6">
        <p>© {new Date().getFullYear()} Stocky. Built for dependable inventory operations.</p>
        <div className="hidden items-center gap-5 sm:flex">
          <Link href="/dashboard/profile" className="transition-colors hover:text-foreground">Profile</Link>
          <Link href="/dashboard/settings/system" className="transition-colors hover:text-foreground">Settings</Link>
          <Link href="/dashboard/reports/profit-loss" className="transition-colors hover:text-foreground">Reports</Link>
        </div>
      </div>
    </footer>
  );
}
