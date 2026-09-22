export type CondominiumSourceRow = {
  id: string; codigo: string; source_key: string | null; fonte_presente: boolean;
  condominio_id: string | null; nome: string; edificio: string; city: string; state: string;
  neighborhood: string; street: string; number: string; complement: string; postal_code: string;
  fingerprint: string;
};
export type CondominiumTarget = { id: string; nome: string; ativo: boolean };
export const matchingName = (value: string) => value.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');

export function planCondominiumBatch(rows: CondominiumSourceRow[], targets: CondominiumTarget[]) {
  const groups = new Map<string, CondominiumSourceRow[]>();
  const pending: {codigo:string; nome:string; reason:string}[] = [];
  let preserved = 0;
  for (const row of rows) {
    if (row.condominio_id) preserved++;
    const name = row.nome.trim() || row.edificio.trim();
    if (!name || !row.fonte_presente) {
      if (!row.condominio_id) pending.push({codigo:row.codigo,nome:name,reason:name?'Ausente na ultima importacao':'Sem nome de condominio ou edificio no XML'});
      continue;
    }
    const key = matchingName(name);
    groups.set(key,[...(groups.get(key) || []),row]);
  }
  const changes: {name:string; targetId:string|null; ids:string[]}[] = [];
  for(const [key,members] of groups) {
    const unlinked = members.filter(row=>!row.condominio_id);
    if (!unlinked.length) continue;
    const name = (members[0].nome.trim() || members[0].edificio.trim()).replace(/\s+/g,' ');
    const matches = targets.filter(t=>matchingName(t.nome)===key);
    const linkedIds = new Set(members.map(m=>m.condominio_id).filter(Boolean));
    const locations = new Set(members.map(m=>JSON.stringify([matchingName(m.city),matchingName(m.state)])));
    let reason = '';
    if (name.length>200) reason='Nome excede limite do cadastro';
    else if(members.some(m=>!m.city.trim() || !m.state.trim())) reason='Cidade ou UF ausente';
    else if(locations.size!==1) reason='Mesmo nome em cidades ou UFs diferentes';
    else if(new Set(members.map(m=>m.source_key)).size!==1) reason='Nome repetido em fontes diferentes';
    else if(matches.length>1 || linkedIds.size>1) reason='Mais de um cadastro existente para o nome';
    else if(linkedIds.size && (!matches.length || !linkedIds.has(matches[0].id))) reason='Vinculo revisado difere do nome XML';
    else if(matches[0]?.ativo) reason='Cadastro existente ativo exige revisao';
    // An existing name is not sufficient if it already owns properties outside this XML group.
    else if(matches[0] && rows.some(row=>row.condominio_id===matches[0].id &&
      (matchingName(row.nome.trim()||row.edificio.trim())!==key || matchingName(row.city)!==matchingName(members[0].city) || matchingName(row.state)!==matchingName(members[0].state)))) reason='Cadastro existente possui localizacao ou nome de origem diferente';
    if(reason) pending.push(...unlinked.map(row=>({codigo:row.codigo,nome:name,reason})));
    else changes.push({name,targetId:matches[0]?.id || null,ids:unlinked.map(row=>row.id).sort()});
  }
  return {changes,pending,preserved};
}
