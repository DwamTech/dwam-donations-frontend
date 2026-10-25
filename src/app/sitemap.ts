import type { MetadataRoute } from "next";
import { site } from "@/lib/config/site";
import { getDonationProjects } from "@/lib/projects";
import { sitemapEntries } from "@/lib/sitemap";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!site.origin) return [];
  // One public read, at most 100 publicly visible IDs, six-second timeout, no build fetch.
  const { page } = await getDonationProjects(1, 100, { page: 1, sort: "created_at", state: "all" });
  return sitemapEntries(site.origin, page);
}
