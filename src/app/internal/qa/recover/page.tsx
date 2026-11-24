import { notFound } from 'next/navigation';
import { qaConfig, QaError } from '@/lib/qa/policy';
import RecoveryForm from './recovery-form';
import '../qa.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recuperar acceso · HUT QA', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

export default function RecoveryPage() {
  try { qaConfig(process.env); }
  catch (error) { if (error instanceof QaError && error.status === 404) notFound(); throw error; }
  return <RecoveryForm />;
}
