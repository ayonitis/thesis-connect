import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "./fonts/inter-cyrillic-ext.woff2" },
    { path: "./fonts/inter-cyrillic.woff2" },
    { path: "./fonts/inter-greek-ext.woff2" },
    { path: "./fonts/inter-greek.woff2" },
    { path: "./fonts/inter-vietnamese.woff2" },
    { path: "./fonts/inter-latin-ext.woff2" },
    { path: "./fonts/inter-latin.woff2" },
  ],
  weight: "100 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: "Arial",
  variable: "--font-inter",
});

const sourceSerif = localFont({
  src: [
    { path: "./fonts/source-serif-4-cyrillic-ext.woff2" },
    { path: "./fonts/source-serif-4-cyrillic.woff2" },
    { path: "./fonts/source-serif-4-greek.woff2" },
    { path: "./fonts/source-serif-4-vietnamese.woff2" },
    { path: "./fonts/source-serif-4-latin-ext.woff2" },
    { path: "./fonts/source-serif-4-latin.woff2" },
  ],
  weight: "200 900",
  style: "normal",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "Thesis Connect",
  description: "Find thesis partners and explore supervisor reviews.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sourceSerif.variable} bg-[#FFFFFF] text-[#191C21] antialiased`}>
        <div className="tc-app-background">{children}</div>
      </body>
    </html>
  );
}
