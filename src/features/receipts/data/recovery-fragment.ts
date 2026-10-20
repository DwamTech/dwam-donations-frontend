export type FragmentState = "missing" | "invalid" | "ready" | "unavailable";

// The factory issues a token UUID, not a receipt UUID. Never reuse it for download.
export function parseRecoveryFragment(fragment: string): { token_id: string; secret: string } | null {
  if (!fragment.startsWith("#") || fragment.length > 512 || /[\s\x00-\x1f\x7f]/.test(fragment)) return null;
  const parameters = new URLSearchParams(fragment.slice(1));
  if ([...parameters.keys()].length !== 2 || parameters.getAll("token_id").length !== 1 || parameters.getAll("secret").length !== 1) return null;
  const token_id = parameters.get("token_id"), secret = parameters.get("secret");
  if (!token_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token_id) || !secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  return { token_id, secret };
}

