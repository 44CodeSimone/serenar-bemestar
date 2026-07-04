import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Promove o usuário atual a admin — apenas se ainda não existir nenhum admin.
 * Bootstrap seguro para o primeiro dono do painel.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      return { ok: false, reason: "already_exists" as const };
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true, reason: "granted" as const };
  });

/** Estatísticas do dashboard. */
export const adminDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

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
