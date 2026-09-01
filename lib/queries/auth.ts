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

type VerifyLoginCodeHash = (email: string, codeHash: string) => boolean;

export async function consumeLoginCode(
  email: string,
  verifyLoginCodeHash: VerifyLoginCodeHash,
) {
  return sql.begin(async (tx) => {
    const codes = await tx<LoginCode[]>`
      select id, email, code_hash, expires_at, used_at, created_at
      from codigos_login
      where email = ${email}
        and used_at is null
      order by created_at desc
      limit 1
      for update
    `;
    const loginCode = codes[0];

    if (!loginCode || loginCode.used_at || loginCode.expires_at.getTime() <= Date.now()) {
      return false;
    }

    if (!verifyLoginCodeHash(loginCode.email, loginCode.code_hash)) {
      return false;
    }

    const consumed = await tx<{ id: string }[]>`
      update codigos_login
      set used_at = now()
      where id = ${loginCode.id}
        and used_at is null
        and expires_at > now()
      returning id
    `;

    return consumed.length === 1;
  });
}
