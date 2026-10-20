import type { MetadataRoute } from "next";
import type { ProjectPage } from "@/features/projects/types/project";

/** A bounded discovery seed, never an exhaustive or static project catalog. */
export function sitemapEntries(origin: string | undefined, page: ProjectPage | null): MetadataRoute.Sitemap {
  if (!origin) return [];
  const paths = new Set(["/", "/projects"]);
  for (const project of page?.data.slice(0, 100) ?? []) {
    if (Number.isSafeInteger(project.id) && project.id > 0) paths.add(`/projects/${project.id}`);
  }
  return [...paths].map(path => ({ url: new URL(path, origin).toString() }));
}
