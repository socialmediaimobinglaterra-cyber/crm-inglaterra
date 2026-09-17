"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionFromCookie } from "@/lib/auth/session";
import { readCatalogEdit } from "@/lib/catalog/editor";
import { createManualCatalog } from "@/lib/queries/catalog";

export async function createCatalog(_previous: { ok: boolean; message: string }, form: FormData) {
  const session = await getSessionFromCookie();
  if (!session) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  let id: string;
  try {
    const requestId = form.get("id");
    if (typeof requestId !== 'string') throw new Error('INVALID_INPUT');
    id = await createManualCatalog(session.email, requestId, readCatalogEdit(form));
  } catch {
    return { ok: false, message: "Não foi possível cadastrar. Confira título, tipo, localização e preços positivos. Se persistir, tente novamente." };
  }
  revalidatePath('/catalog');
  redirect(`/catalog/${id}`);
}
