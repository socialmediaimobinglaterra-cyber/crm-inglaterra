"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "@/app/accept-invite/actions";

const initialState = {
  error: "",
};

type AcceptInviteFormProps = {
  disabled?: boolean;
};

export function AcceptInviteForm({ disabled = false }: AcceptInviteFormProps) {
  const [state, formAction, pending] = useActionState(acceptInviteAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error ? <p className="text-sm font-medium text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending || disabled}
        className="w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Aceitando..." : "Aceitar convite"}
      </button>
    </form>
  );
}
