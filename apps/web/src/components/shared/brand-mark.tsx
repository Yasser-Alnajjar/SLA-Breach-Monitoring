import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Gauge className="size-4.5" strokeWidth={2.25} />
      </span>

      <span className="font-display text-base font-medium leading-none tracking-tight">
        SLA Breach Monitoring
      </span>
    </div>
  );
}
