import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { ReportError, reportBody } from './contract.ts';
import type { ReportInput } from './contract.ts';

type Env=Record<string,string|undefined>;
export type ReportConfig={url:string;key:string;secret:string;turnstileSecret:string;privacyVersion:string;origins:string[];hostnames:string[];ipSource:'vercel'|'loopback'};
export function reportConfig(env:Env):ReportConfig {
  const url=env.NEXT_PUBLIC_SUPABASE_URL;
  const key=env.SUPABASE_SECRET_KEY || '';
  let privileged=key.startsWith('sb_secret_') && key.length>20;
  try { if(!privileged) privileged=JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role==='service_role'; } catch { /* fail closed */ }
  const origins=(env.HUT_REPORTS_ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
  const hostnames=(env.HUT_REPORTS_ALLOWED_HOSTNAMES || '').split(',').map(s=>s.trim()).filter(Boolean);
  const local=env.HUT_REPORTS_IP_SOURCE==='loopback' && env.NODE_ENV!=='production' && env.HUT_QA_ENABLED==='true';
  const vercel=env.HUT_REPORTS_IP_SOURCE==='vercel' && env.VERCEL==='1';
  if(env.HUT_REPORTS_ENABLED!=='true' || url!=='https://lewlduoqmsdnmxfichus.supabase.co' || !privileged ||
     !env.HUT_REPORTS_ORIGIN_SECRET || env.HUT_REPORTS_ORIGIN_SECRET.length<32 || !env.TURNSTILE_SECRET_KEY ||
     !env.HUT_REPORTS_PRIVACY_NOTICE_VERSION?.trim() || env.HUT_REPORTS_PRIVACY_NOTICE_VERSION.trim().length>100 ||
     !origins.length || !hostnames.length || (!local&&!vercel)) throw new ReportError(503);
  for(const origin of origins) {
    let u:URL;try{u=new URL(origin);}catch{throw new ReportError(503);}
    if(u.origin!==origin || u.username || u.password || (local ? !['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.protocol!=='http:' : u.protocol!=='https:'||['127.0.0.1','localhost','[::1]'].includes(u.hostname))) throw new ReportError(503);
  }
  if(hostnames.some(h=>!/^[a-z0-9.-]+$/.test(h) || (!local&&['localhost','127.0.0.1'].includes(h)))) throw new ReportError(503);
  return {url,key,secret:env.HUT_REPORTS_ORIGIN_SECRET,turnstileSecret:env.TURNSTILE_SECRET_KEY,privacyVersion:env.HUT_REPORTS_PRIVACY_NOTICE_VERSION.trim(),origins,hostnames,ipSource:local?'loopback':'vercel'};
}
export function reportOrigin(request:Request, config:ReportConfig):string {
  const origin=request.headers.get('origin') || '';
  if(!config.origins.includes(origin) || request.headers.get('host')!==new URL(origin).host) throw new ReportError(403);
  if(config.ipSource==='loopback') return '127.0.0.1'; // Ignore caller-provided forwarding headers in local QA.
  const ip=request.headers.get('x-vercel-forwarded-for') || '';
  const kind=isIP(ip);
  if(!kind)throw new ReportError(503);
  // Canonical spelling prevents IPv6 formatting variants from creating separate quotas.
  return kind===6?new URL(`http://[${ip}]/`).hostname.toLowerCase():ip;
}
export function reportHashes(input:ReportInput,ip:string,config:ReportConfig,now:Date) {
  const hash=(value:string)=>createHmac('sha256',config.secret).update(value).digest('hex');
  return {p_origin_hash:hash(`origin|${now.toISOString().slice(0,10)}|${ip}`),
    p_fingerprint:hash(`content|${input.company_id}|${input.report_type}|${input.message.normalize('NFKC').toLowerCase().replace(/\s+/gu,' ')}`),
    p_challenge_hash:hash(`proof|${input.turnstile_token}`)};
}
export type ReportArguments=ReturnType<typeof reportHashes>&{p_company_id:string;p_report_type:string;p_message:string;p_reply_email:string|null;p_privacy_notice_version:string};
export async function verifyTurnstile(token:string,config:ReportConfig,fetcher:typeof fetch=fetch,now=new Date()):Promise<void> {
  let response:Response;let data:Record<string,unknown>;
  try {
    response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:config.turnstileSecret,response:token}),signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('provider');
    data=await response.json();
    if(!data || typeof data!=='object' || typeof data.success!=='boolean')throw new Error('provider');
  } catch { throw new ReportError(503); }
  const age=now.getTime()-Date.parse(String(data.challenge_ts));
  if(data.success!==true || data.action!=='company_report' || typeof data.hostname!=='string' || !config.hostnames.includes(data.hostname) || !Number.isFinite(age) || age < -30000 || age>300000) throw new ReportError(403);
}
const receipt={accepted:true,message:'Solicitud recibida para revisión.'};
export function reportResponse(status:number):Response {
  return Response.json(status===202?receipt:{error:status===429?'Inténtalo de nuevo más tarde.':'No se pudo recibir la solicitud.'},{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...(status===429?{'Retry-After':'600'}:{})}});
}
export function createReportHandler(deps:{config:()=>ReportConfig;verify:(token:string,config:ReportConfig)=>Promise<void>;write:(args:ReportArguments,config:ReportConfig)=>Promise<void>;now?:()=>Date}) {
  return async(request:Request):Promise<Response>=>{
    try {
      const config=deps.config();const ip=reportOrigin(request,config);const input=await reportBody(request);
      if(input.website)return reportResponse(202); // Silent honeypot discard; no report or email is stored.
      await deps.verify(input.turnstile_token,config);
      await deps.write({...reportHashes(input,ip,config,deps.now?.() || new Date()),p_company_id:input.company_id,p_report_type:input.report_type,p_message:input.message,p_reply_email:input.reply_email,p_privacy_notice_version:config.privacyVersion},config);
      return reportResponse(202);
    }catch(error){return reportResponse(error instanceof ReportError?error.status:503);}
  };
}
