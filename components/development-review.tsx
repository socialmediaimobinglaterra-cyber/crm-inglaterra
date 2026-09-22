'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmDevelopmentAction } from '@/app/catalog/developments/actions';
import type { DevelopmentCandidate, DevelopmentRecord } from '@/lib/catalog/developments';

export function DevelopmentReview({ items, records }: { items: DevelopmentCandidate[]; records: DevelopmentRecord[] }) {
  const [kind,setKind] = useState<'condominio'|'lancamento'>('condominio');
  const [selected,setSelected] = useState<string[]>([]);
  const [target,setTarget] = useState('');
  const [name,setName] = useState('');
  const [confirmed,setConfirmed] = useState(false);
  const [message,setMessage] = useState('');
  const [pending,startTransition] = useTransition();
  const router = useRouter();
  const choices = records.filter(r=>r.kind===kind && !r.ativo);
  const field = 'mt-1 block w-full rounded border border-slate-300 bg-white p-2.5';
  return <form onSubmit={event=>{
    event.preventDefault();
    if (!confirmed || !selected.length) return;
    startTransition(async()=>{
      try {
        const result = await confirmDevelopmentAction({kind,id:target || crypto.randomUUID(),existing:!!target,
          name:target ? choices.find(r=>r.id===target)?.nome : name,
          properties:items.filter(i=>selected.includes(i.id)).map(i=>({id:i.id,version:i.version}))});
        setMessage(result.message);
        if(result.ok) { setSelected([]); setConfirmed(false); router.refresh(); }
      } catch { setMessage('Falha de conexão. Atualize a página para conferir os vínculos antes de tentar novamente.'); }
    });
  }}>
    <fieldset disabled={pending} className="min-w-0">
      <label className="mb-4 block max-w-xs text-sm">Tipo de cadastro<select className={field} value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setSelected([]);setTarget('');setConfirmed(false);}}><option value="condominio">Condomínio</option><option value="lancamento">Lançamento</option></select></label>
      <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Selecionar','Imóvel','Condomínio / edifício na origem','Localização','Status comercial','Vínculo'].map(t=><th key={t} className="p-3 font-medium">{t}</th>)}</tr></thead><tbody>{items.map(item=>{
        const linked = kind==='condominio'?item.condominio_id:item.lancamento_id;
        return <tr key={item.id} className="border-t border-slate-200"><td className="p-3"><input type="checkbox" aria-label={`Selecionar ${item.codigo}`} disabled={!!linked} checked={selected.includes(item.id)} onChange={e=>{setSelected(e.target.checked?[...selected,item.id]:selected.filter(id=>id!==item.id));setConfirmed(false);}}/></td><td className="p-3"><Link className="text-emerald-800 underline" href={`/catalog/${item.id}`}>{item.codigo}</Link></td><td className="min-w-52 p-3"><p>{item.condominium || 'Não informado'}</p><p className="text-slate-600">{item.building || 'Edifício não informado'}</p></td><td className="p-3">{item.neighborhood}<p>{item.city} / {item.state}</p></td><td className="p-3">{item.commercial || 'Não informado'}</td><td className="p-3">{linked ? records.find(r=>r.id===linked && r.kind===kind)?.nome || 'Já vinculado' : 'Sem vínculo'}</td></tr>;
      })}</tbody></table>{!items.length&&<p className="p-6">Nenhum imóvel encontrado.</p>}</div>
      <div className="grid gap-4 border-b border-slate-200 py-5 sm:grid-cols-2">
        <label className="text-sm">Destino<select className={field} value={target} onChange={e=>{setTarget(e.target.value);setConfirmed(false);}}><option value="">Novo cadastro não publicado</option>{choices.map(r=><option key={r.id} value={r.id}>{r.nome} · {r.total} imóveis · {r.id.slice(0,8)}</option>)}</select></label>
        {!target&&<label className="text-sm">Nome do novo cadastro<input className={field} required maxLength={200} value={name} onChange={e=>{setName(e.target.value);setConfirmed(false);}}/></label>}
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input className="mt-1" type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo que os {selected.length} imóveis selecionados pertencem ao mesmo empreendimento.</label>
        <button disabled={!confirmed || !selected.length || (!target&&!name.trim())} className="justify-self-start rounded bg-emerald-800 px-4 py-3 text-white disabled:opacity-50">{pending?'Salvando...':'Confirmar vínculos'}</button>
      </div>
    </fieldset>
    {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
  </form>;
}
