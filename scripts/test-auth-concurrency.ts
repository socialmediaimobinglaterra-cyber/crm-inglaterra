import { randomInt } from "node:crypto";
import { hashLoginCode, verifyLoginCodeHash } from "@/lib/auth/codes";
import { consumeLoginCode, createLoginCode } from "@/lib/queries/auth";
import { sql } from "@/lib/db";

const testEmail = "socialmedia@imobiliariainglaterra.com.br";

function generateTestCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function main() {
  const code = generateTestCode();

  await createLoginCode(testEmail, hashLoginCode(testEmail, code));

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
}

main()
  .then(async () => {
    await sql.end();
  })
  .catch(async (error) => {
    await sql.end();
    console.error(error.message);
    process.exit(1);
  });
