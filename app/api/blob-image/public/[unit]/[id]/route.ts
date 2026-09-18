import { createPublicHandlers } from '@/lib/catalog/public-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handlers = createPublicHandlers();
export async function GET(request: Request, context: {params: Promise<{unit:string;id:string}>}) {
  const {unit,id} = await context.params;
  return handlers.image(request,unit,id);
}
export { GET as POST, GET as PUT, GET as PATCH, GET as DELETE, GET as HEAD, GET as OPTIONS };
