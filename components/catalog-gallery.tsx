"use client";
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Star, Trash2, Upload } from 'lucide-react';
import { catalogImageAction } from '@/app/catalog/[id]/image-actions';
import type { GalleryImage } from '@/lib/queries/catalog-images';

export function CatalogGallery({propertyId,images,version,externalCount,uploadAvailable}:{propertyId:string;images:GalleryImage[];version:string;externalCount:number;uploadAvailable:boolean}) {
  const [pending,startTransition]=useTransition();
  const [message,setMessage]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const router=useRouter();
  function execute(command:string,imageId?:string) {
    if(pending) return;
    if(command==='remove' && !window.confirm('Remover esta foto da galeria?')) return;
    const data=new FormData(); data.set('propertyId',propertyId); data.set('command',command); data.set('version',version);
    if(imageId) data.set('imageId',imageId);
    if(command==='upload') {
      const file=input.current?.files?.[0];
      if(!file || file.size>4_000_000) {setMessage('Selecione uma imagem de até 4 MB.');return;}
      data.set('image',file);
    }
    startTransition(async()=>{
      try {
        const result=await catalogImageAction({ok:false,message:''},data);
        setMessage(result.message);
        if(result.ok) { if(input.current) input.current.value=''; router.refresh(); }
      } catch { setMessage('A conexão foi interrompida. Recarregue a galeria para conferir o resultado antes de tentar novamente.'); }
    });
  }
  const tool='flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40';
  return <section className="border-t border-slate-200 py-7" aria-labelledby="gallery-heading" aria-busy={pending}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 id="gallery-heading" className="text-lg font-semibold">Fotos <span className="font-normal text-slate-500">({images.length})</span></h2>
      <form onSubmit={event=>{event.preventDefault();execute('upload');}} className="flex max-w-full flex-wrap items-end gap-3">
        <label className="block min-w-0 text-sm">JPEG, PNG ou WebP · até 4 MB<input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={pending||!uploadAvailable} className="mt-1 block w-full max-w-72 text-sm" /></label>
        <button type="submit" disabled={pending||!uploadAvailable} className="flex items-center gap-2 rounded bg-emerald-800 px-4 py-2 text-white disabled:opacity-50"><Upload size={17}/>{pending?'Aguarde...':'Adicionar foto'}</button>
      </form>
    </div>
    {!uploadAvailable && <p className="mb-4 text-sm text-amber-800">Upload indisponível neste ambiente: armazenamento privado não conectado.</p>}
    {externalCount>0 && <p className="mb-4 text-sm text-slate-600">{externalCount} mídias da fonte externa aguardam migração.</p>}
    <p role="status" aria-live="polite" className="mb-4 text-sm">{message}</p>
    {!images.length ? <p className="py-6 text-slate-500">Nenhuma foto adicionada à galeria privada.</p> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{images.map((image,index)=><figure key={image.id} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Authenticated proxy: next/image's unauthenticated optimizer must not fetch private images. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/blob-image/${image.id}?size=thumb`} alt={`Foto ${index+1} do imóvel`} width={image.width} height={image.height} loading="lazy" className="aspect-[4/3] w-full bg-slate-100 object-contain" />
      <figcaption className="flex flex-wrap items-center gap-2 p-3"><span className="mr-auto text-sm">{image.is_primary?'Foto principal':`Foto ${index+1}`}</span>
        <button type="button" title="Mover para antes" aria-label={`Mover foto ${index+1} para antes`} className={tool} disabled={pending||index===0} onClick={()=>execute('earlier',image.id)}><ArrowLeft size={16}/></button>
        <button type="button" title="Mover para depois" aria-label={`Mover foto ${index+1} para depois`} className={tool} disabled={pending||index===images.length-1} onClick={()=>execute('later',image.id)}><ArrowRight size={16}/></button>
        <button type="button" title="Definir foto principal" aria-label={`Definir foto ${index+1} como principal`} aria-pressed={image.is_primary} className={tool} disabled={pending||image.is_primary} onClick={()=>execute('primary',image.id)}><Star size={16} fill={image.is_primary?'currentColor':'none'}/></button>
        <button type="button" title="Remover foto" aria-label={`Remover foto ${index+1}`} className={`${tool} text-red-700`} disabled={pending||!uploadAvailable} onClick={()=>execute('remove',image.id)}><Trash2 size={16}/></button>
      </figcaption>
    </figure>)}</div>}
  </section>;
}
