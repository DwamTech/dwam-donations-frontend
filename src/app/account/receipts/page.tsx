import { DonorPortal } from "@/features/donors/portal";
export const metadata = { title: "إيصالاتي", robots: { index: false, follow: false } };
export default function ReceiptsPage() { return <DonorPortal view="receipts" returnTo="/account/receipts" />; }
