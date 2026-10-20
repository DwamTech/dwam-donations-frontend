import "server-only";
export function backendOrigin() {
  const value = process.env.DONATIONS_BACKEND_ORIGIN;
  if (!value) return null;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Expected a Backend HTTP origin without credentials or path");
  }
  return url.origin;
}
/** Development bridge only. Production must enforce its own edge allowlist. */
export async function forwardPublicGet(path: string) {
  if (process.env.NODE_ENV !== "development" || process.env.LOCAL_PUBLIC_API_PROXY !== "true") {
    return Response.json({ message: "Not found" }, { status: 404 });
  }
  try {
    const origin = backendOrigin();
    if (!origin) throw new Error("Missing origin");
    const response = await fetch(`${origin}${path}`, {
      headers: { Accept: "application/json" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return Response.json({ message: "Public project request failed" }, { status: response.status === 404 ? 404 : 503 });
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Invalid upstream response");
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Projects temporarily unavailable" }, { status: 503 });
  }
}
