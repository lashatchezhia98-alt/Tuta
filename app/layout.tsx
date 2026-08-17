import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "თუთა — შენი სხეული. შენი რიტმი.",
  description: "ქართული ციკლისა და ჯანმრთელობის ტრეკერი — პირადი, მშვიდი და შენზე მორგებული.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: { title: "თუთა — შენი სხეული. შენი რიტმი.", description: "ქართული ციკლისა და ჯანმრთელობის ტრეკერი — პირადი, მშვიდი და შენზე მორგებული.", locale: "ka_GE", type: "website", images: [{ url: "/og.png", width: 1728, height: 904, alt: "თუთა — შენი სხეული. შენი რიტმი." }] },
  twitter: { card: "summary_large_image", title: "თუთა — შენი სხეული. შენი რიტმი.", description: "ქართული ციკლისა და ჯანმრთელობის ტრეკერი.", images: ["/og.png"] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ka"><body>{children}</body></html>; }
