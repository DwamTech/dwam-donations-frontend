import { donationBridge } from "@/lib/api/donation-bridge";
export const runtime = "nodejs";
export async function GET(request: Request) { return donationBridge(request); }
