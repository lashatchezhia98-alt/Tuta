import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "TUTA | შენი სხეული. შენი რიტმი.",
  description: "ქართული ციკლისა და ჯანმრთელობის ტრეკერი. პირადი, მშვიდი და შენზე მორგებული.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title: "TUTA | შენი სხეული. შენი რიტმი.", description: "ქართული ციკლისა და ჯანმრთელობის ტრეკერი. პირადი, მშვიდი და შენზე მორგებული.", locale: "ka_GE", type: "website", images: [{ url: "/og.png", width: 1728, height: 904, alt: "TUTA | შენი სხეული. შენი რიტმი." }] },
  twitter: { card: "summary_large_image", title: "TUTA | შენი სხეული. შენი რიტმი.", description: "ქართული ციკლისა და ჯანმრთელობის ტრეკერი.", images: ["/og.png"] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ka" className={cn("font-sans", geist.variable)}><body>{children}</body></html>; }
