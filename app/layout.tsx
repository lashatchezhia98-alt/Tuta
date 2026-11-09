import type { Metadata } from "next";
import "./globals.css";
import "./workspace.css";
import "./copy-editor.css";
import { SiteCopyProvider } from "@/components/site-copy-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tutahealth.ge"),
  title: "TUTA | შენი სხეული. შენი რიტმი.",
  description: "ქართული ციკლისა და ჯანმრთელობის ტრეკერი. პირადი, მშვიდი და შენზე მორგებული.",
  icons: { icon: "/tuta-icon.png?v=2", shortcut: "/tuta-icon.png?v=2", apple: "/tuta-icon.png?v=2" },
  openGraph: { title: "TUTA | შენი სხეული. შენი რიტმი.", description: "ქართული ციკლისა და ჯანმრთელობის ტრეკერი. პირადი, მშვიდი და შენზე მორგებული.", locale: "ka_GE", type: "website", images: [{ url: "/tuta-icon.png", width: 1024, height: 1024, alt: "TUTA | შენი სხეული. შენი რიტმი." }] },
  twitter: { card: "summary", title: "TUTA | შენი სხეული. შენი რიტმი.", description: "ქართული ციკლისა და ჯანმრთელობის ტრეკერი.", images: ["/tuta-icon.png"] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ka"><body><SiteCopyProvider>{children}</SiteCopyProvider></body></html>; }
