"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.25, ease: "easeOut" }}>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
    </MotionConfig>
  );
}
