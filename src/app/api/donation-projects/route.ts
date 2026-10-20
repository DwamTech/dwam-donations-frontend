import { forwardPublicGet } from "@/lib/api/backend";
import { backendProjectParams, parseProjectQuery, searchValues } from "@/features/projects/data/query";
export function HEAD() { return new Response(null, { status: 405, headers: { Allow: "GET" } }); }
export function GET(request: Request) {
  const incoming = new URL(request.url);
  const values = searchValues(incoming.searchParams);
  const perPage = typeof values.per_page === "string" && /^\d{1,3}$/.test(values.per_page) ? Number(values.per_page) : 15;
  const params = backendProjectParams(parseProjectQuery(values), perPage);
  return forwardPublicGet(`/api/donation-projects?${params}`);
}
