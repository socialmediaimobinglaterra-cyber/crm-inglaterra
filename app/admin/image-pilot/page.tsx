import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionFromCookie } from '@/lib/auth/session';
import { requireActiveAdminByEmail } from '@/lib/queries/users';
import { getImagePilotStatus } from '@/lib/queries/catalog-image-pilot';
import { imagePilotPropertyId, imagePilotLimit } from '@/lib/catalog/image-pilot';
import { imageStorageConfigured } from '@/lib/catalog/image-storage';
import { CrmNavigation } from '@/components/crm-navigation';
import { ImagePilotButton } from '@/components/image-pilot-button';

export const dynamic='force-dynamic';
export const maxDuration=120;
export default async function ImagePilotPage() {
  const session=await getSessionFromCookie();
  if(!session) redirect('/login');
  const user=await requireActiveAdminByEmail(session.email);
  if(!user) redirect('/dashboard');
  const status=await getImagePilotStatus(user.email,imagePilotPropertyId);
  const configured=imageStorageConfigured();
  const finished=status.items.length>0&&status.items.every(item=>item.status==='done'||item.attempts>=3);
  const labels:Record<string,string>={pending:'Pendente',working:'Em processamento',done:'Transferida',failed:'Falhou'};
  return <main className="mx-auto max-w-4xl px-4 pb-10 sm:px-8">
    <CrmNavigation role={user.role}/>
    <h1 className="mt-8 text-2xl font-semibold">Piloto de fotos</h1>
    <p className="mt-2">Imóvel {status.code} · Limite de {imagePilotLimit} fotos</p>
    <ul className="mt-6 divide-y border-y border-slate-200">{status.items.map(item=><li key={item.slot} className="flex flex-wrap justify-between gap-3 py-3"><span>Foto {item.slot}</span><span>{item.attempts>=3&&item.status!=='done'?'Revisão necessária':labels[item.status]}</span></li>)}</ul>
    {!configured&&<p className="mt-4 text-amber-800">Armazenamento indisponível neste ambiente.</p>}
    <ImagePilotButton disabled={!configured||finished}/>
    <Link href={`/catalog/${imagePilotPropertyId}`} className="mt-6 inline-block underline">Voltar ao imóvel</Link>
  </main>;
}
