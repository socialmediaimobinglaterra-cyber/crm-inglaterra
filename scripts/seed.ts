import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run seeds.");
}

const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  await sql`
    insert into usuarios (email, role, ativo)
    values ('socialmedia@imobiliariainglaterra.com.br', 'admin', true)
    on conflict (email) do update
      set role = excluded.role,
          ativo = excluded.ativo
  `;

  console.log("Seeded admin user socialmedia@imobiliariainglaterra.com.br");
}

main()
  .then(async () => {
    await sql.end();
  })
  .catch(async (error) => {
    await sql.end();
    console.error(error);
    process.exit(1);
  });
