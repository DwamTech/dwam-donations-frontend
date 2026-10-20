import { forwardPublicGet } from "@/lib/api/backend";
import { projectId } from "@/features/projects/data/presentation";
export function HEAD() { return new Response(null, { status: 405, headers: { Allow: "GET" } }); }
export async function GET(_: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!projectId(project)) return Response.json({ message: "Not found" }, { status: 404 });
  return forwardPublicGet(`/api/donation-projects/${project}`);
}
