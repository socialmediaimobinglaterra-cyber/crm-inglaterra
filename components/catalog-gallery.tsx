"use client";
import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Star, Trash2, ImagePlus } from 'lucide-react';

export type DraftPhoto = { key:string; id?:string; file?:File; preview:string; primary:boolean };
export function CatalogGallery({photos,onChange,pending,externalCount,uploadAvailable}:{photos:DraftPhoto[];onChange:(photos:DraftPhoto[])=>void;pending:boolean;externalCount:number;uploadAvailable:boolean}) {
  const input=useRef<HTMLInputElement>(null);
  const [message,setMessage]=useState('');
  function select(files:FileList|null) {
    if(!files) return;
    const selected=Array.from(files);
    if(photos.length+selected.length>1000 || selected.some(file=>!file.size || file.size>4_000_000 || !['image/jpeg','image/png','image/webp'].includes(file.type))) {
      setMessage('Selecione JPEG, PNG ou WebP de até 4 MB por foto. Limite de 1.000 fotos por imóvel.');
      if(input.current) input.current.value='';
      return;
    }
    const additions=selected.map((file,index)=>({key:crypto.randomUUID(),file,preview:URL.createObjectURL(file),primary:photos.length===0&&index===0}));
    onChange([...photos,...additions]);setMessage('');
    if(input.current) input.current.value='';
  }
  function move(index:number,offset:number) {
    const next=[...photos];[next[index],next[index+offset]]=[next[index+offset],next[index]];onChange(next);
  }
  function remove(index:number) {
    const next=photos.filter((_,i)=>i!==index);
    if(photos[index].primary&&next.length) next[0]={...next[0],primary:true};
    onChange(next);
  }
  const tool='flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40';
  return <section className="border-t border-slate-200 py-7" aria-labelledby="gallery-heading" aria-busy={pending}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <h2 id="gallery-heading" className="text-lg font-semibold">Fotos ({photos.length})</h2>
      <div><input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Arquivos de fotos" onChange={event=>select(event.target.files)} disabled={pending}/>
        <button type="button" onClick={()=>input.current?.click()} disabled={pending} className="flex items-center gap-2 rounded bg-emerald-800 px-4 py-2 text-white disabled:opacity-50"><ImagePlus size={18}/>Escolher fotos</button>
        <p className="mt-2 text-xs text-slate-500">JPEG, PNG ou WebP · até 4 MB por foto</p>
      </div>
    </div>
    {!uploadAvailable&&<p className="mb-4 text-sm text-amber-800">Prévia disponível. O envio das fotos está indisponível neste ambiente.</p>}
    {externalCount>0&&<p className="mb-4 text-sm text-slate-600">{externalCount} mídias da fonte externa aguardam migração.</p>}
    {message&&<p role="alert" className="mb-4 text-sm text-red-700">{message}</p>}
    {!photos.length?<p className="py-6 text-slate-500">Nenhuma foto selecionada.</p>:<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{photos.map((photo,index)=><figure key={photo.key} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Local previews and authenticated proxy cannot use the public image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.preview} alt={`Foto ${index+1} do imóvel`} className="aspect-[4/3] w-full bg-slate-100 object-contain"/>
      <figcaption className="flex flex-wrap items-center gap-2 p-3"><span className="mr-auto text-sm">{photo.primary?'Foto principal':`Foto ${index+1}`}{photo.file&&<span className="block text-xs text-amber-800">Não salva</span>}</span>
        <button type="button" title="Mover para antes" aria-label={`Mover foto ${index+1} para antes`} className={tool} disabled={pending||index===0} onClick={()=>move(index,-1)}><ArrowLeft size={16}/></button>
        <button type="button" title="Mover para depois" aria-label={`Mover foto ${index+1} para depois`} className={tool} disabled={pending||index===photos.length-1} onClick={()=>move(index,1)}><ArrowRight size={16}/></button>
        <button type="button" title="Definir principal" aria-label={`Definir foto ${index+1} como principal`} aria-pressed={photo.primary} className={tool} disabled={pending||photo.primary} onClick={()=>onChange(photos.map(item=>({...item,primary:item.key===photo.key})))}><Star size={16} fill={photo.primary?'currentColor':'none'}/></button>
        <button type="button" title="Remover foto" aria-label={`Remover foto ${index+1}`} className={`${tool} text-red-700`} disabled={pending} onClick={()=>remove(index)}><Trash2 size={16}/></button>
      </figcaption>
    </figure>)}</div>}
  </section>;
}
