import { getSessionFromCookie } from '@/lib/auth/session';
import { catalogIdSchema } from '@/lib/catalog/editor';
import { canReadCatalogImage } from '@/lib/queries/catalog-images';
import { readPrivateImage } from '@/lib/catalog/image-storage';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={ 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer', 'Cross-Origin-Resource-Policy':'same-origin' };
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    if(!catalogIdSchema.safeParse(id).success) return new Response(null,{status:404,headers});
    const session=await getSessionFromCookie();
    if(!session || !await canReadCatalogImage(session.email,id)) return new Response(null,{status:404,headers});
    const result=await readPrivateImage(id,new URL(request.url).searchParams.get('size')==='thumb');
    if(!result || result.statusCode!==200 || !result.stream) return new Response(null,{status:404,headers});
    return new Response(result.stream,{headers:{...headers,'Content-Type':'image/webp','Content-Disposition':'inline'}});
  } catch { return new Response(null,{status:404,headers}); }
}
