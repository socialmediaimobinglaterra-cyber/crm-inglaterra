"use server";
import { revalidatePath } from "next/cache";
import { getSessionFromCookie } from "@/lib/auth/session";
import { readCatalogEdit } from "@/lib/catalog/editor";
import { saveCatalogEdit } from "@/lib/queries/catalog";

export async function updateCatalog(_previous: { message: string; ok: boolean }, form: FormData) {
  const session = await getSessionFromCookie();
  if (!session) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  try {
    const id = form.get("id"), version = form.get("version");
    if (typeof id !== "string" || typeof version !== "string") throw new Error("INVALID_INPUT");
    await saveCatalogEdit(session.email, id, version, readCatalogEdit(form));
    revalidatePath("/catalog");
    revalidatePath(`/catalog/${id}`);
    return { ok: true, message: "Alterações salvas." };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { ok: false, message: code === "CATALOG_CONFLICT" ? "Este imóvel mudou desde a abertura. Recarregue a página antes de editar novamente." : code === "CATALOG_FORBIDDEN" ? "Seu acesso não está mais disponível." : "Não foi possível salvar. Confira os campos, use preços positivos e não inclua contatos nos textos. Se persistir, tente novamente." };
  }
}
