import { notFound } from 'next/navigation';
import { qaConfig, QaError } from '@/lib/qa/policy';
import { sessionContext } from '@/lib/qa/server';
import QaPanel from './panel';
import './qa.css';
export const dynamic = 'force-dynamic';
export const metadata = { title:'HUT · QA interno', robots:{ index:false,follow:false } };
export default async function QaPage() {
  try {
    qaConfig(process.env);
    const session = await sessionContext(false);
    return <QaPanel initialIdentity={session?.identity || null} />;
  } catch (error) {
    if (error instanceof QaError && error.status === 404) notFound();
    return <main className="qa"><h1>HUT · QA interno</h1><p role="alert">{error instanceof QaError ? error.message : 'No se pudo inicializar el panel.'}</p><p>Revisa .env.local y docs/QA-PANEL.md.</p></main>;
  }
}
