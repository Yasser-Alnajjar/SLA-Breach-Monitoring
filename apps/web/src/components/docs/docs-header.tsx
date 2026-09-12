import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function DocsHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-semibold">Documentation</span>

        <span className="hidden text-sm text-muted-foreground sm:inline">
          SLA Breach Monitoring
        </span>
      </div>
    </header>
  );
}
