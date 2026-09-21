import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";

export function BrandMark({
  className,
  logoClassName,
}: {
  className?: string;
  logoClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandLogo className={cn(logoClassName)} />
      <span className="font-display text-base font-medium leading-none tracking-tight">
        Elapsed
      </span>
    </div>
  );
}
