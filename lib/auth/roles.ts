export type UserRole = "admin" | "cadastro" | "corretor";

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "cadastro" || value === "corretor";
}

export function canEditCatalog(role: unknown): role is UserRole {
  return isUserRole(role);
}

// Publication operations must check the active user's database role, not the cookie.
export function canPublishCatalog(role: unknown) {
  return role === "admin" || role === "cadastro";
}
