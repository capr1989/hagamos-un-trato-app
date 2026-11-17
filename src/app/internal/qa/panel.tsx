'use client';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Identity } from '@/lib/qa/server';
import { entities, groups, rowLabel } from '@/lib/qa/schema';
import type { Row, Field } from '@/lib/qa/schema';
type Rows = Record<string, Row[]>;
type Api = { identity?: Identity | null; rows?: Rows; row?: Row; result?: unknown; [key:string]:unknown };
async function api(body?: Record<string,unknown>, query=''): Promise<Api> {
  const response = await fetch(`/internal/qa/api${query}`, { method:body?'POST':'GET', credentials:'same-origin', cache:'no-store', headers:body?{'Content-Type':'application/json'}:undefined, body:body?JSON.stringify(body):undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
function localDate(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
const initial = (field: Field, row: Row | null, company: string) => {
  const value = row?.[field.name];
  if (field.type==='date') return localDate(value || (field.name==='obtained_at'?new Date().toISOString():null));
  if (field.type==='array') return Array.isArray(value)?value.join(', '):'';
  if (value !== undefined && value !== null) return String(value);
  if (field.name==='company_id') return company;
  if (field.type==='boolean') return 'false';
  if (field.type==='number') return '0';
  if (field.name==='default_locale') return 'es-PA';
  return field.values?.[0] || '';
};
function RecordForm({entity,row,rows,company,onSaved,admin}:{entity:string;row:Row|null;rows:Rows;company:string;onSaved:()=>Promise<void>;admin:boolean}) {
  const definition=entities[entity];
  const [values,setValues]=useState<Record<string,string>>({});
  const [test,setTest]=useState(true);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{setValues(Object.fromEntries(definition.fields.map(field=>[field.name,initial(field,row,company)])));setMessage('');},[definition,row,company]);
  if (definition.readonly || (definition.admin&&!admin)) return <p className="muted">Solo lectura para este rol.</p>;
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setMessage('');
    try {
      const data:Record<string,unknown>={};
      for (const field of definition.fields) {
        const value=values[field.name]||'';
        if (row && value===initial(field,row,company)) continue;
        let parsed:unknown=field.type==='boolean'?value==='true':field.type==='number'?Number(value):field.type==='array'?value.split(',').map(v=>v.trim()).filter(Boolean):field.type==='date'?(value?new Date(value).toISOString():null):(value||null);
        if (field.required && (parsed===null || parsed==='' || (Array.isArray(parsed)&&!parsed.length))) throw new Error(`${field.label}: campo obligatorio.`);
        if (!row && parsed===null) continue;
        if (row) {
          if (field.name===definition.pk) continue;
          const old=field.type==='date'?(row[field.name]?new Date(String(row[field.name])).toISOString():null):row[field.name]??null;
          if (JSON.stringify(parsed)===JSON.stringify(old)) continue;
        }
        data[field.name]=parsed;
      }
      if (!Object.keys(data).length) {setMessage('Sin cambios.');return;}
      if (entity==='staff_roles'&&!window.confirm('¿Confirmas el cambio de rol/estado de este usuario interno? No puedes modificarte a ti mismo.')) return;
      const response=await api({action:'save',entity,data,id:row?row[definition.pk]:null,test_data:test});
      await onSaved();setMessage(`Guardado: ${String(response.row?.[definition.pk]||'correcto')}`);
    } catch(error){setMessage(error instanceof Error?error.message:'Error al guardar.');}
    finally{setBusy(false);}
  }
  return <form onSubmit={submit} className="record-form">
    <h3>{row?'Editar registro':'Nuevo registro'}</h3>
    {entity==='companies'&&!row&&<label className="check"><input type="checkbox" checked={test} onChange={e=>setTest(e.target.checked)}/>Datos ficticios de QA (predeterminado). Se marcarán QA TEST y jamás podrán publicarse.</label>}
    {entity==='companies'&&!row&&!test&&<p className="warning">Solo datos empresariales reales respaldados. La publicación requiere revisión independiente.</p>}
    <div className="fields">{definition.fields.map(field=>{
      const value=values[field.name]||'';
      const disabled=!!row&&(field.name===definition.pk||(entity==='company_contacts'&&['value','channel'].includes(field.name)));
      let options=field.ref?(rows[field.ref]||[]):[];
      if(field.ref==='services'&&values.category_id) options=options.filter(r=>r.category_id===values.category_id);
      if(['company_branches','company_offerings','company_contacts'].includes(field.ref||'')&&(values.company_id||company)) options=options.filter(r=>r.company_id===(values.company_id||company));
      return <label key={field.name}>{field.label}{field.required?' *':''}
        {field.ref?<select value={value} disabled={disabled} required={field.required} onChange={e=>setValues({...values,[field.name]:e.target.value})}><option value="">— Selecciona —</option>{options.map(r=><option key={String(r[entities[field.ref!].pk])} value={String(r[entities[field.ref!].pk])}>{rowLabel(field.ref!,r)}</option>)}</select>:
          field.values?<select value={value} disabled={disabled} onChange={e=>setValues({...values,[field.name]:e.target.value})}>{!field.values.includes(value)&&value&&<option value={value}>{value} (estado actual)</option>}{field.values.map(v=><option key={v} value={v}>{v||'— Sin valor —'}</option>)}</select>:
          field.type==='boolean'?<select value={value} onChange={e=>setValues({...values,[field.name]:e.target.value})}><option value="false">No</option><option value="true">Sí</option></select>:
          field.type==='textarea'?<textarea value={value} required={field.required} maxLength={field.name==='message'?4000:10000} onChange={e=>setValues({...values,[field.name]:e.target.value})}/>:
          <input value={value} disabled={disabled} required={field.required} type={field.type==='date'?'datetime-local':field.type==='number'?'number':'text'} maxLength={1000} onChange={e=>setValues({...values,[field.name]:e.target.value})}/>}
        {field.hint&&<small>{field.hint}</small>}
      </label>;
    })}</div>
    <button disabled={busy}>{busy?'Guardando…':'Guardar y registrar revisión indicada'}</button>
    {message&&<p role="status" className="notice">{message}</p>}
  </form>;
}
function DataTable({entity,rows,onEdit}:{entity:string;rows:Row[];onEdit?:(row:Row)=>void}) {
  if(!rows.length)return <p className="muted">Sin registros. Esto no es un error.</p>;
  const keys=Object.keys(rows[0]).filter(k=>!['description','evidence_note','message','change_summary'].includes(k)).slice(0,8);
  return <div className="table-wrap"><table><thead><tr>{keys.map(k=><th key={k}>{k}</th>)}<th>Detalle</th></tr></thead><tbody>{rows.map((row,index)=><tr key={String(row[entities[entity]?.pk||'company_id']||index)}>{keys.map(k=><td key={k}>{String(row[k]??'—').slice(0,100)}</td>)}<td>{onEdit&&<button className="secondary" onClick={()=>onEdit(row)}>Editar</button>}<details><summary>JSON</summary><pre>{JSON.stringify(row,null,2)}</pre></details></td></tr>)}</tbody></table></div>;
}
function SearchSimulator({rows}:{rows:Rows}) {
  const [filters,setFilters]=useState({market:'pa_ciudad_panama',category:'',service:'',query:'',confirmed:false,presence:false,limit:20,offset:0});
  const [output,setOutput]=useState<Api|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function search(offset=filters.offset) {setBusy(true);setError('');try{setOutput(await api({action:'search',...filters,offset}));setFilters({...filters,offset});}catch(e){setError(String(e instanceof Error?e.message:e));}finally{setBusy(false);}}
  const returned=Array.isArray(output?.rows)?output.rows as Row[]:[];
  return <section><h2>Simulador de directorio</h2><p>RPC real con cliente <strong>anon</strong> separado. No utiliza la sesión de personal ni service_role.</p><form onSubmit={e=>{e.preventDefault();void search(0);}} className="fields">
    <label>Código de mercado<input list="market-codes" required value={filters.market} onChange={e=>setFilters({...filters,market:e.target.value})}/><datalist id="market-codes">{rows.directory_markets?.map(r=><option key={String(r.id)} value={String(r.code)}/>)}</datalist></label>
    <label>Categoría<select value={filters.category} onChange={e=>setFilters({...filters,category:e.target.value,service:''})}><option value="">Todas</option>{rows.categories?.map(r=><option key={String(r.id)} value={String(r.id)}>{String(r.name)}</option>)}</select></label>
    <label>Servicio<select value={filters.service} onChange={e=>setFilters({...filters,service:e.target.value})}><option value="">Todos / sin filtro</option>{rows.services?.filter(r=>!filters.category||r.category_id===filters.category).map(r=><option key={String(r.id)} value={String(r.id)}>{rowLabel('services',r)}</option>)}</select></label>
    <label>Texto<input maxLength={200} value={filters.query} onChange={e=>setFilters({...filters,query:e.target.value})}/></label>
    <label>Límite<input type="number" min={1} max={100} value={filters.limit} onChange={e=>setFilters({...filters,limit:Number(e.target.value)})}/></label>
    <label className="check"><input type="checkbox" checked={filters.presence} onChange={e=>setFilters({...filters,presence:e.target.checked})}/>Solo presencia documentada</label>
    <label className="check"><input type="checkbox" checked={filters.confirmed} onChange={e=>setFilters({...filters,confirmed:e.target.checked})}/>Solo cobertura confirmada</label><button disabled={busy}>Consultar RPC</button>
  </form>{error&&<p role="alert" className="error">{error}</p>}{output&&<><p>{String(output.context)} · {returned.length} empresas · offset {filters.offset}</p><DataTable entity="search" rows={returned}/><div className="actions"><button disabled={busy||filters.offset===0} onClick={()=>void search(Math.max(0,filters.offset-filters.limit))}>Anterior</button><button disabled={busy||returned.length<filters.limit} onClick={()=>void search(filters.offset+filters.limit)}>Siguiente</button></div><h3>Contexto de ofertas en la vista</h3><p>{String(output.offering_note)}</p><DataTable entity="projection" rows={Array.isArray(output.offerings)?output.offerings as Row[]:[]}/></>}</section>;
}
function OwnPasswordChange() {
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setMessage('');
    if(data.get('new_password')!==data.get('repeat_password')){setMessage('Las contraseñas nuevas no coinciden.');return;}
    setBusy(true);
    try{await api({action:'change-password',current_password:data.get('current_password'),new_password:data.get('new_password')});form.reset();setMessage('Contraseña actualizada.');}
    catch(error){setMessage(error instanceof Error?error.message:'No se pudo cambiar la contraseña.');}
    finally{setBusy(false);}
  }
  return <details><summary>Cambiar mi contraseña</summary><form className="fields" onSubmit={submit}>
    <label>Contraseña actual<input name="current_password" type="password" autoComplete="current-password" required maxLength={1024}/></label>
    <label>Nueva contraseña<input name="new_password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
    <label>Repite la nueva contraseña<input name="repeat_password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
    <button disabled={busy}>Actualizar mi contraseña</button>
  </form>{message&&<p role="status">{message}</p>}</details>;
}
function UserCreation({onSaved}:{onSaved:()=>Promise<void>}) {
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const fields=new FormData(form);setBusy(true);setMessage('');try{const result=await api({action:'create-user',email:fields.get('email'),password:fields.get('password'),role:fields.get('role')});form.reset();await onSaved();setMessage(`Usuario interno creado: ${JSON.stringify(result.user)}`);}catch(error){setMessage(error instanceof Error?error.message:'Error.');}finally{setBusy(false);}}
  return <details><summary>Crear usuario Auth interno (solo admin)</summary><p>Requiere SUPABASE_SECRET_KEY en el servidor. Para habilitar una cuenta Auth existente, usa su UUID en Roles HUT. No hay registro público.</p><form onSubmit={submit} className="fields"><label>Email<input type="email" name="email" required autoComplete="off"/></label><label>Contraseña inicial<input type="password" name="password" minLength={12} maxLength={128} required autoComplete="new-password"/></label><label>Rol<select name="role"><option value="editor">editor</option><option value="admin">admin</option></select></label><label className="check"><input type="checkbox" required/>Confirmo que es personal interno autorizado.</label><button disabled={busy}>Crear cuenta y asignar rol</button></form>{message&&<p role="status">{message}</p>}</details>;
}
export default function QaPanel({initialIdentity}:{initialIdentity:Identity|null}) {
  const [identity,setIdentity]=useState(initialIdentity);const [rows,setRows]=useState<Rows>({});
  const [group,setGroup]=useState('Diagnóstico y pruebas');const [entity,setEntity]=useState('companies');
  const [edit,setEdit]=useState<Row|null>(null);const [company,setCompany]=useState('');
  const [message,setMessage]=useState('');const [output,setOutput]=useState<unknown>(null);const [busy,setBusy]=useState(false);
  const [diagnostics,setDiagnostics]=useState<Api|null>(null);const [documented,setDocumented]=useState(false);const [auditOffset,setAuditOffset]=useState(0);
  const refresh=useCallback(async()=>{const response=await api(undefined,'?action=overview');setRows(response.rows||{});setIdentity(response.identity||null);},[]);
  useEffect(()=>{void api(undefined,'?action=session').then(data=>setIdentity(data.identity||null)).catch(error=>setMessage(error.message));},[]);
  useEffect(()=>{if(identity?.role)void refresh().catch(error=>setMessage(error.message));},[identity?.role,refresh]);
  async function action(body:Record<string,unknown>){setBusy(true);setMessage('');try{const result=await api(body);setOutput(result.result||result.row||result);await refresh();}catch(error){setMessage(error instanceof Error?error.message:'Error.');}finally{setBusy(false);}}
  async function login(e:FormEvent<HTMLFormElement>){e.preventDefault();const fields=new FormData(e.currentTarget);setBusy(true);setMessage('');try{const response=await api({action:'login',email:fields.get('email'),password:fields.get('password')});setIdentity(response.identity||null);}catch(error){setMessage(error instanceof Error?error.message:'Error.');}finally{setBusy(false);}}
  const admin=identity?.role==='admin';
  const visibleRows=(rows[entity]||[]).filter(row=>!company||!['company_offerings','company_branches','company_contacts','company_sources','company_editorial','company_reports'].includes(entity)||row.company_id===company);
  async function audit(offset:number){setBusy(true);try{const response=await api(undefined,`?action=records&entity=audit_log&offset=${offset}`);setRows(current=>({...current,audit_log:response.rows as unknown as Row[]}));setAuditOffset(offset);}catch(e){setMessage(e instanceof Error?e.message:'Error.');}finally{setBusy(false);}}
  function navigate(name:string){setGroup(name);setEntity(groups[name][0]||'companies');setEdit(null);setOutput(null);setMessage('');}
  return <main className="qa"><header><h1>HUT · QA interno</h1><p>Desarrollo · lewlduoqmsdnmxfichus · perfiles no reclamados · sin despliegue público</p>{identity&&<div className="actions"><span>{identity.user.email||identity.user.id} · {identity.role||'sin rol HUT activo'}</span><button onClick={()=>void api({action:'logout'}).then(()=>{setIdentity(null);setRows({});setOutput(null);})}>Cerrar sesión</button></div>}{identity?.role&&<OwnPasswordChange/>}</header>
    {message&&<p role="alert" className="error">{message}</p>}
    {!identity?<section><h2>Iniciar sesión</h2><form onSubmit={login} className="login"><label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required/></label><button disabled={busy}>Entrar</button></form><p>El primer administrador se prepara con <code>npm run qa:bootstrap -- --email correo-real</code>. Revisa docs/QA-PANEL.md. No existe autorregistro.</p></section>:
    !identity.role?<section><h2>Acceso administrativo denegado</h2><p>Auth identificó tu cuenta, pero no hay rol HUT activo. Un administrador debe habilitar tu UUID: <code>{identity.user.id}</code>. Los metadatos del usuario no conceden permisos.</p></section>:
    <><nav aria-label="Secciones QA">{Object.keys(groups).map(name=><button key={name} aria-current={group===name?'page':undefined} onClick={()=>navigate(name)}>{name}</button>)}</nav>
      {group==='Simulador de directorio'?<SearchSimulator rows={rows}/>:
       group==='Diagnóstico y pruebas'?<section><h2>Diagnóstico y pruebas</h2><button disabled={busy} onClick={()=>{setBusy(true);void api({action:'diagnostics'}).then(setDiagnostics).catch(e=>setMessage(e.message)).finally(()=>setBusy(false));}}>Ejecutar comprobaciones en vivo</button><p>Los controles que no se ejecutan se muestran NOT TESTED. Las pruebas con fixtures se ejecutan aparte y se revierten.</p>{diagnostics&&<><h3>Sesión y consultas actuales</h3><DataTable entity="diagnostics" rows={Array.isArray(diagnostics.live)?diagnostics.live as Row[]:[]}/><h3>Evidencia de operador (fecha indicada, no consulta actual)</h3><pre>{JSON.stringify(diagnostics.operator,null,2)}</pre></>}<p>Configurar manualmente en Supabase: private fuera de Data API, registro público y Auth anónimo deshabilitados, URL/redirect locales y política de contraseñas. El panel no cambia esos ajustes.</p></section>:
       <section><h2>{group}</h2>{group==='Usuarios y permisos'&&<><p>Solo un admin modifica roles. No puedes asignarte ni modificar tu propio rol. Suspender personal toma efecto en la próxima petición.</p>{admin?<UserCreation onSaved={refresh}/>:<p>Editor: la administración de usuarios y roles está denegada en servidor y base de datos.</p>}</>}
        {group==='Geografía y mercados'&&<><p>No se cargan automáticamente límites de Ciudad de Panamá. Cada ubicación requiere referencia documental; crearla no crea ni activa un mercado.</p>{!rows.directory_markets?.some(row=>row.code==='pa_ciudad_panama')&&<p className="warning">Mercado inicial pendiente: documenta el ámbito de Ciudad de Panamá antes de cargar su ubicación y crear el mercado en borrador. No se inventan códigos oficiales, límites ni equivalencias territoriales.</p>}</>}
        {group==='Catálogo'&&<p>{(rows.categories||[]).length} categorías · {(rows.services||[]).length} servicios · duplicados categoría/código: {(rows.services||[]).length-new Set((rows.services||[]).map(r=>`${r.category_id}:${r.code}`)).size}. El mismo código en categorías distintas es válido.</p>}
        {['Empresas','Revisión editorial'].includes(group)&&<label>Filtrar por empresa<select value={company} onChange={e=>{setCompany(e.target.value);setEdit(null);setOutput(null);}}><option value="">Todas / elige empresa para acciones</option>{rows.companies?.map(r=><option key={String(r.id)} value={String(r.id)}>{rowLabel('companies',r)}{r.qa_test_batch?' · QA TEST':''}</option>)}</select></label>}
        <div className="actions">{groups[group].map(name=><button className={entity===name?'':'secondary'} key={name} onClick={()=>{setEntity(name);setEdit(null);if(name==='audit_log')void audit(0);}}>{entities[name].title}</button>)}<button className="secondary" onClick={()=>void refresh().catch(e=>setMessage(e.message))}>Actualizar listas</button></div>
        <h3>{entities[entity].title}</h3><p className="muted">Listas de trabajo: máximo 200 registros por entidad. Auditoría paginada por 100. No se ejecutan borrados masivos.</p>
        {entity==='audit_log'&&<div className="actions"><button disabled={busy||auditOffset===0} onClick={()=>void audit(Math.max(0,auditOffset-100))}>Anteriores</button><button disabled={busy||(rows.audit_log||[]).length<100} onClick={()=>void audit(auditOffset+100)}>Siguientes</button></div>}
        <DataTable entity={entity} rows={visibleRows} onEdit={entities[entity].readonly||(entities[entity].admin&&!admin)?undefined:setEdit}/>
        {entity==='directory_markets'&&edit&&admin&&<div className="market-action"><label className="check"><input type="checkbox" checked={documented} onChange={e=>setDocumented(e.target.checked)}/>He revisado el ámbito territorial y la referencia documental; no confundo ciudad, distrito ni provincia.</label><div className="actions"><button disabled={busy||!documented} onClick={()=>{if(window.confirm('¿Activar este mercado de desarrollo con ámbito documentado?'))void action({action:'market-status',market_id:edit.id,status:'active',documented});}}>Activar mercado revisado</button><button disabled={busy} onClick={()=>void action({action:'market-status',market_id:edit.id,status:'paused'})}>Pausar mercado</button></div></div>}
        {!entities[entity].readonly&&<><button className="secondary" onClick={()=>setEdit(null)}>Preparar nuevo registro</button><RecordForm entity={entity} row={edit} rows={rows} company={company} admin={admin} onSaved={refresh}/></>}
        {['Empresas','Revisión editorial'].includes(group)&&company&&<aside><h3>Control de la empresa seleccionada</h3><div className="actions"><button disabled={busy} onClick={()=>void action({action:'check-publication',company_id:company})}>Comprobar requisitos de publicación</button><button disabled={busy} onClick={()=>void action({action:'duplicates',company_id:company})}>Buscar señales de duplicados</button><button disabled={busy} onClick={()=>{if(window.confirm('¿Publicar la empresa real seleccionada si cumple todos los requisitos? Los datos QA TEST se rechazan.'))void action({action:'publish',company_id:company,confirm:true});}}>Intentar publicación revisada</button>{admin&&<button className="danger" disabled={busy} onClick={()=>{if(window.confirm('¿Archivar únicamente esta empresa marcada QA TEST y sus componentes? Se conserva auditoría y no se borra información real.'))void action({action:'archive-test',company_id:company,confirm:true});}}>Limpiar prueba (archivar)</button>}</div><p>La limpieza es archivado seguro de una sola empresa marcada. No borra auditoría ni fuentes compartidas. Las coincidencias nunca fusionan empresas automáticamente.</p></aside>}
        {output!==null&&<div role="status"><h3>Resultado de la operación</h3><pre>{JSON.stringify(output,null,2)}</pre></div>}
       </section>}
    </>}
    <footer>Herramienta temporal de QA. Sin analítica, branding ni registro público. Una revisión editorial no verifica propiedad.</footer>
  </main>;
}
