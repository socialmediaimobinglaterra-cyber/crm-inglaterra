import { createPublicHandlers } from '@/lib/catalog/public-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = createPublicHandlers();
export async function GET(request: Request, context: {params: Promise<{unit:string;path:string[]}>}) {
  const {unit,path} = await context.params;
  return handlers.catalog(request,unit,path);
}
export { GET as POST, GET as PUT, GET as PATCH, GET as DELETE, GET as HEAD, GET as OPTIONS };
