export const REPORT_TYPES = ['correction','outdated_contact','closure','removal','duplicate','bad_service','no_response','suspected_fraud','other_problem'] as const;
export const REPORT_STATUSES = ['new','in_review','awaiting_info','resolved','dismissed'] as const;
export class ReportError extends Error {
  readonly status: number;
  constructor(status: number) { super('Report request rejected'); this.status = status; }
}
export type ReportInput = { company_id: string; report_type: string; message: string; reply_email: string | null; turnstile_token: string; website: string };
export function reportInput(value: unknown): ReportInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ReportError(400);
  const b = value as Record<string, unknown>;
  if (Object.keys(b).some(k => !['company_id','report_type','message','reply_email','turnstile_token','website'].includes(k))) throw new ReportError(400);
  if (typeof b.company_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.company_id) ||
      typeof b.report_type !== 'string' || !(REPORT_TYPES as readonly string[]).includes(b.report_type) ||
      typeof b.message !== 'string' || b.message.trim().length < 10 || b.message.trim().length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(b.message) ||
      typeof b.turnstile_token !== 'string' || !b.turnstile_token.trim() || b.turnstile_token.length > 2048 || /[\s\u0000-\u001f]/u.test(b.turnstile_token) ||
      (b.website !== undefined && (typeof b.website !== 'string' || b.website.length > 200))) throw new ReportError(400);
  if (b.reply_email !== undefined && b.reply_email !== null && typeof b.reply_email !== 'string') throw new ReportError(400);
  const email = typeof b.reply_email === 'string' ? b.reply_email.trim().toLowerCase() : '';
  if (email && (email.length > 254 || !/^[^\s@\u0000-\u001f\u007f]+@[^\s@\u0000-\u001f\u007f]+\.[^\s@\u0000-\u001f\u007f]+$/u.test(email))) throw new ReportError(400);
  return { company_id:b.company_id.toLowerCase(), report_type:b.report_type, message:b.message.trim(), reply_email:email || null, turnstile_token:b.turnstile_token, website:typeof b.website==='string'?b.website:'' };
}
export async function reportBody(request: Request): Promise<ReportInput> {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type') || '')) throw new ReportError(415);
  const max=32768;
  if (Number(request.headers.get('content-length')) > max) throw new ReportError(413);
  if (!request.body) throw new ReportError(400);
  const reader=request.body.getReader(); let size=0; const chunks:Uint8Array[]=[];
  try {
    for (;;) { const part=await reader.read(); if(part.done)break; size+=part.value.byteLength; if(size>max){await reader.cancel();throw new ReportError(413);} chunks.push(part.value); }
  } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let parsed:unknown;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ReportError(400);}
  return reportInput(parsed);
}
