import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/providers/session-provider";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
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
      className={`${hankenGrotesk.variable} ${jetbrainsMono.variable}`}
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
