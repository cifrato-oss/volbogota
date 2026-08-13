import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans, Merriweather } from "next/font/google";

import { siteConfig } from "@/config/site";
import QueryProvider from "@/providers/query-provider";

import "./globals.css";
import { cn } from "@/lib/utils";

const merriweatherHeading = Merriweather({ subsets: ["latin"], variable: "--font-heading" });

const ibmPlexSans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={cn("font-sans", ibmPlexSans.variable, merriweatherHeading.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
