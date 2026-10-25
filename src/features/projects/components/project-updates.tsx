import { backendOrigin } from "@/lib/api/backend";
import { projectDate } from "../data/presentation";
import Link from "next/link";

type Update = { id: number; title: string; body: string; occurred_at: string | null };

/** Read the project's existing published-only feed; never render raw update HTML or storage URLs. */
export async function ProjectUpdates({ id, page = 1 }: { id: number; page?: number }) {
  const origin = backendOrigin();
  if (!origin || !Number.isSafeInteger(id) || id < 1) return null;
  let updates: Update[] = [];
  let lastPage = 1;
  try {
    const response = await fetch(`${origin}/api/donation-projects/${id}/updates?per_page=10&page=${page}`, {
      headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) return null;
    updates = payload.data.filter((item): item is Update =>
      !!item && typeof item === "object" && Number.isSafeInteger(item.id) && typeof item.title === "string" && typeof item.body === "string" && (item.occurred_at === null || typeof item.occurred_at === "string"));
    if ("meta" in payload && payload.meta && typeof payload.meta === "object" && "last_page" in payload.meta && typeof payload.meta.last_page === "number" && Number.isSafeInteger(payload.meta.last_page)) lastPage = payload.meta.last_page;
  } catch { return null; }
  if (!updates.length) return null;
  return <section className="project-description" aria-label="تحديثات المشروع المنشورة"><h2>تحديثات المشروع المنشورة</h2>{updates.map(update => <article key={update.id}><h3>{update.title}</h3>{update.occurred_at && <p>{projectDate(update.occurred_at)}</p>}<p className="description-text">{update.body}</p></article>)}
    {lastPage > 1 && <nav className="pagination" aria-label="صفحات تحديثات المشروع">{page > 1 && <Link href={`/projects/${id}?updates_page=${page - 1}`}>التحديثات السابقة</Link>}{page < lastPage && <Link href={`/projects/${id}?updates_page=${page + 1}`}>المزيد من التحديثات</Link>}</nav>}
  </section>;
}
