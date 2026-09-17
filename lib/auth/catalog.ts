import { redirect } from "next/navigation";
import { getSessionFromCookie } from "./session";
import { getActiveUserByEmail } from "@/lib/queries/auth";
import { canEditCatalog } from "./roles";

export async function requireCatalogUser() {
  const session = await getSessionFromCookie();
  if (!session) redirect("/login");
  const user = await getActiveUserByEmail(session.email);
  if (!user || !canEditCatalog(user.role)) redirect("/login");
  return user;
}
