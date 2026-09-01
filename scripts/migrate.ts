import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined });
const migrationsDir = join(process.cwd(), "migrations");
const migrationLockKey = 91_491_001;

async function main() {
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, "en-US"));

  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${migrationLockKey})`;

    await tx`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const appliedRows = await tx<{ name: string }[]>`
      select name from schema_migrations
    `;
    const appliedMigrations = new Set(appliedRows.map((row) => row.name));

    for (const migrationName of migrationFiles) {
      if (appliedMigrations.has(migrationName)) {
        console.log(`${migrationName} already applied`);
        continue;
      }

      const migration = await readFile(join(migrationsDir, migrationName), "utf8");
      await tx.unsafe(migration);
      await tx`insert into schema_migrations (name) values (${migrationName})`;
      appliedMigrations.add(migrationName);
      console.log(`Applied ${migrationName}`);
    }
  });
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
