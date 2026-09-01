import { requireEnv } from "@/lib/env";

type SendLoginCodeInput = {
  to: string;
  code: string;
};

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
