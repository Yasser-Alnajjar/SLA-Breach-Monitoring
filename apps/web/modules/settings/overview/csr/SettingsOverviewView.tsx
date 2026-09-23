"use client";

import { SettingsSectionHeader } from "@/components/settings/section-header";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SETTINGS_NAV_ITEMS } from "@/components/layout/nav-items";

export function SettingsOverviewView() {
  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        eyebrow="Workspace configuration"
        title="All settings"
        description="Manage your workspace configuration."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {SETTINGS_NAV_ITEMS.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="bg-surface-container-low rounded-xl border-0 shadow-sm h-full transition-colors hover:bg-surface-container">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded bg-surface-container-highest text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="space-y-1">
                    <CardTitle className="text-on-surface text-xl font-semibold tracking-tight">
                      {item.label}
                    </CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                    Open
                    <ArrowRight className="size-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
