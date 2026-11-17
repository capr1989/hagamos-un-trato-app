import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import { QaError, qaConfig, assertLocalRequest } from './policy';

export type Identity = { user: { id: string; email: string | null }; role: 'admin' | 'editor' | null };
const accessName = 'hut-qa-access';
const refreshName = 'hut-qa-refresh';
const options = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
export function publicClient() {
  const config = qaConfig(process.env);
  return createClient(config.url, config.key, { auth: options });
}
export function checkRequest(request: Request, mutation = false) {
  const config = qaConfig(process.env);
  assertLocalRequest(request.headers.get('host'), request.headers.get('origin'), config.origin, mutation);
  return config;
}
export async function setSessionCookies(session: Session) {
  const jar = await cookies();
  const secure = qaConfig(process.env).origin.startsWith('https:');
  const common = { httpOnly: true, secure, sameSite: 'strict' as const, path: '/internal/qa' };
  jar.set(accessName, session.access_token, { ...common, maxAge: session.expires_in || 3600 });
  jar.set(refreshName, session.refresh_token, { ...common, maxAge: 60 * 60 * 24 * 30 });
}
export async function clearSessionCookies() {
  const jar = await cookies();
  for (const name of [accessName, refreshName]) jar.set(name, '', { httpOnly: true, sameSite: 'strict', path: '/internal/qa', maxAge: 0 });
}
export async function closeAuthSession() {
  const jar = await cookies();
  const access = jar.get(accessName)?.value;
  const refresh = jar.get(refreshName)?.value;
  let revoked = false;
  try {
    if (access && refresh) {
      const client = publicClient();
      const established = await client.auth.setSession({access_token:access,refresh_token:refresh});
      if (!established.error) revoked = !(await client.auth.signOut({scope:'local'})).error;
    }
  } catch { revoked = false; }
  finally { await clearSessionCookies(); }
  return revoked;
}
export async function sessionContext(refresh = true) {
  const config = qaConfig(process.env);
  const jar = await cookies();
  let token = jar.get(accessName)?.value;
  const refreshToken = jar.get(refreshName)?.value;
  const auth = publicClient();
  let verified = token ? await auth.auth.getUser(token) : null;
  if ((!verified?.data.user || verified.error) && refresh && refreshToken) {
    const result = await auth.auth.refreshSession({ refresh_token: refreshToken });
    if (result.data.session && !result.error) {
      token = result.data.session.access_token;
      await setSessionCookies(result.data.session);
      verified = await auth.auth.getUser(token);
    }
  }
  const user = verified?.data.user;
  if (!token || !user || verified?.error) return null;
  const client = createClient(config.url, config.key, { auth: options, global: { headers: { Authorization: `Bearer ${token}` } } });
  const context = await client.rpc('qa_staff_context');
  if (context.error) throw new QaError('No se pudo comprobar el rol HUT. Verifica la migración QA y la Data API.', 503);
  const role = ['admin','editor'].includes(context.data?.role) ? context.data.role as 'admin' | 'editor' : null;
  return { client, identity: { user: { id: user.id, email: user.email || null }, role } satisfies Identity };
}
export async function requireStaff(admin = false) {
  const session = await sessionContext();
  if (!session) throw new QaError('Inicia sesión.', 401);
  if (!session.identity.role || (admin && session.identity.role !== 'admin')) throw new QaError(admin ? 'Se requiere administrador.' : 'Esta cuenta no tiene un rol HUT activo.', 403);
  return session;
}
export function operatorClient() {
  const config = qaConfig(process.env);
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || key.includes('REPLACE_ME')) throw new QaError('La creación de usuarios requiere SUPABASE_SECRET_KEY solo en el servidor. Habilitar un UUID existente no necesita esa clave.', 503);
  return createClient(config.url, key, { auth: options });
}
const attempts = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  if (attempts.size > 1000) for (const [id, value] of attempts) if (value.reset < now) attempts.delete(id);
  const value = attempts.get(key);
  if (!value || value.reset < now) { attempts.set(key, { count: 1, reset: now + windowMs }); return; }
  if (++value.count > maximum) throw new QaError('Demasiados intentos. Espera unos minutos.', 429);
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new QaError('Se requiere JSON.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new QaError('Falta el cuerpo.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 32000) { await reader.cancel(); throw new QaError('Solicitud demasiado grande.', 413); }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new QaError('JSON inválido.'); }
}
