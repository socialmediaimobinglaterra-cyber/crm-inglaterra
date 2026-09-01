"use client";

import { useActionState } from "react";
import type { LoginActionState } from "@/app/login/actions";
import { requestLoginCode, verifyLoginCode } from "@/app/login/actions";

const initialState: LoginActionState = {
  step: "email",
  email: "",
  message: "",
};

export function LoginForm() {
  const [emailState, requestCodeAction, requestingCode] = useActionState(requestLoginCode, initialState);
  const codeInitialState: LoginActionState = {
    step: "code",
    email: emailState.email,
    message: emailState.message,
  };
  const [codeState, verifyCodeAction, verifyingCode] = useActionState(verifyLoginCode, codeInitialState);
  const activeState = codeState.error || codeState.message ? codeState : emailState;
  const email = activeState.email || emailState.email;

  if (activeState.step === "code" || emailState.step === "code") {
    return (
      <form action={verifyCodeAction} className="space-y-5">
        <input type="hidden" name="email" value={email} />
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-slate-800">
            Codigo de 6 digitos
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-lg tracking-[0.25em] outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
            required
          />
        </div>
        {activeState.message ? <p className="text-sm text-slate-600">{activeState.message}</p> : null}
        {activeState.error ? <p className="text-sm font-medium text-red-700">{activeState.error}</p> : null}
        <button
          type="submit"
          disabled={verifyingCode}
          className="w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifyingCode ? "Validando..." : "Entrar"}
        </button>
        <button
          formAction={requestCodeAction}
          formNoValidate
          name="email"
          value={email}
          disabled={requestingCode}
          className="w-full rounded-md border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reenviar codigo
        </button>
      </form>
    );
  }

  return (
    <form action={requestCodeAction} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-800">
          E-mail corporativo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
          required
        />
      </div>
      {activeState.error ? <p className="text-sm font-medium text-red-700">{activeState.error}</p> : null}
      <button
        type="submit"
        disabled={requestingCode}
        className="w-full rounded-md bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {requestingCode ? "Enviando..." : "Receber codigo"}
      </button>
    </form>
  );
}
