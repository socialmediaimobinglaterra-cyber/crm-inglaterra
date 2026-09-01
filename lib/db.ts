import postgres from "postgres";
import { requireEnv } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var crmSql: postgres.Sql | undefined;
}

function createClient() {
  return postgres(requireEnv("DATABASE_URL"), {
    max: 5,
    prepare: false,
  });
}

function getClient() {
  if (!globalThis.crmSql) {
    globalThis.crmSql = createClient();
  }

  return globalThis.crmSql;
}

export const sql = new Proxy(function sqlTag() {} as unknown as postgres.Sql, {
  apply(_target, thisArg, argArray) {
    return Reflect.apply(getClient(), thisArg, argArray);
  },
  get(_target, property) {
    return Reflect.get(getClient(), property);
  },
}) as postgres.Sql;
