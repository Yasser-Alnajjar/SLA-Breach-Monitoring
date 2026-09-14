import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SlaAutoRefreshProvider } from "@/components/shared/SlaAutoRefreshProvider";
import { SessionProvider } from "@/providers/session-provider";
import { Actions } from "@/actions";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fontDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SLA Breach Monitoring",
  description: "Know before your customer does.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const data = await Actions.WorkerSettings.getData();
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontDisplay.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <SessionProvider>
          <ThemeProvider>
            <SlaAutoRefreshProvider
              initInterval={data.activePollIntervalMs - 2000}
            />
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
