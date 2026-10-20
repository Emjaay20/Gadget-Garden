import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MotionProvider } from "@/components/motion/motion-provider";
import { AiAssistantDrawer } from "@/components/shop/ai-assistant-drawer";
import { CompareDrawer } from "@/components/shop/compare-drawer";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/lib/cart-store";

import "./globals.css";

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
    default: "Gadgets Garden — Premium laptops you can trust",
    template: "%s · Gadgets Garden",
  },
  description:
    "Premium new and foreign-used laptops in Lagos. Warranty on every item, nationwide delivery, and secure payment before dispatch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      /*
        `data-scroll-behavior="smooth"` is required from Next 16: the framework
        no longer overrides a global `scroll-behavior: smooth` during route
        transitions unless asked, which otherwise makes every navigation
        smooth-scroll to the top instead of landing there instantly.
      */
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/*
          CartProvider wraps everything: the header's badge and the cart page
          read the same store, and it must survive navigation between them.
        */}
        <CartProvider>
          <MotionProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <AiAssistantDrawer />
            <CompareDrawer />
          </MotionProvider>
        </CartProvider>
        <Toaster />
      </body>
    </html>
  );
}
