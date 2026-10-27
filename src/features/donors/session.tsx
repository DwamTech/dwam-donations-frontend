"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { readDonorSession, type DonorProfile, type DonorSession } from "./session-state";

type SessionContext = { session: DonorSession; refresh: () => Promise<DonorSession>; signedIn: (profile: DonorProfile) => void; signedOut: () => void };
const Context = createContext<SessionContext | null>(null);
// A navigation hint only; it never grants identity or API authority. The credential stays HttpOnly.
const hint = "donor-session-expected";
function remember(value: boolean) { try { if (value) sessionStorage.setItem(hint, "1"); else sessionStorage.removeItem(hint); } catch {} }
export function DonorSessionProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [session, setSession] = useState<DonorSession>({ status: enabled ? "loading" : "guest" });
  const expected = useRef(false);
  const sequence = useRef(0);
  const invalidate = useCallback(() => { sequence.current++; }, []);
  const signedIn = useCallback((profile: DonorProfile) => { sequence.current++; expected.current = true; remember(true); setSession({ status: "authenticated", profile }); }, []);
  const signedOut = useCallback(() => { sequence.current++; expected.current = false; remember(false); setSession({ status: "guest" }); }, []);
  const refresh = useCallback(async () => {
    if (!enabled) return { status: "guest" } as const;
    const run = ++sequence.current;
    const result = await readDonorSession(fetch, expected.current);
    if (run === sequence.current) {
      if (result.status === "authenticated") { expected.current = true; remember(true); }
      setSession(result);
    }
    return result;
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    try { expected.current = sessionStorage.getItem(hint) === "1"; } catch {}
    void refresh();
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => { invalidate(); window.removeEventListener("focus", focus); };
  }, [refresh, enabled, invalidate]);
  return <Context.Provider value={{ session, refresh, signedIn, signedOut }}>{children}</Context.Provider>;
}
export function useDonorSession() {
  const value = useContext(Context);
  if (!value) throw new Error("DonorSessionProvider required");
  return value;
}
