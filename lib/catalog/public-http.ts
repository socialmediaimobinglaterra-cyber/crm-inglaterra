import { z } from 'zod';
import { publicationUnitSchema } from './schemas';
import { parsePublicQuery, publicCodeSchema } from './public-api';
import { apiIdentifier, consumeApiLimit } from '@/lib/queries/catalog-api-rate-limit';
import { listPublicProperties, getPublicProperty, getPublicFilterOptions, canReadPublicImage } from '@/lib/queries/catalog-public';
import { readPrivateImage } from './image-storage';

const allowedOrigins = new Set(['https://inglaterrapremium.vercel.app']);
const baseHeaders = {
  'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin',
};
const productionDependencies = {
  identifier: apiIdentifier, limit: consumeApiLimit,
  list: listPublicProperties, detail: getPublicProperty, filters: getPublicFilterOptions,
  imageAllowed: canReadPublicImage, image: readPrivateImage,
};
type Dependencies = Omit<typeof productionDependencies, 'image'> & {
  image: (id:string, thumbnail:boolean) => Promise<{statusCode:number;stream?:ReadableStream<Uint8Array> | null} | null>;
};

// Dependencies are bound on the server; route handlers accept only Next's normal arguments.
export function createPublicHandlers(deps: Dependencies = productionDependencies) {
  async function guard(request: Request, image: boolean) {
    const headers = new Headers(baseHeaders);
    const origin = request.headers.get('origin');
    if (origin && !allowedOrigins.has(origin) && origin !== new URL(request.url).origin) {
      return {headers, error: new Response(null,{status:403,headers})};
    }
    if (origin && allowedOrigins.has(origin)) headers.set('Access-Control-Allow-Origin',origin);
    if (request.method !== 'GET') {
      headers.set('Allow','GET');
      return {headers, error: new Response(null,{status:405,headers})};
    }
    if (!await deps.limit(deps.identifier(request.headers),image ? 'image' : 'json')) {
      headers.set('Retry-After','60');
      return {headers, error: new Response(null,{status:429,headers})};
    }
    return {headers, error:null};
  }

  async function catalog(request: Request, unitInput: string, path: string[]) {
    let headers = new Headers(baseHeaders);
    try {
      const checked = await guard(request,false);
      headers = checked.headers;
      if (checked.error) return checked.error;
      const unit = publicationUnitSchema.safeParse(unitInput);
      if (!unit.success) return Response.json({error:'Recurso nao encontrado.'},{status:404,headers});
      const url = new URL(request.url);
      if (url.search.length > 2048) return Response.json({error:'Parametros invalidos.'},{status:400,headers});
      if (path.length === 1 && path[0] === 'properties') {
        let filters;
        try { filters=parsePublicQuery(url.searchParams); }
        catch { return Response.json({error:'Parametros invalidos.'},{status:400,headers}); }
        return Response.json(await deps.list(unit.data,filters),{headers});
      }
      if (url.search) return Response.json({error:'Parametros invalidos.'},{status:400,headers});
      if (path.length === 1 && path[0] === 'filters') {
        return Response.json({items:await deps.filters(unit.data)},{headers});
      }
      if (path.length === 2 && path[0] === 'properties' && publicCodeSchema.safeParse(path[1]).success) {
        const item = await deps.detail(unit.data,path[1]);
        if (item) return Response.json(item,{headers});
      }
      return Response.json({error:'Recurso nao encontrado.'},{status:404,headers});
    } catch {
      return Response.json({error:'Catalogo temporariamente indisponivel.'},{status:503,headers});
    }
  }

  async function image(request: Request, unitInput: string, id: string) {
    let headers = new Headers(baseHeaders);
    try {
      const checked = await guard(request,true);
      headers = checked.headers;
      if (checked.error) return checked.error;
      const unit = publicationUnitSchema.safeParse(unitInput);
      const params = new URL(request.url).searchParams;
      if (!unit.success || !z.uuid().safeParse(id).success) return new Response(null,{status:404,headers});
      if ([...params.keys()].some(key => key !== 'size') || params.getAll('size').length > 1 ||
          (params.has('size') && !['full','thumb'].includes(params.get('size')!))) return new Response(null,{status:400,headers});
      if (!await deps.imageAllowed(unit.data,id)) return new Response(null,{status:404,headers});
      const result = await deps.image(id,params.get('size') === 'thumb');
      if (!result || result.statusCode !== 200 || !result.stream) return new Response(null,{status:404,headers});
      headers.set('Content-Type','image/webp');
      headers.set('Content-Disposition','inline');
      headers.set('Cross-Origin-Resource-Policy','cross-origin');
      return new Response(result.stream,{headers});
    } catch { return new Response(null,{status:503,headers}); }
  }
  return { catalog, image };
}
