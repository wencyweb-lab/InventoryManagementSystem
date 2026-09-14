import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <svg viewBox="0 0 40 40" aria-hidden="true" className="h-9 w-9 shrink-0">
        <rect width="40" height="40" rx="20" className="fill-foreground" />
        <path d="M20 8v8a4 4 0 0 1-4 4H8m12 12v-8a4 4 0 0 1 4-4h8M29 11l-5 5M16 24l-5 5M11 11l5 5M29 29l-5-5" className="stroke-background" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-5 tracking-tight">Stocky</p>
          <p className="truncate text-[0.68rem] text-muted-foreground">Inventory workspace</p>
        </div>
      )}
    </div>
  );
}
