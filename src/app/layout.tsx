import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { site } from "@/lib/config/site";
import "./globals.css";
const arabic = localFont({ src: "../../public/fonts/alexandria.ttf", display: "swap", variable: "--font-arabic", weight: "100 900" });
export const metadata: Metadata = {
  metadataBase: site.origin ? new URL(site.origin) : undefined,
  title: { default: `${site.name} | عطاءٌ يبدأ بك`, template: `%s | ${site.name}` },
  description: site.description,
  openGraph: { type: "website", locale: "ar_EG", siteName: site.name, title: site.name, description: site.description },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" className={arabic.variable}><body><a href="#main" className="skip-link">تجاوز إلى المحتوى</a><SiteHeader /><main id="main" tabIndex={-1}>{children}</main><SiteFooter /></body></html>;
}
