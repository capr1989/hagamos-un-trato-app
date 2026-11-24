'use client';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';

const origin = 'http://127.0.0.1:3000';
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true, flowType: 'implicit' as const };

export default function RecoveryForm() {
  const [hasRecoveryLink] = useState(() => typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery' || new URLSearchParams(window.location.search).get('type') === 'recovery'));
  const [auth] = useState(() => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: authOptions }));
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<'checking' | 'challenge' | 'password'>('checking');
  const [factors, setFactors] = useState<{ id: string; friendly_name?: string }[]>([]);
  const [selectedFactor, setSelectedFactor] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!hasRecoveryLink) return;
    const { data: { subscription } } = auth.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setReady(true);
        setMessage('');
        window.history.replaceState(null, '', '/internal/qa/recover');
      }
    });
    void auth.auth.getSession().then(({ data, error }) => {
      if (!error && data.session) {
        setReady(true);
        setMessage('');
        window.history.replaceState(null, '', '/internal/qa/recover');
      } else setMessage('El enlace de recuperación no es válido o venció. Solicita uno nuevo.');
    });
    return () => subscription.unsubscribe();
  }, [auth, hasRecoveryLink]);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const assurance = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || !assurance.data?.currentLevel) { setMessage('No se pudo comprobar el nivel de autenticación. Solicita un enlace nuevo.'); return; }
      if (assurance.data.currentLevel === 'aal2' || assurance.data.nextLevel !== 'aal2') { setStep('password'); return; }
      const listed = await auth.auth.mfa.listFactors();
      if (listed.error || !listed.data?.totp.length) { setMessage('No se pudo consultar el autenticador TOTP. Solicita un enlace nuevo.'); return; }
      const available = listed.data.totp.map(factor => ({ id: factor.id, friendly_name: factor.friendly_name }));
      setFactors(available);
      setSelectedFactor(available[0].id);
      setStep('challenge');
    })();
  }, [auth, ready]);

  async function verifyFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const code = String(new FormData(form).get('code') || '');
    if (!/^\d{6}$/.test(code) || !factors.some(factor => factor.id === selectedFactor)) { setMessage('Código o autenticador inválido.'); return; }
    setBusy(true); setMessage('');
    try {
      const verified = await auth.auth.mfa.challengeAndVerify({ factorId: selectedFactor, code });
      if (verified.error) throw verified.error;
      const assurance = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data?.currentLevel !== 'aal2') throw new Error('AAL2 unavailable');
      form.reset();
      setStep('password');
    } catch { setMessage('No se pudo verificar el código TOTP. Espera el siguiente código e inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }

  async function requestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (window.location.origin !== origin) { setMessage('Abre el panel en 127.0.0.1:3000.'); return; }
    const email = String(new FormData(event.currentTarget).get('email') || '').trim();
    setBusy(true); setMessage('');
    try {
      const { error } = await auth.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/internal/qa/recover` });
      if (error) throw error;
      setMessage('Si la cuenta existe, Supabase enviará un enlace. Ábrelo en este mismo navegador y equipo.');
    } catch { setMessage('No se pudo solicitar el correo. Revisa la configuración de Auth y vuelve a intentarlo más tarde.'); }
    finally { setBusy(false); }
  }

  async function setPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== 'password') return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get('password') || '');
    if (password.length < 12 || password.length > 128 || password !== values.get('repeat')) { setMessage('La contraseña debe tener 12–128 caracteres y coincidir en ambos campos.'); return; }
    setBusy(true); setMessage('');
    try {
      const { error } = await auth.auth.updateUser({ password });
      if (error) throw error;
      form.reset();
      await auth.auth.signOut({ scope: 'local' });
      setReady(false); setDone(true);
      setMessage('Contraseña actualizada. Inicia sesión y completa el desafío TOTP.');
    } catch { setMessage('Supabase no aceptó el cambio. Comprueba la política de contraseñas o solicita otro enlace.'); }
    finally { setBusy(false); }
  }

  return <main className="qa"><section><h1>Recuperar acceso a HUT QA</h1>
    <p>Solo Supabase Dev. Tu factor TOTP y tu rol no se modifican.</p>
    {done ? <p><a href="/internal/qa">Volver a iniciar sesión</a></p> : ready && step === 'password' ?
      <form onSubmit={setPassword} className="fields"><h2>Elige una contraseña nueva</h2>
        <label>Nueva contraseña<input type="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" required/></label>
        <label>Repite la contraseña<input type="password" name="repeat" minLength={12} maxLength={128} autoComplete="new-password" required/></label>
        <button disabled={busy}>Actualizar contraseña</button></form> : ready && step === 'challenge' ?
      <form onSubmit={verifyFactor} className="fields"><h2>Verifica tu autenticador TOTP</h2>
        {factors.length > 1 && <label>Autenticador<select value={selectedFactor} onChange={event => setSelectedFactor(event.target.value)}>{factors.map(factor => <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Autenticador TOTP'}</option>)}</select></label>}
        <label>Código de seis dígitos<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required/></label>
        <button disabled={busy}>Verificar código</button></form> : hasRecoveryLink ?
      <p>Comprobando el enlace de recuperación…</p> :
      <form onSubmit={requestEmail} className="fields"><h2>Solicitar enlace</h2>
        <label>Correo de tu cuenta interna<input type="email" name="email" autoComplete="email" required maxLength={254}/></label>
        <button disabled={busy}>Enviar enlace de recuperación</button></form>}
    {message && <p role="status">{message}</p>}
    <p><a href="/internal/qa">Volver al panel</a></p>
  </section></main>;
}
