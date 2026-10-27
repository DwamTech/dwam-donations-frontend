import { DonorPortal } from "@/features/donors/portal";
export const metadata = { title: "تبرعاتي", robots: { index: false, follow: false } };
export default function ContributionsPage() { return <DonorPortal view="contributions" returnTo="/account/contributions" />; }
