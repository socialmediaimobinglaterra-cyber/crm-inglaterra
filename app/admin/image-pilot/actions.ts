"use server";
import { getSessionFromCookie } from '@/lib/auth/session';
import { imagePilotPropertyId } from '@/lib/catalog/image-pilot';
import { imageStorageConfigured } from '@/lib/catalog/image-storage';
import { migratePilotImage } from '@/lib/catalog/image-pilot-service';
import { revalidatePath } from 'next/cache';

export async function migrateNextPilotImage(_previous:{message:string},_form:FormData) {
  try {
    const session=await getSessionFromCookie();
    if(!session) return {message:'Sua sessão expirou. Entre novamente.'};
    if(!imageStorageConfigured()) return {message:'Armazenamento indisponível neste ambiente. Nenhuma foto transferida.'};
    const result=await migratePilotImage(session.email,imagePilotPropertyId);
    revalidatePath('/admin/image-pilot');
    revalidatePath(`/catalog/${imagePilotPropertyId}`);
    return {message:result.status==='done'?'Foto transferida.':result.status==='failed'?'Não foi possível transferir a foto. Tente novamente.':'Nenhuma foto disponível para esta tentativa. Confira o progresso.'};
  } catch { return {message:'Não foi possível executar o piloto. Confira seu acesso e tente novamente.'}; }
}
