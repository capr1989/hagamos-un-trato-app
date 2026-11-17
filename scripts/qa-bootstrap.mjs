import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const expected='https://lewlduoqmsdnmxfichus.supabase.co';
async function passwordPrompt() {
  if (!stdin.isTTY) throw new Error('El bootstrap requiere terminal interactiva; no pases contraseñas por argumentos.');
  stdout.write('Contraseña inicial (mínimo 12 caracteres, entrada oculta): ');
  stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
  return new Promise((resolve,reject)=>{
    let value='';
    const finish=()=>{stdin.off('data',read);stdin.setRawMode(false);stdin.pause();stdout.write('\n');};
    function read(chunk) {
      for(const char of chunk){
        if(char==='\u0003'){finish();reject(new Error('Cancelado.'));return;}
        if(char==='\r'||char==='\n'){finish();resolve(value);return;}
        if(char==='\u007f'||char==='\b')value=value.slice(0,-1);
        else if(char>=' ')value+=char;
      }
    }
    stdin.on('data',read);
  });
}
async function run() {
  if(process.env.HUT_QA_BOOTSTRAP!=='I_AUTHORIZE_HUT_DEV_BOOTSTRAP')throw new Error('Define HUT_QA_BOOTSTRAP=I_AUTHORIZE_HUT_DEV_BOOTSTRAP solo para esta operación de operador.');
  if(process.env.NEXT_PUBLIC_SUPABASE_URL!==expected)throw new Error('Destino incorrecto: solo lewlduoqmsdnmxfichus.');
  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!secret||secret.includes('REPLACE_ME'))throw new Error('Falta SUPABASE_SECRET_KEY de operador en el entorno local; nunca en NEXT_PUBLIC_ ni en Git.');
  const client=createClient(expected,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const status=await client.rpc('qa_bootstrap_status');
  if(status.error)throw new Error('No se pudo comprobar bootstrap. Verifica la migración QA y la clave de operador.');
  if(status.data!==true)throw new Error('Bootstrap ya consumido: existe personal HUT. Usa un administrador existente.');
  const args=process.argv.slice(2);
  const arg=name=>args[args.indexOf(name)+1];
  let userId=args.includes('--user-id')?arg('--user-id'):null;
  if(userId&&!/^[0-9a-f-]{36}$/i.test(userId))throw new Error('UUID inválido.');
  if(!userId){
    const email=args.includes('--email')?arg('--email'):null;
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Usa --email correo-real o --user-id UUID de una cuenta Auth existente.');
    const confirm=createInterface({input:stdin,output:stdout});
    const response=await confirm.question(`Crear el primer administrador real ${email} en HUT desarrollo. Escribe CREAR: `);confirm.close();
    if(response!=='CREAR')throw new Error('Cancelado.');
    let password=await passwordPrompt();
    if(password.length<12||password.length>128)throw new Error('La contraseña debe tener 12–128 caracteres.');
    const created=await client.auth.admin.createUser({email,password,email_confirm:true});password='';
    if(created.error||!created.data.user)throw new Error('Auth no creó la cuenta. Si ya existe, usa su UUID con --user-id.');
    userId=created.data.user.id;
  }
  const granted=await client.rpc('qa_bootstrap_admin',{p_user_id:userId});
  if(granted.error)throw new Error(`No se asignó rol a ${userId}. Puede existir una cuenta Auth sin rol. El bootstrap es transaccional y no se reintenta a ciegas.`);
  stdout.write(`Primer administrador habilitado: ${userId}. Bootstrap consumido. Elimina HUT_QA_BOOTSTRAP del entorno.\n`);
  delete process.env.HUT_QA_BOOTSTRAP;
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
