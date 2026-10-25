import { notFound } from 'next/navigation';
import { DonorDetails } from '@/features/donors/portal';
export const metadata = { title: 'تفاصيل التبرع', robots: { index: false, follow: false } };
export default async function ContributionPage({ params }: { params: Promise<{ donation: string }> }) {
  const { donation } = await params;
  if (!/^[1-9][0-9]{0,18}$/.test(donation)) notFound();
  return <DonorDetails id={donation} />;
}
