"use client";
import { useActionState } from 'react';
import { Download } from 'lucide-react';
import { migrateNextPilotImage } from '@/app/admin/image-pilot/actions';

export function ImagePilotButton({disabled}:{disabled:boolean}) {
  const [state,action,pending]=useActionState(migrateNextPilotImage,{message:''});
  return <form action={action} className="mt-6">
    <button disabled={disabled||pending} className="flex items-center gap-2 rounded bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50"><Download size={18}/>{pending?'Transferindo...':'Transferir próxima foto'}</button>
    <p role="status" className="mt-3 text-sm">{state.message}</p>
  </form>;
}
