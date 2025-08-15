import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { ALLOWED_ROLES, DEFAULT_ROLE, Role } from "@/config/roles";
import type { User } from "@supabase/supabase-js";

type UserWithRole = User & {
  app_metadata: {
    role?: Role;
    [key: string]: unknown;
  };
};

export async function ensureDefaultRole(): Promise<{
  ok: boolean;
  role?: Role;
  changed?: boolean;
  reason?: string;
}> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: uerr,
  } = await supabase.auth.getUser();
  if (uerr || !user) return { ok: false, reason: "not-authenticated" };

  const current = (user as UserWithRole).app_metadata.role;

  if (current && (ALLOWED_ROLES as readonly string[]).includes(current)) {
    return { ok: true, role: current, changed: false };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { role: DEFAULT_ROLE },
  });
  if (error) return { ok: false, reason: error.message };

  await supabase.auth.refreshSession(); // ensure JWT now contains role
  return { ok: true, role: DEFAULT_ROLE, changed: true };
}
