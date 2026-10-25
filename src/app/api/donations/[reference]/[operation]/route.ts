import { donationBridge } from "@/lib/api/donation-bridge";
export const runtime = "nodejs";
export async function POST(request: Request) { return donationBridge(request); }
