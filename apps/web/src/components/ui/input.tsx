"use client";
import { cn } from "@/lib/utils";
import * as React from "react";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full min-w-0 text-xs rounded-md border border-input bg-background px-3 py-2 transition-colors ring-offset-background file:border-0 file:bg-transparent file:inline-flex file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-xs",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
