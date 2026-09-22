import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runCondominiumBatch } from '@/lib/queries/condominium-batch';
import { sql } from '@/lib/db';

async function main() {
  const args=process.argv.slice(2);
  const output=args.find(a=>a.startsWith('--output='))?.slice(9);
  const expected=args.find(a=>a.startsWith('--expected='))?.slice(11);
  const apply=args.includes('--apply');
  if(!output || (apply && !/^[a-f0-9]{64}$/.test(expected||''))) throw new Error('BATCH_ARGUMENTS_REQUIRED');
  const result=await runCondominiumBatch(apply?expected:undefined);
  await writeFile(resolve(output),JSON.stringify(result,null,2),{flag:'wx'});
  console.log(JSON.stringify({hash:result.hash,applied:result.applied,
    groups:result.plan.changes.length,properties:result.plan.changes.reduce((n,g)=>n+g.ids.length,0),
    newCondominiums:result.plan.changes.filter(g=>!g.targetId).length,
    preserved:result.plan.preserved,pending:result.plan.pending.length}));
}
main().catch(error=>{console.error(error instanceof Error && /^BATCH_/.test(error.message)?error.message:'CONDOMINIUM_BATCH_FAILED');process.exitCode=1;}).finally(()=>sql.end());
