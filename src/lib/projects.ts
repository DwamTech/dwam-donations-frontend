import "server-only";
import { cache } from "react";
import { parseProjectDetail, parseProjectPage } from "@/features/projects/data/contract";
import { projectId } from "@/features/projects/data/presentation";
import { backendOrigin } from "@/lib/api/backend";
import { backendProjectParams, type ProjectQuery } from "@/features/projects/data/query";
export const getDonationProjects = cache(async (page = 1, perPage = 9, filters?: ProjectQuery) => {
  try {
    const origin = backendOrigin();
    if (!origin) return { page: null, unavailable: true } as const;
    const params = backendProjectParams({ ...filters, page, sort: filters?.sort ?? "created_at" }, perPage);
    const response = await fetch(`${origin}/api/donation-projects?${params}`, {
      headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("Public projects unavailable");
    return { page: parseProjectPage(await response.json()), unavailable: false } as const;
  } catch {
    return { page: null, unavailable: true } as const;
  }
});

/** React cache memoizes only within the render request; financial fetches remain no-store. */
export const getDonationProject = cache(async (identifier: string) => {
  const id = projectId(identifier);
  if (!id) return { status: "not-found" } as const;
  try {
    const origin = backendOrigin();
    if (!origin) return { status: "unavailable" } as const;
    const response = await fetch(`${origin}/api/donation-projects/${id}`, {
      headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6000),
    });
    if (response.status === 404) return { status: "not-found" } as const;
    if (!response.ok) return { status: "unavailable" } as const;
    const project = parseProjectDetail(await response.json());
    if (String(project.id) !== id) throw new Error("Mismatched project identifier");
    return { status: "ready", project } as const;
  } catch {
    return { status: "unavailable" } as const;
  }
});
