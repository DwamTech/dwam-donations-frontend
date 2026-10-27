import { DonorPortal } from '@/features/donors/portal';
import { accountReturnPath } from '@/features/donors/session-state';
export const metadata = { title: 'حساب المتبرع', robots: { index: false, follow: false } };
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { return <DonorPortal returnTo={accountReturnPath((await searchParams).next)} />; }
