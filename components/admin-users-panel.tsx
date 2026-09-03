"use client";

import { useActionState } from "react";
import {
  changeUserRoleAction,
  changeUserStatusAction,
  inviteUserAction,
  resendInviteAction,
  revokeInviteAction,
  type AdminUserActionState,
} from "@/app/admin/users/actions";
import type { AdminUserListItem, PendingInviteListItem } from "@/lib/queries/users";

const initialState: AdminUserActionState = {
  message: "",
  error: "",
};

function ActionMessage({ state }: { state: AdminUserActionState }) {
  if (state.error) {
    return <p className="mt-3 text-sm font-medium text-red-700">{state.error}</p>;
  }

  if (state.message) {
    return <p className="mt-3 text-sm font-medium text-emerald-800">{state.message}</p>;
  }

  return null;
}

function SubmitButton({
  label,
  pendingLabel,
  pending,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  pending: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUserAction, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_180px_auto] md:items-end">
      <div>
        <label htmlFor="invite-email" className="text-sm font-medium text-slate-700">
          E-mail
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="nome@imobiliariainglaterra.com.br"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      <div>
        <label htmlFor="invite-role" className="text-sm font-medium text-slate-700">
          Papel
        </label>
        <select
          id="invite-role"
          name="role"
          defaultValue="cadastro"
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="cadastro">Cadastro</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Convidar"}
        </button>
      </div>
      <div className="md:col-span-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function RoleForm({ user, disabled }: { user: AdminUserListItem; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(changeUserRoleAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="userId" value={user.id} />
      <select
        name="role"
        defaultValue={user.role}
        disabled={disabled || pending}
        aria-label={`Papel de ${user.email}`}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        <option value="cadastro">Cadastro</option>
        <option value="admin">Admin</option>
      </select>
      <SubmitButton label="Salvar" pendingLabel="Salvando..." pending={pending} disabled={disabled} />
      <ActionMessage state={state} />
    </form>
  );
}

function StatusForm({ user, disabled }: { user: AdminUserListItem; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(changeUserStatusAction, initialState);
  const nextAction = user.ativo ? "deactivate" : "activate";

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="statusAction" value={nextAction} />
      <SubmitButton
        label={user.ativo ? "Desativar" : "Ativar"}
        pendingLabel={user.ativo ? "Desativando..." : "Ativando..."}
        pending={pending}
        disabled={disabled}
      />
      <ActionMessage state={state} />
    </form>
  );
}

function InviteActionForm({
  invite,
  action,
}: {
  invite: PendingInviteListItem;
  action: "resend" | "revoke";
}) {
  const [state, formAction, pending] = useActionState(
    action === "resend" ? resendInviteAction : revokeInviteAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="email" value={invite.email} />
      <SubmitButton
        label={action === "resend" ? "Reenviar" : "Revogar"}
        pendingLabel={action === "resend" ? "Reenviando..." : "Revogando..."}
        pending={pending}
      />
      <ActionMessage state={state} />
    </form>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminUsersPanel({
  users,
  pendingInvites,
  currentUserId,
}: {
  users: AdminUserListItem[];
  pendingInvites: PendingInviteListItem[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold text-slate-950">Convidar usuario</h2>
        <p className="mt-1 text-sm text-slate-600">
          Apenas e-mails da Imobiliaria Inglaterra podem acessar o CRM.
        </p>
        <div className="mt-4">
          <InviteForm />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-950">Usuarios</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 md:grid-cols-[1.5fr_120px_260px_220px]">
            <span>E-mail</span>
            <span>Status</span>
            <span>Papel</span>
            <span>Ativacao</span>
          </div>
          <div className="divide-y divide-slate-200">
            {users.map((user) => {
              const isCurrentUser = user.id === currentUserId;

              return (
                <div
                  key={user.id}
                  className="grid gap-4 px-5 py-4 text-sm md:grid-cols-[1.5fr_120px_260px_220px] md:items-start"
                >
                  <div>
                    <p className="font-medium text-slate-950">{user.email}</p>
                    {user.pending_invites > 0 ? (
                      <p className="mt-1 text-xs text-amber-700">Convite pendente</p>
                    ) : null}
                  </div>
                  <p className={user.ativo ? "font-medium text-emerald-800" : "font-medium text-slate-500"}>
                    {user.ativo ? "Ativo" : "Inativo"}
                  </p>
                  <RoleForm user={user} disabled={isCurrentUser} />
                  <StatusForm user={user} disabled={isCurrentUser && user.ativo} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-950">Convites pendentes</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {pendingInvites.length === 0 ? (
            <p className="px-5 py-5 text-sm text-slate-600">Nenhum convite pendente.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="grid gap-4 px-5 py-4 text-sm md:grid-cols-[1.5fr_120px_180px_220px_220px] md:items-start"
                >
                  <p className="font-medium text-slate-950">{invite.email}</p>
                  <p className="capitalize text-slate-700">{invite.role}</p>
                  <p className="text-slate-600">{formatDate(invite.expires_at)}</p>
                  <InviteActionForm invite={invite} action="resend" />
                  <InviteActionForm invite={invite} action="revoke" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
