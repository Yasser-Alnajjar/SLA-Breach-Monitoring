import { cn } from "@/lib/utils";
import { BrandLogo } from "./brand-logo";

export function BrandMark({
  className,
  logoClassName,
  hasTitle = true,
}: {
  className?: string;
  logoClassName?: string;
  hasTitle?: boolean;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <BrandLogo className={cn(logoClassName)} />
      {hasTitle && <span className="font-display font-semibold">apsed</span>}
    </div>
  );
}
