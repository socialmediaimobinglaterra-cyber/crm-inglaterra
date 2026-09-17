"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { updateCatalog } from "@/app/catalog/[id]/actions";
import { createCatalog } from "@/app/catalog/new/actions";
import { propertyTypes } from "@/lib/catalog/property-types";
import type { CatalogEdit } from "@/lib/catalog/editor";
import { CatalogGallery, type DraftPhoto } from './catalog-gallery';
import type { GalleryImage } from '@/lib/queries/catalog-images';
import { stageCatalogImage } from '@/app/catalog/[id]/image-actions';
import { readCatalogEdit } from '@/lib/catalog/editor';
import type { PublicationDraft } from '@/lib/catalog/publication';

export function CatalogEditor({ id, version, values, mode = "edit", gallery, publication }: { id: string; version: string; values: CatalogEdit; mode?: "create" | "edit"; gallery?: {images:GalleryImage[];version:string;externalCount:number;uploadAvailable:boolean}; publication?: PublicationDraft & {canPublish:boolean} }) {
  const [publicationUnits,setPublicationUnits]=useState(publication?.units??[]);
  const [photos,setPhotos]=useState<DraftPhoto[]>(()=>gallery?.images.map(image=>({key:image.id,id:image.id,preview:`/api/blob-image/${image.id}?size=thumb`,primary:image.is_primary}))??[]);
  const uploaded=useRef(new Map<string,{id:string;at:number}>());
  const urls=useRef(new Set<string>());
  const [progress,setProgress]=useState('');
  useEffect(()=>{
    const next=new Set(photos.filter(photo=>photo.file).map(photo=>photo.preview));
    for(const url of urls.current) if(!next.has(url)) URL.revokeObjectURL(url);
    urls.current=next;
  },[photos]);
  useEffect(()=>()=>{for(const url of urls.current) URL.revokeObjectURL(url);},[]);
  const [state, action, pending] = useActionState(async(previous:{ok:boolean;message:string},form:FormData)=>{
    if(mode==='create') return createCatalog(previous,form);
    try {
      readCatalogEdit(form);
      if(gallery&&!gallery.uploadAvailable&&photos.some(photo=>photo.file)) return {ok:false,message:'As fotos estão apenas na prévia. O armazenamento não está conectado neste ambiente; nenhuma alteração foi salva.'};
      const ids:string[]=[];
      for(const [index,photo] of photos.entries()) {
        if(photo.id) {ids.push(photo.id);continue;}
        let cached=uploaded.current.get(photo.key);
        if(cached&&Date.now()-cached.at>45*60*1000) cached=undefined;
        if(!cached) {
          setProgress(`Enviando foto ${index+1} de ${photos.length}...`);
          const data=new FormData();data.set('propertyId',id);data.set('image',photo.file!);
          const result=await stageCatalogImage(data);
          if(!result.ok||!result.id) return {ok:false,message:result.message};
          cached={id:result.id,at:Date.now()};uploaded.current.set(photo.key,cached);
        }
        ids.push(cached.id);
      }
      if(gallery) form.set('gallery',JSON.stringify({version:gallery.version,ids,primaryId:ids[photos.findIndex(photo=>photo.primary)]??null}));
      if(publication?.canPublish && ['premium','matriz'].some(unit=>publicationUnits.includes(unit as 'premium'|'matriz')!==publication.units.includes(unit as 'premium'|'matriz'))) {
        form.set('publication',JSON.stringify({version:publication.version,units:publicationUnits}));
      }
      setProgress('Salvando alterações...');
      const result=await updateCatalog(previous,form);
      if(result.ok) {
        setPhotos(photos.map((photo,index)=>({key:ids[index],id:ids[index],preview:`/api/blob-image/${ids[index]}?size=thumb`,primary:photo.primary})));
        uploaded.current.clear();
      }
      return result;
    } catch {return {ok:false,message:'Não foi possível concluir. Confira os campos e a conexão. As alterações foram mantidas nesta tela.'};}
    finally {setProgress('');}
  }, { ok: false, message: "" });
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if(state.ok) setDirty(false); }, [state]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if(dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    const guardLink = (event: MouseEvent) => {
      if (dirty && event.target instanceof Element && event.target.closest('a[href]') && !window.confirm('Sair sem salvar as alterações?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    document.addEventListener('click', guardLink, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener('click', guardLink, true); };
  }, [dirty]);
  const fieldClass = "mt-1 w-full rounded border border-slate-300 bg-white p-2.5";
  return <form action={action} onReset={event => event.preventDefault()} onChange={() => setDirty(true)} className="max-w-4xl">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={version} />
    <fieldset disabled={pending} className="disabled:opacity-60">
      <section className="border-b border-slate-200 py-6"><h2 className="mb-4 text-lg font-semibold">Classificação</h2><div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">Tipo<select name="type" required defaultValue={values.taxonomy?.normalizedType ?? ""} className={fieldClass}><option value="">Selecione</option>{propertyTypes.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label>
        <label className="text-sm">Subtipo<input name="subtype" maxLength={120} defaultValue={values.taxonomy?.normalizedSubtype ?? ""} className={fieldClass} /></label>
        <label className="text-sm">Categoria de uso<select name="usageCategory" required defaultValue={values.usageCategory ?? ""} className={fieldClass}><option value="">Selecione</option>{[['residencial','Residencial'],['comercial','Comercial'],['rural','Rural'],['industrial','Industrial'],['corporativa','Corporativa'],['unknown','Não definida']].map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div></section>
      <section className="border-b border-slate-200 py-6"><h2 className="mb-4 text-lg font-semibold">Apresentação</h2>
        <label className="block text-sm">Título<input name="title" maxLength={512} defaultValue={values.title ?? ""} className={fieldClass} /></label>
        <label className="mt-4 block text-sm">Descrição<textarea name="description" maxLength={5000} rows={7} defaultValue={values.description ?? ""} className={fieldClass} /></label>
      </section>
      <section className="border-b border-slate-200 py-6"><h2 className="mb-4 text-lg font-semibold">Localização pública</h2><div className="grid gap-4 sm:grid-cols-2">
        {([['neighborhood','Bairro oficial',values.publicLocation?.officialNeighborhood],['alias','Bairro alternativo',values.publicLocation?.neighborhoodAlias],['city','Cidade',values.publicLocation?.city]] as const).map(([key,label,value]) => <label key={key} className="text-sm">{label}<input name={key} required={key !== 'alias'} maxLength={200} defaultValue={value ?? ''} className={fieldClass} /></label>)}
        <label className="text-sm">UF<select name="state" required defaultValue={values.publicLocation?.state ?? ''} className={fieldClass}><option value="">Selecione</option>{'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(uf => <option key={uf}>{uf}</option>)}</select></label>
      </div></section>
      <section className="border-b border-slate-200 py-6"><h2 className="mb-4 text-lg font-semibold">Endereço privado</h2><div className="grid gap-4 sm:grid-cols-2">
        {([['street','Logradouro'],['number','Número'],['complement','Complemento'],['postalCode','CEP']] as const).map(([key,label]) => <label key={key} className="text-sm">{label}<input name={key} maxLength={key === 'postalCode' ? 9 : 200} defaultValue={values.privateLocation?.[key] ?? ''} className={fieldClass} /></label>)}
        {(['latitude','longitude'] as const).map(key => <label key={key} className="text-sm">{key === 'latitude' ? 'Latitude' : 'Longitude'}<input name={key} inputMode="decimal" maxLength={40} defaultValue={values.privateLocation?.coordinates?.[key] ?? ''} className={fieldClass} /></label>)}
      </div></section>
      <section className="border-b border-slate-200 py-6"><h2 className="mb-4 text-lg font-semibold">Valores</h2><div className="grid gap-4 sm:grid-cols-2">{([['sale','Venda'],['rent','Locação'],['condominium','Condomínio'],['iptu','IPTU']] as const).map(([key,label]) => <label key={key} className="text-sm">{label} (R$)<input name={key} inputMode="decimal" maxLength={40} defaultValue={values.prices[key] ?? ""} className={fieldClass} /></label>)}</div></section>
      <section className="border-b border-slate-200 py-6"><h2 className="mb-4 text-lg font-semibold">Áreas</h2><div className="grid gap-4 sm:grid-cols-4"><label className="text-sm">Unidade<select name="unit" defaultValue={values.areas.unit ?? ""} className={fieldClass}><option value="">Não informada</option><option value="m2">m²</option><option value="ha">ha</option></select></label>{([['total','Total'],['usable','Útil'],['private','Privativa']] as const).map(([key,label]) => <label key={key} className="text-sm">{label}<input name={key} inputMode="decimal" maxLength={40} defaultValue={values.areas[key] ?? ""} className={fieldClass} /></label>)}</div></section>
      <section className="py-6"><h2 className="mb-4 text-lg font-semibold">Ambientes</h2><div className="grid grid-cols-2 gap-4 sm:grid-cols-5">{([['bedrooms','Dormitórios'],['suites','Suítes'],['bathrooms','Banheiros'],['livingRooms','Salas'],['parkingSpaces','Vagas']] as const).map(([key,label]) => <label key={key} className="text-sm">{label}<input name={key} type="number" min={0} max={999999} step={1} defaultValue={values.rooms[key] ?? ""} className={fieldClass} /></label>)}</div></section>
      {gallery&&<CatalogGallery photos={photos} onChange={next=>{setPhotos(next);setDirty(true);}} pending={pending} externalCount={gallery.externalCount} uploadAvailable={gallery.uploadAvailable}/>}
      {publication&&<section className="border-t border-slate-200 py-6">
        <h2 className="mb-4 text-lg font-semibold">Publicação por unidade</h2>
        <div className="flex flex-wrap gap-6">{(['premium','matriz'] as const).map(unit=><label key={unit} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publicationUnits.includes(unit)} disabled={!publication.canPublish} onChange={event=>setPublicationUnits(current=>event.target.checked?[...current,unit]:current.filter(value=>value!==unit))} className="h-4 w-4 accent-emerald-800"/>
          {unit==='premium'?'Inglaterra Premium':'Imobiliária Inglaterra (Matriz)'}
        </label>)}</div>
      </section>}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-slate-200 bg-white py-5"><button disabled={!dirty || pending} className="rounded bg-emerald-800 px-5 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Salvando..." : mode === 'create' ? 'Cadastrar imóvel' : "Salvar alterações"}</button><p role="status" className={state.ok ? "text-emerald-800" : "text-red-700"}>{pending?progress:state.message}</p></div>
    </fieldset>
  </form>;
}
