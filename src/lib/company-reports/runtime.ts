import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createReportHandler, reportConfig, verifyTurnstile } from './handler';
import { ReportError } from './contract';
export const postCompanyReport=createReportHandler({
  config:()=>reportConfig(process.env),verify:verifyTurnstile,
  write:async(args,config)=>{
    const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})}});
    const {data,error}=await client.rpc('submit_company_report',args);
    if(error)throw new ReportError(({HUT_REPORT_RATE_LIMIT:429,HUT_REPORT_UNAVAILABLE:404,HUT_REPORT_INVALID:400,HUT_REPORT_AUTOMATED:403} as Record<string,number>)[error.message] || 503);
    if(data!==true)throw new ReportError(503);
  },
});
