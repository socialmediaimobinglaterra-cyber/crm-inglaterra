import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

  const migrationName = "001_auth.sql";
  const alreadyApplied = await sql<{ name: string }[]>`
    select name from schema_migrations where name = ${migrationName}
  `;

  if (alreadyApplied.length === 0) {
    const migration = await readFile(join(process.cwd(), "migrations", migrationName), "utf8");
    await sql.unsafe(migration);
    await sql`insert into schema_migrations (name) values (${migrationName})`;
    console.log(`Applied ${migrationName}`);
  } else {
    console.log(`${migrationName} already applied`);
  }
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
