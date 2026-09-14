import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({ title, value, caption, icon: Icon, tone = "default" }: { title: string; value: string; caption: string; icon: LucideIcon; tone?: "default" | "success" | "warning" | "danger" }) {
  const tones = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="gap-4 transition-colors hover:bg-muted/20">
      <CardHeader className="flex-row items-center gap-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-sm", tones[tone])}><Icon className="h-4 w-4" /></span>
        <span className="text-2xl font-normal tracking-tight">{value}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{caption}</span>
      </CardContent>
    </Card>
  );
}
