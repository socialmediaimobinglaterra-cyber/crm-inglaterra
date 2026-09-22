import { createHash, timingSafeEqual } from 'node:crypto';
import type { ApplyResult } from '@/lib/queries/catalog-import';

type Dependencies = {
  secret: string | undefined;
  environment: string | undefined;
  run: () => Promise<ApplyResult>;
};

function json(body: unknown, status: number) {
  return Response.json(body, {status,headers:{
    'Cache-Control':'no-store',
    'CDN-Cache-Control':'no-store',
    'Vercel-CDN-Cache-Control':'no-store',
    'X-Robots-Tag':'noindex, nofollow',
  }});
}

export async function handleScheduledImport(request: Request, deps: Dependencies) {
  if(request.method!=='GET') {
    const response=json({error:'Metodo nao permitido.'},405);
    response.headers.set('Allow','GET');
    return response;
  }
  // Previews and local servers must never become alternative schedulers.
  if(deps.environment!=='production') return json({error:'Recurso nao encontrado.'},404);
  if(!deps.secret || deps.secret.length<32 || /\s/.test(deps.secret)) return json({error:'Agendamento nao configurado.'},503);
  const authorization=request.headers.get('authorization')||'';
  const digest=(value:string)=>createHash('sha256').update(value).digest();
  if(!timingSafeEqual(digest(authorization),digest(`Bearer ${deps.secret}`))) return json({error:'Nao autorizado.'},401);
  // Feed and source identity are configured on the server, never supplied by a caller.
  if(new URL(request.url).search) return json({error:'Parametros nao permitidos.'},400);
  try {
    const result=await deps.run();
    return json({ok:true,result},200);
  } catch {
    // The import service records a controlled failure code; never echo feed/DB errors.
    return json({error:'Falha na sincronizacao. Consulte o registro de importacoes.'},503);
  }
}
