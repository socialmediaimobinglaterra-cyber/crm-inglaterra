"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Download, Pause, RefreshCw, ListPlus } from 'lucide-react';
import { prepareImageBatch, transferNextBatchImage } from '@/app/admin/image-migration/actions';
import type { ImageBatchStatus } from '@/lib/queries/catalog-image-batches';

const button='inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm disabled:opacity-50';
export function ImageBatchForm() {
  const router=useRouter();
  const busy=useRef(false);
  const requestId=useRef<string|null>(null);
  const [pending,setPending]=useState(false);
  const [message,setMessage]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy.current) return;
    busy.current=true;setPending(true);setMessage('');
    const data=new FormData(event.currentTarget);
    requestId.current??=crypto.randomUUID();data.set('id',requestId.current);
    try {
      const result=await prepareImageBatch(data);
      if(result.id) {requestId.current=null;router.push(`/admin/image-migration?batch=${result.id}`);router.refresh();}
      else {setMessage(result.message);requestId.current=null;}
    } catch {setMessage('Falha de conexão. Tente novamente.');}
    finally {busy.current=false;setPending(false);}
  }
  return <form onSubmit={submit} className="border-y border-slate-200 py-5">
    <fieldset disabled={pending} className="flex flex-wrap items-end gap-4">
      <label className="grid gap-2 text-sm">Código do imóvel<input required name="code" maxLength={14} pattern="[A-Za-z]{2}[0-9]{4,12}" className="w-44 rounded border border-slate-300 bg-white p-2"/></label>
      <label className="grid gap-2 text-sm">Fotos no lote<input required name="limit" type="number" min={1} max={10} defaultValue={10} className="w-24 rounded border border-slate-300 bg-white p-2"/></label>
      <button className={`${button} bg-emerald-800 text-white`}><ListPlus size={18}/>{pending?'Preparando...':'Preparar lote'}</button>
    </fieldset>
    <p role="status" className="mt-3 text-sm">{message}</p>
  </form>;
}

const statusLabels:Record<string,string>={pending:'Pendente',working:'Em processamento',done:'Transferida',failed:'Falhou',interrupted:'Interrompida'};
const reasons:Record<string,string>={download:'Download indisponível',image:'Imagem não aceita',storage:'Falha no armazenamento',finalize:'Confirmação não concluída'};
function volume(bytes:number) {return `${(bytes/1_000_000).toFixed(2)} MB`;}

export function ImageMigrationPanel({initial,configured}:{initial:ImageBatchStatus;configured:boolean}) {
  const router=useRouter();
  const [batch,setBatch]=useState(initial);
  const [running,setRunning]=useState(false);
  const [pausing,setPausing]=useState(false);
  const [message,setMessage]=useState('');
  const busy=useRef(false),stop=useRef(false);
  useEffect(()=>{if(!busy.current) setBatch(initial);},[initial]);
  useEffect(()=>()=>{stop.current=true;},[]);
  async function run() {
    if(busy.current) return;
    busy.current=true;stop.current=false;setRunning(true);setPausing(false);setMessage('');
    try {
      // Hard client bound, plus persistent server-side selection and retry limits.
      for(let step=0;step<30&&!stop.current;step++) {
        const data=new FormData();data.set('id',batch.id);
        const result=await transferNextBatchImage(data);
        if(result.batch) setBatch(result.batch);
        setMessage(result.message);
        if(result.status!=='done'||!result.batch?.remaining) break;
      }
      if(stop.current) setMessage('Lote pausado. A transferência em andamento foi finalizada.');
    } catch {setMessage('Conexão interrompida. Atualize o progresso antes de retomar.');}
    finally {busy.current=false;setRunning(false);setPausing(false);router.refresh();}
  }
  return <section className="mt-8 min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Imóvel {batch.code}</h2><Link className="underline" href={`/catalog/${batch.propertyId}`}>Ver imóvel</Link></div>
    <dl className="my-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div><dt className="text-sm text-slate-600">Transferidas</dt><dd className="font-semibold">{batch.done} / {batch.total}</dd></div>
      <div><dt className="text-sm text-slate-600">Tentativas</dt><dd>{batch.attempts} / {batch.total*3}</dd></div>
      <div><dt className="text-sm text-slate-600">Downloads completos</dt><dd>{volume(batch.downloadedBytes)}</dd></div>
      <div><dt className="text-sm text-slate-600">Imagens e miniaturas gravadas</dt><dd>{volume(batch.storedBytes)}</dd></div>
    </dl>
    <ul className="divide-y border-y border-slate-200">{batch.items.map((item,index)=><li key={item.slot} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>Foto {index+1}</span><span>{item.attempts>=3&&item.status!=='done'&&item.status!=='working'?'Revisão necessária':statusLabels[item.status]}{item.reason?` · ${reasons[item.reason]??'Revisão necessária'}`:''}</span></li>)}</ul>
    <div className="mt-5 flex flex-wrap gap-3">
      <button type="button" onClick={run} disabled={running||!configured||batch.remaining===0||batch.working>0} className={`${button} bg-emerald-800 text-white`}><Download size={18}/>{running?'Transferindo...':'Transferir lote'}</button>
      {running&&<button type="button" onClick={()=>{stop.current=true;setPausing(true);}} disabled={pausing} className={button}><Pause size={18}/>{pausing?'Pausando...':'Pausar'}</button>}
      <button type="button" disabled={running} onClick={()=>router.refresh()} className={button}><RefreshCw size={18}/>Atualizar progresso</button>
    </div>
    {!configured&&<p className="mt-3 text-amber-800">Armazenamento indisponível neste ambiente.</p>}
    <p role="status" aria-live="polite" className="mt-3 text-sm">{message||(!batch.remaining?(batch.done===batch.total?'Lote concluído.':'Lote encerrado com pendências para revisão.'):'')}</p>
  </section>;
}
