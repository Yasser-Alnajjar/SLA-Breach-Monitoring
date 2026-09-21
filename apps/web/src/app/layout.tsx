import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/providers/session-provider";

const open_Sans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans",
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: `%s | Elapsed`,
    default: "Elapsed",
  },
  description: "Know before your customer does.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={` ${open_Sans.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <SessionProvider>
          <ThemeProvider>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
