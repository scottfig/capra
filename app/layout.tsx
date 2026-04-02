import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Capra",
  description: "Watch an AI agent attempt your task against any product's docs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans bg-zinc-950 text-white antialiased h-full`}
      >
        {children}
      </body>
    </html>
  );
}
