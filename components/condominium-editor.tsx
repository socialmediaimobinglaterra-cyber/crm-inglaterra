'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { saveCondominiumAction } from '@/app/catalog/developments/actions';
import { stageCondominiumImage } from '@/app/catalog/developments/image-actions';
import { CatalogGallery, type DraftPhoto } from './catalog-gallery';
import type { GalleryImage } from '@/lib/queries/catalog-images';

export function CondominiumEditor({id,name:initialName,description:initialDescription,version:initialVersion,gallery,uploadAvailable}:{id:string;name:string;description:string;version:string;gallery:{images:GalleryImage[];version:string};uploadAvailable:boolean}) {
  const [name,setName]=useState(initialName);
  const [description,setDescription]=useState(initialDescription);
  const [version,setVersion]=useState(initialVersion);
  const [message,setMessage]=useState('');
  const [pending,startTransition]=useTransition();
  const [saved,setSaved]=useState({name:initialName,description:initialDescription});
  const [photos,setPhotos]=useState<DraftPhoto[]>(()=>gallery.images.map(image=>({key:image.id,id:image.id,preview:`/api/blob-image/${image.id}?size=thumb`,primary:image.is_primary})));
  const [galleryVersion,setGalleryVersion]=useState(gallery.version);
  const [galleryDirty,setGalleryDirty]=useState(false);
  const uploaded=useRef(new Map<string,{id:string;at:number}>());
  const urls=useRef(new Set<string>());
  const dirty=galleryDirty||name!==saved.name||description!==saved.description;
  useEffect(()=>{
    const next=new Set(photos.filter(photo=>photo.file).map(photo=>photo.preview));
    for(const url of urls.current) if(!next.has(url)) URL.revokeObjectURL(url);
    urls.current=next;
  },[photos]);
  useEffect(()=>()=>{for(const url of urls.current) URL.revokeObjectURL(url);},[]);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};
    const guard=(event:MouseEvent)=>{
      if(dirty&&event.target instanceof Element&&event.target.closest('a[href]')&&!window.confirm('Sair sem salvar as alterações?')){event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener('beforeunload',warn);document.addEventListener('click',guard,true);
    return ()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',guard,true);};
  },[dirty]);
  return <form className="max-w-4xl border-y border-slate-200 py-5" onSubmit={event=>{
    event.preventDefault();setMessage('');startTransition(async()=>{
      try {
        if(!uploadAvailable&&photos.some(photo=>photo.file)){
          setMessage('As fotos estão apenas na prévia. O armazenamento não está conectado neste ambiente; nenhuma alteração foi salva.');return;
        }
        const ids:string[]=[];
        for(const [index,photo] of photos.entries()){
          if(photo.id){ids.push(photo.id);continue;}
          let cached=uploaded.current.get(photo.key);
          if(cached&&Date.now()-cached.at>45*60*1000) cached=undefined;
          if(!cached){
            setMessage(`Enviando foto ${index+1} de ${photos.length}...`);
            const data=new FormData();data.set('condominiumId',id);data.set('image',photo.file!);
            const result=await stageCondominiumImage(data);
            if(!result.ok||!result.id){setMessage(result.message);return;}
            cached={id:result.id,at:Date.now()};uploaded.current.set(photo.key,cached);
          }
          ids.push(cached.id);
        }
        setMessage('Salvando alterações...');
        const result=await saveCondominiumAction({id,version,name,description,gallery:{version:galleryVersion,ids,primaryId:ids[photos.findIndex(photo=>photo.primary)]??null}});
        if(result.ok){
          setVersion(result.version);setName(result.name);setDescription(result.description);setSaved({name:result.name,description:result.description});
          setGalleryVersion(result.gallery.version);setGalleryDirty(false);uploaded.current.clear();
          setPhotos(result.gallery.images.map(image=>({key:image.id,id:image.id,preview:`/api/blob-image/${image.id}?size=thumb`,primary:image.is_primary})));
          setMessage('Alterações salvas.');
        }
        else setMessage(result.message);
      } catch {setMessage('Falha de conexão. Confira o cadastro antes de tentar novamente.');}
    });
  }}>
    <fieldset disabled={pending} className="min-w-0 space-y-5">
      <label className="block text-sm">Nome do condomínio<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} className="mt-2 block w-full rounded border border-slate-300 bg-white p-3"/></label>
      <label className="block text-sm">Descrição<textarea maxLength={20000} rows={10} value={description} onChange={e=>setDescription(e.target.value)} className="mt-2 block w-full resize-y rounded border border-slate-300 bg-white p-3"/></label>
      <CatalogGallery title="Fotos das áreas comuns" subject="condomínio" photos={photos} onChange={next=>{setPhotos(next);setGalleryDirty(true);}} pending={pending} externalCount={0} uploadAvailable={uploadAvailable}/>
      <button disabled={!name.trim()||!dirty} className="rounded bg-emerald-800 px-4 py-3 text-white disabled:opacity-50">{pending?'Salvando...':'Salvar alterações'}</button>
    </fieldset>
    {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
  </form>;
}
