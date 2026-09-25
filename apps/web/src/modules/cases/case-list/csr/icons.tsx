import {
  ArrowLeftRight,
  BadgeCheck,
  CircleCheck,
  CircleUser,
  Hourglass,
  Inbox,
  Sparkles,
  Timer,
  TriangleAlert,
  UserX,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const MS_ICONS: Record<string, LucideIcon> = {
  sync_alt: ArrowLeftRight,
  inbox: Inbox,
  verified: BadgeCheck,
  pattern: Sparkles,
  warning: TriangleAlert,
  task_alt: CircleCheck,
  timer: Timer,
  hourglass_bottom: Hourglass,
  account_circle: CircleUser,
  person_off: UserX,
};

export function Ms({ name, className }: { name: string; className?: string }) {
  const Icon = MS_ICONS[name] ?? Timer;

  return <Icon aria-hidden className={cn("shrink-0", className)} />;
}
