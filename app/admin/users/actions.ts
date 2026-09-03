"use server";

import { revalidatePath } from "next/cache";
import { getRequestContext } from "@/lib/auth/request-ip";
import { getSessionFromCookie } from "@/lib/auth/session";
import { createUserInvite, resendUserInvite, revokeUserInvite } from "@/lib/queries/invites";
import { changeUserRole, changeUserStatus, isUsuarioRole, validateInviteInput, validateUserId } from "@/lib/queries/users";

export type AdminUserActionState = {
  message: string;
  error: string;
};

const emptyState: AdminUserActionState = {
  message: "",
  error: "",
};

function textField(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function success(message: string) {
  revalidatePath("/admin/users");
  return { message, error: "" };
}

function failure(error: string) {
  return { message: "", error };
}

async function requireActorEmail() {
  const session = await getSessionFromCookie();

  if (!session) {
    throw new Error("ADMIN_REQUIRED");
  }

  return session.email;
}

function adminMessageForError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "APP_URL_REQUIRED" || message === "APP_URL is required." || message.includes("APP_URL")) {
    return "Configure APP_URL para enviar convites.";
  }

  if (message === "INVALID_USER_EMAIL_DOMAIN" || message === "INVALID_INVITE_EMAIL_DOMAIN") {
    return "Use apenas e-mails @imobiliariainglaterra.com.br.";
  }

  if (message === "INVALID_USER_ROLE" || message === "INVALID_INVITE_ROLE") {
    return "Selecione um papel valido.";
  }

  if (message === "INVALID_USER_ID") {
    return "Usuario invalido.";
  }

  if (message === "INVALID_STATUS_ACTION") {
    return "Acao de status invalida.";
  }

  if (message === "INVITE_TARGET_ALREADY_ACTIVE") {
    return "Este usuario ja esta ativo. Ajuste papel ou status pela lista de usuarios.";
  }

  if (message === "SELF_ROLE_CHANGE_BLOCKED") {
    return "Voce nao pode alterar o proprio papel.";
  }

  if (message === "SELF_DEACTIVATION_BLOCKED") {
    return "Voce nao pode desativar a propria conta.";
  }

  if (message === "LAST_ACTIVE_ADMIN_PROTECTED") {
    return "O ultimo administrador ativo deve ser preservado.";
  }

  if (message === "ADMIN_REQUIRED" || message === "INVITE_ADMIN_REQUIRED") {
    return "Apenas administradores ativos podem executar esta acao.";
  }

  if (message === "USER_NOT_FOUND") {
    return "Usuario nao encontrado.";
  }

  return "Nao foi possivel concluir a acao.";
}

export async function inviteUserAction(
  _previousState: AdminUserActionState = emptyState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const actorEmail = await requireActorEmail();
    const requestContext = await getRequestContext();
    const invite = validateInviteInput(textField(formData, "email"), textField(formData, "role"));

    await createUserInvite({
      actorEmail,
      email: invite.email,
      role: invite.role,
      requestContext,
    });

    return success("Convite enviado.");
  } catch (error) {
    return failure(adminMessageForError(error));
  }
}

export async function resendInviteAction(
  _previousState: AdminUserActionState = emptyState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const actorEmail = await requireActorEmail();
    const requestContext = await getRequestContext();

    await resendUserInvite({
      actorEmail,
      email: textField(formData, "email"),
      requestContext,
    });

    return success("Convite reenviado.");
  } catch (error) {
    return failure(adminMessageForError(error));
  }
}

export async function revokeInviteAction(
  _previousState: AdminUserActionState = emptyState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const actorEmail = await requireActorEmail();
    const requestContext = await getRequestContext();

    await revokeUserInvite({
      actorEmail,
      email: textField(formData, "email"),
      requestContext,
    });

    return success("Convite revogado.");
  } catch (error) {
    return failure(adminMessageForError(error));
  }
}

export async function changeUserRoleAction(
  _previousState: AdminUserActionState = emptyState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const actorEmail = await requireActorEmail();
    const requestContext = await getRequestContext();

    await changeUserRole({
      actorEmail,
      targetUserId: validateUserId(textField(formData, "userId")),
      role: parseRole(textField(formData, "role")),
      requestContext,
    });

    return success("Papel atualizado.");
  } catch (error) {
    return failure(adminMessageForError(error));
  }
}

function parseRole(value: string) {
  if (!isUsuarioRole(value)) {
    throw new Error("INVALID_USER_ROLE");
  }

  return value;
}

function parseStatusAction(value: string) {
  if (value !== "activate" && value !== "deactivate") {
    throw new Error("INVALID_STATUS_ACTION");
  }

  return value;
}

export async function changeUserStatusAction(
  _previousState: AdminUserActionState = emptyState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const actorEmail = await requireActorEmail();
    const requestContext = await getRequestContext();
    const action = parseStatusAction(textField(formData, "statusAction"));

    await changeUserStatus({
      actorEmail,
      targetUserId: validateUserId(textField(formData, "userId")),
      ativo: action === "activate",
      requestContext,
    });

    return success(action === "activate" ? "Usuario ativado." : "Usuario desativado.");
  } catch (error) {
    return failure(adminMessageForError(error));
  }
}
