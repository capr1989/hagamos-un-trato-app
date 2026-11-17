import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { checkRequest, publicClient, requireStaff, sessionContext, setSessionCookies, closeAuthSession, operatorClient, jsonBody, rateLimit } from '@/lib/qa/server';
import { QaError, searchArguments, uuid, boundedInt, ownPasswordInput } from '@/lib/qa/policy';
import { entities } from '@/lib/qa/schema';
import evidence from '../../../../../supabase/qa-verification.json';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function respond(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control':'no-store, private', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY' } });
}
function failure(error: unknown) {
  if (error instanceof QaError) return respond({ error: error.message }, error.status);
  return respond({ error: 'La operación falló. No se registraron credenciales ni contenido privado.' }, 500);
}
function result<T>(response: { data: T; error: { message: string; code?: string; details?: string } | null }): T {
  if (response.error) throw new QaError(`${response.error.code || 'DB'}: ${response.error.message.slice(0,500)}${response.error.message === 'Publication blocked' ? ` — ${response.error.details?.slice(0,1500) || ''}` : ''}`, response.error.code === '42501' ? 403 : 400);
  return response.data;
}
export async function GET(request: Request) {
  try {
    checkRequest(request);
    const params = new URL(request.url).searchParams;
    if (params.get('action') === 'session') return respond({ identity: (await sessionContext())?.identity || null });
    const session = await requireStaff();
    if (params.get('action') === 'overview') {
      const entries = await Promise.all(Object.keys(entities).filter(name => name !== 'audit_log' && (name !== 'staff_roles' || session.identity.role === 'admin')).map(async name => [name, result(await session.client.rpc('qa_records', { p_entity: name, p_limit: 200 }))]));
      return respond({ rows: Object.fromEntries(entries), identity: session.identity, limit: 200 });
    }
    if (params.get('action') === 'records') {
      const entity = params.get('entity') || '';
      if (!Object.hasOwn(entities,entity)) throw new QaError('Entidad inválida.');
      return respond({ rows: result(await session.client.rpc('qa_records', { p_entity: entity, p_company_id: params.get('company') ? uuid(params.get('company')) : null, p_limit: 100, p_offset: boundedInt(params.get('offset'),0,10000,0) })) });
    }
    throw new QaError('Acción desconocida.', 404);
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    checkRequest(request,true);
    const body = await jsonBody(request);
    if (body.action === 'login') {
      rateLimit('local-login',10,300000);
      if (typeof body.email !== 'string' || body.email.length > 254 || typeof body.password !== 'string' || body.password.length > 1024) throw new QaError('Credenciales inválidas.');
      const response = await publicClient().auth.signInWithPassword({ email: body.email, password: body.password });
      if (response.error || !response.data.session) throw new QaError('No se pudo iniciar sesión. Comprueba las credenciales y la configuración Auth.',401);
      await setSessionCookies(response.data.session);
      return respond({ identity: (await sessionContext(false))?.identity || null });
    }
    if (body.action === 'logout') {
      const revoked = await closeAuthSession();
      return respond({ identity: null, auth_session_revoked:revoked });
    }
    const session = await requireStaff();
    rateLimit(`write:${session.identity.user.id}`,120,60000);
    if (body.action === 'change-password') {
      rateLimit(`password:${session.identity.user.id}`,5,300000);
      const password=ownPasswordInput(body);
      if (!session.identity.user.email) throw new QaError('La cuenta no tiene email.',400);
      const auth=publicClient();
      const reauthenticated=await auth.auth.signInWithPassword({email:session.identity.user.email,password:password.current});
      if (reauthenticated.error || !reauthenticated.data.session || reauthenticated.data.user?.id!==session.identity.user.id) throw new QaError('La contraseña actual no es correcta.',400);
      const changed=await auth.auth.updateUser({password:password.next,current_password:password.current});
      if (changed.error) {
        await auth.auth.signOut({scope:'local'});
        throw new QaError(`Supabase rechazó el cambio de contraseña (${changed.error.code || 'Auth'}). Revisa la política de contraseñas.`,400);
      }
      const current=await auth.auth.getSession();
      await setSessionCookies(current.data.session || reauthenticated.data.session);
      return respond({password_changed:true});
    }
    if (body.action === 'save') {
      const name = String(body.entity);
      const definition = Object.hasOwn(entities,name) ? entities[name] : null;
      if (!definition || definition.readonly) throw new QaError('Entidad no editable.');
      if (definition.admin && session.identity.role !== 'admin') throw new QaError('Se requiere administrador.',403);
      if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw new QaError('Datos inválidos.');
      const data = { ...body.data } as Record<string,unknown>;
      const allowed = new Set(definition.fields.map(field => field.name));
      if (Object.keys(data).some(key=>!allowed.has(key))) throw new QaError('Campo no permitido.');
      if (name === 'companies' && !body.id && body.test_data !== false) {
        data.trade_name = `QA TEST ${String(data.trade_name || '').replace(/^QA TEST\s+/, '')}`;
        data.slug = `qa-test-${String(data.slug || randomUUID())}`;
        data.qa_test_batch = randomUUID();
      }
      const saved = result(await session.client.rpc('qa_save', { p_entity: name, p_data: data, p_id: body.id ? String(body.id) : null }));
      return respond({ row: saved });
    }
    if (body.action === 'check-publication' || body.action === 'publish' || body.action === 'duplicates' || body.action === 'archive-test') {
      if (body.action === 'archive-test' && session.identity.role !== 'admin') throw new QaError('Se requiere administrador.',403);
      if (['publish','archive-test'].includes(String(body.action)) && body.confirm !== true) throw new QaError('Falta confirmación explícita.');
      const procedure = { 'check-publication':'qa_publication_check', publish:'qa_publish_company', duplicates:'qa_duplicate_candidates', 'archive-test':'qa_archive_test_company' }[body.action];
      return respond({ result: result(await session.client.rpc(procedure, { p_company_id: uuid(body.company_id) })) });
    }
    if (body.action === 'market-status') {
      if (session.identity.role !== 'admin') throw new QaError('Se requiere administrador.',403);
      if (!['draft','active','paused'].includes(String(body.status))) throw new QaError('Estado inválido.');
      return respond({ row: result(await session.client.rpc('qa_set_market_status', { p_market_id: uuid(body.market_id), p_status: body.status, p_documentation_confirmed: body.documented === true })) });
    }
    if (body.action === 'create-user') {
      if (session.identity.role !== 'admin') throw new QaError('Se requiere administrador.',403);
      if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254 || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128 || !['admin','editor'].includes(String(body.role))) throw new QaError('Email, contraseña mínima de 12 caracteres y rol válidos son obligatorios.');
      const created = await operatorClient().auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true });
      if (created.error || !created.data.user) throw new QaError('Auth no creó el usuario. Comprueba si ya existe y la configuración del servidor.');
      const userId = created.data.user.id;
      const grant = await session.client.rpc('qa_save', { p_entity:'staff_roles', p_data:{ user_id:userId, role:body.role, status:'active' } });
      if (grant.error) throw new QaError(`Auth creó ${userId}, pero no pudo conceder el rol. La cuenta sigue sin acceso HUT. Habilita ese UUID desde Roles.`,409);
      return respond({ user: { id:userId, email:created.data.user.email }, role:body.role });
    }
    if (body.action === 'search') {
      const args = searchArguments(body);
      const anonymous = publicClient(); // Always new, with no user session or privileged key.
      const rows = result(await anonymous.rpc('search_directory',args));
      let query = anonymous.from('directory_company_offerings').select('*').eq('market_code',args.p_market_code);
      if (args.p_category_id) query = query.eq('category_id',args.p_category_id);
      if (args.p_service_id) query = query.eq('service_id',args.p_service_id).not('coverage_status','in','(not_served,disputed)');
      const offerings = result(await query.limit(200));
      return respond({ rows, offerings, context:'anon: cliente separado sin sesión', offset:args.p_offset, limit:args.p_limit, offering_note:'La vista muestra contexto de mercado/categoría/servicio, máximo 200 ofertas; la RPC aplica además texto y filtros de presencia/cobertura.' });
    }
    if (body.action === 'diagnostics') {
      const anonymous = publicClient();
      const taxonomy = await anonymous.from('categories').select('id,code,services(id,code,category_id)');
      const search = await anonymous.rpc('search_directory',{p_market_code:'qa_nonexistent_market',p_limit:1});
      const privateAccess = await anonymous.schema('private').from('staff_roles').select('user_id').limit(1);
      const taxonomyOK = !taxonomy.error && taxonomy.data?.length===2 && taxonomy.data.reduce((n,row)=>n+(Array.isArray(row.services)?row.services.length:0),0)===10;
      return respond({ live:[
        {name:'Sesión verificada con Auth getUser',status:'PASS',detail:session.identity.user.id},
        {name:'Rol HUT activo comprobado en base de datos',status:'PASS',detail:session.identity.role},
        {name:'Taxonomía anónima: 2 categorías y 10 servicios',status:taxonomyOK?'PASS':'FAIL',detail:taxonomy.error?.code || 'Consulta ejecutada'},
        {name:'RPC pública con cliente anónimo aislado',status:!search.error&&Array.isArray(search.data)&&search.data.length===0?'PASS':'FAIL',detail:search.error?.code || 'Mercado inexistente: resultado vacío'},
        {name:'private inaccesible para visitante por Data API',status:privateAccess.error?(['PGRST106','42501'].includes(privateAccess.error.code)?'PASS':'NOT TESTED'):'FAIL',detail:privateAccess.error?.code || 'Revisar exposición y privilegios'},
        ...['Sesión real de otro editor/admin','Contactos vencidos con datos publicables reales','Intento de publicación con la sesión actual','Restricciones de edición probadas con otra identidad'].map(name=>({name,status:'NOT TESTED',detail:'No se ejecuta creando datos o identidades automáticamente.'})),
      ],operator:evidence });
    }
    throw new QaError('Acción desconocida.',404);
  } catch (error) { return failure(error); }
}
