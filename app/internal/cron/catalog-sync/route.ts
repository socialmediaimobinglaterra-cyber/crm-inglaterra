import { propertyXmlAdapter } from '@/lib/catalog/import/adapters/property-xml';
import { fetchPropertyFeed } from '@/lib/catalog/import/feed';
import { importCatalog } from '@/lib/catalog/import/run';
import { handleScheduledImport } from '@/lib/catalog/import/scheduled';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

export function GET(request:Request) {
  return handleScheduledImport(request,{
    secret:process.env.CRON_SECRET,
    environment:process.env.VERCEL_ENV,
    run:async()=> (await importCatalog(propertyXmlAdapter,fetchPropertyFeed(),'property-feed')).result,
  });
}

// Override Next's automatic HEAD/OPTIONS handling so neither can start an import.
export const HEAD=GET;
export const OPTIONS=GET;
export const POST=GET;
export const PUT=GET;
export const PATCH=GET;
export const DELETE=GET;
