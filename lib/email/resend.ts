import { requireEnv } from "@/lib/env";

type SendLoginCodeInput = {
  to: string;
  code: string;
};

type SendUserInviteInput = {
  to: string;
  inviteUrl: string;
  role: "admin" | "cadastro";
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendLoginCodeEmail({ to, code }: SendLoginCodeInput) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.LOGIN_EMAIL_FROM ?? "CRM Inglaterra <login@imobiliariainglaterra.com.br>",
      to,
      subject: "Seu codigo de acesso ao CRM Inglaterra",
      html: `
        <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.5">
          <h1 style="font-size: 20px">Codigo de acesso</h1>
          <p>Use o codigo abaixo para entrar no CRM Inglaterra. Ele expira em 10 minutos.</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px">${code}</p>
          <p>Se voce nao solicitou este codigo, ignore este e-mail.</p>
        </div>
      `,
      text: `Seu codigo de acesso ao CRM Inglaterra e ${code}. Ele expira em 10 minutos.`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed with ${response.status}: ${body}`);
  }
}

export async function sendUserInviteEmail({ to, inviteUrl, role }: SendUserInviteInput) {
  const escapedInviteUrl = escapeHtml(inviteUrl);
  const escapedRole = escapeHtml(role);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.LOGIN_EMAIL_FROM ?? "CRM Inglaterra <login@imobiliariainglaterra.com.br>",
      to,
      subject: "Convite para o CRM Inglaterra",
      html: `
        <div style="font-family: Arial, sans-serif; color: #101828; line-height: 1.5">
          <h1 style="font-size: 20px">Convite para o CRM Inglaterra</h1>
          <p>Voce foi convidado para acessar o CRM Inglaterra com o papel ${escapedRole}.</p>
          <p>Use o link abaixo em ate 48 horas para aceitar o convite:</p>
          <p><a href="${escapedInviteUrl}">Aceitar convite</a></p>
          <p>Se voce nao esperava este convite, ignore este e-mail.</p>
        </div>
      `,
      text: `Voce foi convidado para acessar o CRM Inglaterra com o papel ${role}. Aceite em ate 48 horas: ${inviteUrl}`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed with ${response.status}: ${body}`);
  }
}
