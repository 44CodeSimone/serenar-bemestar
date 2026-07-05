import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { bootstrapAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const navigate = useNavigate();
  const claim = useServerFn(bootstrapAdmin);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user.id });
      setIsAdmin(Boolean(data));
      setChecking(false);
    })();
  }, [user.id]);

  if (checking) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <section className="container-narrow py-16">
        <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-10 text-center shadow-soft">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush text-gold">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-3xl text-sage-deep">Acesso restrito</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Você não tem permissão para acessar esta área.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Se você é a Mariah e este é o primeiro acesso ao painel, clique abaixo para
            assumir a titularidade como owner do Serenar.
          </p>
          {claimMsg && (
            <p className="mt-4 rounded-xl bg-blush px-4 py-2 text-sm text-sage-deep">{claimMsg}</p>
          )}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              disabled={claiming}
              onClick={async () => {
                setClaiming(true);
                setClaimMsg(null);
                try {
                  const res = await claim();
                  if (res.ok) {
                    setClaimMsg("Painel liberado! Redirecionando…");
                    setTimeout(() => window.location.reload(), 700);
                  } else {
                    setClaimMsg("Já existe uma titularidade definida. Peça acesso à Mariah.");
                  }
                } catch {
                  setClaimMsg("Não foi possível verificar agora. Tente novamente em instantes.");
                } finally {
                  setClaiming(false);
                }
              }}
              className="btn-serena"
            >
              {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assumir painel como Mariah"}
            </button>
            <button
              className="text-xs text-muted-foreground hover:text-sage-deep"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              Sair da conta
            </button>
            <button className="text-xs text-muted-foreground hover:text-sage-deep" onClick={() => navigate({ to: "/" })}>
              Voltar ao site
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="-mt-20 flex min-h-dvh pt-20">
      <AdminSidebar />
      <div className="flex-1 overflow-x-auto bg-background">
        <Outlet />
      </div>
    </div>
  );
}
