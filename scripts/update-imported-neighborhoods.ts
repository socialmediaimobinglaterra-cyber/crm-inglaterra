import { replaceImportedNeighborhoods } from '@/lib/queries/catalog-neighborhoods';
import { sql } from '@/lib/db';

replaceImportedNeighborhoods('property-feed',process.argv.includes('--apply'))
  .then(result=>console.log(JSON.stringify(result)))
  .catch(()=>{console.error('NEIGHBORHOOD_UPDATE_FAILED');process.exitCode=1;})
  .finally(()=>sql.end());
