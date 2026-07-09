import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side check that the current bearer-authenticated user has the admin
 * or owner role. Used to gate the /admin route before rendering any UI shell.
 * Uses the service-role client so the check does not depend on client EXECUTE
 * grants on the `is_admin` / `has_role` helpers.
 */
export const checkCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("check_failed");
    return { isAdmin: Boolean(data) };
  });

/**
 * Bootstrap seguro: promove o usuário atual a "owner" apenas se ainda
 * não existir nenhum owner ou admin no sistema. Uma única execução — depois disso
 * novos papéis só podem ser atribuídos por um owner via banco de dados.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .in("role", ["owner", "admin"]);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      return { ok: false, reason: "already_exists" as const };
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "owner" });
    if (error) throw new Error(error.message);
    return { ok: true, reason: "granted" as const };
  });

/** Estatísticas do dashboard. */
export const adminDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [apptTodayRes, apptTotalRes, leadsNewRes, leadsTotalRes, aiConvRes] = await Promise.all([
      context.supabase.from("appointments").select("id", { count: "exact", head: true }).eq("preferred_date", today),
      context.supabase.from("appointments").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
      context.supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "novo"),
      context.supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
      context.supabase.from("ai_conversations").select("id", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
    ]);

    const { data: topServices } = await context.supabase
      .from("appointments")
      .select("service")
      .gte("created_at", monthStart.toISOString());

    const counts = new Map<string, number>();
    (topServices ?? []).forEach((r) => {
      counts.set(r.service, (counts.get(r.service) ?? 0) + 1);
    });
    const topServicesRanked = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([service, count]) => ({ service, count }));

    return {
      appointmentsToday: apptTodayRes.count ?? 0,
      appointmentsMonth: apptTotalRes.count ?? 0,
      leadsNew: leadsNewRes.count ?? 0,
      leadsMonth: leadsTotalRes.count ?? 0,
      aiConversationsMonth: aiConvRes.count ?? 0,
      topServices: topServicesRanked,
    };
  });
