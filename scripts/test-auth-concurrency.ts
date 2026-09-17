import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { hashLoginCode, verifyLoginCodeHash } from "@/lib/auth/codes";
import { consumeLoginCode, createLoginCode } from "@/lib/queries/auth";
import { sql } from "@/lib/db";

const testEmail = `concurrency-${randomUUID()}@imobiliariainglaterra.com.br`;

function generateTestCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function main() {
  try {
  const codes = Array.from({ length: 5 }, generateTestCode);
  await Promise.all(codes.map((value) => createLoginCode(testEmail, hashLoginCode(testEmail, value))));
  const rows = await sql<{ code_hash: string }[]>`
    select code_hash from codigos_login
    where email = ${testEmail} and used_at is null and invalidated_at is null
  `;
  assert.equal(rows.length, 1, "Concurrent issuance must leave exactly one unused code");
  const code = codes.find((value) => verifyLoginCodeHash(testEmail, value, rows[0].code_hash));
  assert.ok(code);

  const attempts = await Promise.all([
    consumeLoginCode(testEmail, (email, codeHash) => verifyLoginCodeHash(email, code, codeHash)),
    consumeLoginCode(testEmail, (email, codeHash) => verifyLoginCodeHash(email, code, codeHash)),
  ]);

  const successCount = attempts.filter(Boolean).length;
  const rejectedCount = attempts.filter((attempt) => !attempt).length;

  console.log(
    JSON.stringify(
      {
        concurrentAttempts: attempts.length,
        concurrentIssuanceLeavesOneCode: rows.length === 1,
        successCount,
        rejectedCount,
        exactlyOneSucceeded: successCount === 1 && rejectedCount === 1,
      },
      null,
      2,
    ),
  );

  if (successCount !== 1 || rejectedCount !== 1) {
    throw new Error("Expected exactly one concurrent login code consumption to succeed.");
  }
  } finally {
    await sql`delete from codigos_login where email = ${testEmail}`;
    const rows = await sql<{ count: number }[]>`select count(*)::int as count from codigos_login where email = ${testEmail}`;
    assert.equal(rows[0].count, 0, "Temporary codes must be removed");
  }
}

main()
  .then(async () => {
    await sql.end();
  })
  .catch(async () => {
    await sql.end();
    console.error("Authentication concurrency test failed; sensitive details omitted.");
    process.exit(1);
  });
