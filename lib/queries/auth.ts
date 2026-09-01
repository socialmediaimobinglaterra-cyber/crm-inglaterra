import { sql } from "@/lib/db";

export type Usuario = {
  id: string;
  email: string;
  role: "admin" | "cadastro";
  ativo: boolean;
  created_at: Date;
};

export type LoginCode = {
  id: string;
  email: string;
  code_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
};

export async function getActiveUserByEmail(email: string) {
  const users = await sql<Usuario[]>`
    select id, email, role, ativo, created_at
    from usuarios
    where email = ${email}
      and ativo = true
    limit 1
  `;

  return users[0] ?? null;
}

export async function createLoginCode(email: string, codeHash: string) {
  await sql.begin(async (tx) => {
    await tx`
      update codigos_login
      set used_at = now()
      where email = ${email}
        and used_at is null
    `;

    await tx`
      insert into codigos_login (email, code_hash, expires_at)
      values (${email}, ${codeHash}, now() + interval '10 minutes')
    `;
  });
}

export async function getLatestUsableLoginCode(email: string) {
  const codes = await sql<LoginCode[]>`
    select id, email, code_hash, expires_at, used_at, created_at
    from codigos_login
    where email = ${email}
      and used_at is null
    order by created_at desc
    limit 1
  `;

  return codes[0] ?? null;
}

export async function markLoginCodeUsed(id: string) {
  await sql`
    update codigos_login
    set used_at = now()
    where id = ${id}
  `;
}
