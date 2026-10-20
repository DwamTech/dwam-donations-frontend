import type { MetadataRoute } from "next";
import { canonical } from "@/lib/config/site";

export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  // Workflow pages must remain crawlable so their noindex directives can be read.
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: canonical("/sitemap.xml") };
}
