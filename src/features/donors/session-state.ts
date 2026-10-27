export type DonorProfile = { id: number; name: string; email: string };
export type DonorSession =
  | { status: "loading" | "guest" | "expired" | "unavailable"; profile?: never }
  | { status: "authenticated"; profile: DonorProfile };

export async function readDonorSession(request: typeof fetch, expected = false): Promise<DonorSession> {
  try {
    const response = await request("/api/donor/profile", { credentials: "same-origin", cache: "no-store", redirect: "error" });
    if (response.status === 401) return { status: expected ? "expired" : "guest" };
    if (!response.ok) return { status: "unavailable" };
    const { data } = await response.json();
    if (!Number.isSafeInteger(data?.id) || data.id < 1 || typeof data.name !== "string" || typeof data.email !== "string") return { status: "unavailable" };
    return { status: "authenticated", profile: { id: data.id, name: data.name, email: data.email } };
  } catch { return { status: "unavailable" }; }
}

export function accountReturnPath(value?: string): string {
  return value && /^\/account(?:\/(?:projects|receipts|contributions(?:\/[1-9][0-9]{0,18})?|donate\/[1-9][0-9]{0,18}))?$/.test(value) ? value : "/account";
}
