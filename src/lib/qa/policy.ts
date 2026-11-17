export const HUT_PROJECT = 'lewlduoqmsdnmxfichus';
export class QaError extends Error {
  public status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function qaConfig(env: Record<string, string | undefined>) {
  if (env.HUT_QA_ENABLED !== 'true') throw new QaError('Panel QA deshabilitado.', 404);
  const origin = env.HUT_QA_ORIGIN || 'http://127.0.0.1:3000';
  const local = new URL(origin);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname) || !['http:', 'https:'].includes(local.protocol) || local.origin !== origin) {
    throw new QaError('HUT_QA_ORIGIN debe ser un origen local exacto.', 503);
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url !== `https://${HUT_PROJECT}.supabase.co` || !key || key.includes('REPLACE_ME') || key.startsWith('sb_secret_')) {
    throw new QaError('Configura la URL HUT y una clave publishable válida en .env.local.', 503);
  }
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if (payload.role !== 'anon') throw new Error();
    } catch { throw new QaError('La configuración pública solo admite publishable o JWT anon.',503); }
  }
  return { origin, url, key };
}
export function assertOrigin(actualUrl: string, originHeader: string | null, configuredOrigin: string, mutation: boolean) {
  if (new URL(actualUrl).origin !== configuredOrigin || (mutation && originHeader !== configuredOrigin)) {
    throw new QaError('Origen no autorizado.', 403);
  }
}
export function assertLocalRequest(host: string | null, originHeader: string | null, configuredOrigin: string, mutation: boolean) {
  // Next's internal Request.url can use localhost even when the external Host is 127.0.0.1.
  // Validate the actual Host directly; never trust X-Forwarded-Host from a request.
  if (host !== new URL(configuredOrigin).host || (mutation && originHeader !== configuredOrigin)) {
    throw new QaError('Origen no autorizado.',403);
  }
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new QaError('UUID inválido.');
  return value;
}
export function boundedInt(value: unknown, min: number, max: number, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new QaError(`Número fuera de ${min}–${max}.`);
  return number;
}
export function searchArguments(body: Record<string, unknown>) {
  if (typeof body.market !== 'string' || !/^[a-z0-9_]{1,100}$/.test(body.market)) throw new QaError('Selecciona o indica un código de mercado.');
  if (body.query !== undefined && (typeof body.query !== 'string' || body.query.length > 200)) throw new QaError('Búsqueda: máximo 200 caracteres.');
  for (const key of ['confirmed', 'presence']) if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new QaError('Filtro booleano inválido.');
  return { p_market_code: body.market, p_category_id: body.category ? uuid(body.category) : null,
    p_service_id: body.service ? uuid(body.service) : null, p_query: body.query || null,
    p_confirmed_only: body.confirmed === true, p_presence_only: body.presence === true,
    p_limit: boundedInt(body.limit, 1, 100, 20), p_offset: boundedInt(body.offset, 0, 10000, 0) };
}
