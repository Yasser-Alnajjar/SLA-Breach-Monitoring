"use client";

import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // `theme` isn't known until next-themes reads localStorage on mount — avoid
  // rendering a selection that flips right after hydration.
  useEffect(() => setMounted(true), []);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
            <Palette className="size-4" />
          </span>
          <div>
            <CardTitle className="text-sm font-semibold">Appearance</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose how SLA Watchtower looks on this device.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-5 py-5">
        {mounted ? (
          <RadioGroup
            value={theme}
            onValueChange={setTheme}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const isActive = theme === value;
              return (
                <Label
                  key={value}
                  htmlFor={`theme-${value}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:bg-interactive/40",
                  )}
                >
                  <RadioGroupItem
                    className={cn(
                      "cursor-pointer",
                      isActive
                        ? "border-primary bg-primary! text-foreground"
                        : "border-border text-muted-foreground hover:bg-interactive/40",
                    )}
                    value={value}
                    id={`theme-${value}`}
                  />
                  <Icon className="size-4" />
                  {label}
                </Label>
              );
            })}
          </RadioGroup>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {THEME_OPTIONS.map(({ value }) => (
              <Skeleton key={value} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
