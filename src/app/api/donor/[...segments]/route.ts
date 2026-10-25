import { donorBridge } from '@/lib/api/donor-bridge';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return donorBridge(request); }
export function POST(request: Request) { return donorBridge(request); }
