"use server";

import { revalidatePath } from 'next/cache';
import { getSessionFromCookie } from '@/lib/auth/session';
import { requireActiveAdminByEmail } from '@/lib/queries/users';
import { createImageBatch, getImageBatchStatus } from '@/lib/queries/catalog-image-batches';
import { readImageBatch } from '@/lib/catalog/image-batches';
import { catalogIdSchema } from '@/lib/catalog/editor';
import { imageStorageConfigured } from '@/lib/catalog/image-storage';
import { migrateBatchImage } from '@/lib/catalog/image-batch-service';

async function actor() {
  const session=await getSessionFromCookie();
  if(!session||!await requireActiveAdminByEmail(session.email)) throw new Error('PILOT_FORBIDDEN');
  return session.email;
}

export async function prepareImageBatch(form:FormData) {
  try {
    const email=await actor();
    const id=await createImageBatch(email,readImageBatch(form));
    revalidatePath('/admin/image-migration');
    return {id,message:''};
  } catch(error) {
    const messages:Record<string,string>={
      PROPERTY_NOT_FOUND:'Imóvel não encontrado.',
      NO_PENDING_IMAGES:'Não há novas fotos disponíveis. Confira os lotes anteriores e eventuais falhas.',
      EXTERNAL_IMAGE_URL:'Há uma origem de imagem não permitida. O lote não foi criado.',
      IMAGE_LIMIT:'Limite de imagens atingido. Revisão necessária.',
    };
    return {id:null,message:error instanceof Error?messages[error.message]??'Não foi possível preparar o lote. Confira os dados e seu acesso.':'Não foi possível preparar o lote.'};
  }
}

export async function transferNextBatchImage(form:FormData) {
  try {
    const email=await actor();
    const id=catalogIdSchema.parse(form.get('id'));
    if(!imageStorageConfigured()) return {status:'unavailable' as const,message:'Armazenamento indisponível neste ambiente.',batch:null};
    const result=await migrateBatchImage(email,id);
    const batch=await getImageBatchStatus(email,id);
    revalidatePath('/admin/image-migration');
    revalidatePath(`/catalog/${batch.propertyId}`);
    return {status:result.status,message:result.status==='failed'?'Transferência interrompida. Confira a falha antes de retomar.':result.status==='idle'?'Nenhuma transferência iniciada. Confira o progresso ou aguarde a operação em andamento.':'Foto transferida.',batch};
  } catch {
    return {status:'failed' as const,message:'Não foi possível continuar. Atualize o progresso e confira seu acesso.',batch:null};
  }
}
