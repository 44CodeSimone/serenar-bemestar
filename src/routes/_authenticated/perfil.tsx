import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, LogOut, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
});

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  birth_date: string | null;
  notes: string | null;
};

function Perfil() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (p) setProfile(p as Profile);
      else setProfile({ id: user.id, full_name: "", phone: "", whatsapp: "", birth_date: "", notes: "" });

      const { data: consents } = await supabase
        .from("user_consents")
        .select("consent_type, granted, revoked_at")
        .eq("user_id", user.id);
      if (consents) {
        setAiConsent(consents.some((c) => c.consent_type === "ai_memory" && c.granted && !c.revoked_at));
        setMarketingConsent(consents.some((c) => c.consent_type === "marketing" && c.granted && !c.revoked_at));
      }
      setLoading(false);
    })();
  }, [user.id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: profile.full_name,
      phone: profile.phone,
      whatsapp: profile.whatsapp,
      birth_date: profile.birth_date || null,
      notes: profile.notes,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function toggleConsent(type: "ai_memory" | "marketing", value: boolean) {
    if (type === "ai_memory") setAiConsent(value);
    else setMarketingConsent(value);

    if (value) {
      await supabase.from("user_consents").insert({
        user_id: user.id,
        consent_type: type,
        granted: true,
        user_agent: navigator.userAgent,
      });
    } else {
      // Revoga o mais recente
      const { data } = await supabase
        .from("user_consents")
        .select("id")
        .eq("user_id", user.id)
        .eq("consent_type", type)
        .eq("granted", true)
        .is("revoked_at", null);
      if (data && data.length) {
        await supabase.from("user_consents").update({ revoked_at: new Date().toISOString() }).in("id", data.map((d) => d.id));
      }
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (loading) return <div className="container-narrow py-24 text-center text-muted-foreground">Carregando…</div>;
  if (!profile) return null;

  return (
    <section className="container-narrow py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Sua área pessoal</p>
            <h1 className="display-serif text-5xl">Olá, <span className="italic text-sage">{(profile.full_name || user.email || "").split(" ")[0]}</span></h1>
            <p className="mt-3 text-muted-foreground">Personalize sua jornada de bem-estar no Serenar.</p>
          </div>
          <button onClick={signOut} className="btn-serena-outline text-xs">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>

        <form onSubmit={save} className="mt-10 space-y-5 rounded-[2rem] border border-border bg-card p-8 shadow-soft">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nome completo">
              <input className={inp} value={profile.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </Field>
            <Field label="Data de aniversário">
              <input type="date" className={inp} value={profile.birth_date || ""} onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <input className={inp} value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </Field>
            <Field label="WhatsApp">
              <input className={inp} value={profile.whatsapp || ""} onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })} />
            </Field>
          </div>
          <Field label="Observações (alergias, preferências, sensibilidades…)">
            <textarea rows={3} className={inp + " resize-none"} value={profile.notes || ""} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} />
          </Field>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Suas informações ficam seguras (LGPD).</p>
            <button className="btn-serena">
              {saved ? <><Check className="h-4 w-4" /> Salvo</> : "Salvar"}
            </button>
          </div>
        </form>

        <div className="mt-10 rounded-[2rem] border border-border bg-cream/60 p-8">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-5 w-5 text-gold" />
            <div>
              <h2 className="font-serif text-2xl text-sage-deep">Sua jornada personalizada</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Com seu consentimento, a Serenar e a Mariah podem lembrar preferências, sugerir horários ideais
                para retornar, e desejar coisas importantes como aniversário. Você pode revogar quando quiser.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <Consent
              label="Autorizo a IA Serenar a lembrar minhas conversas e preferências"
              hint="Isso permite recomendações personalizadas entre visitas."
              checked={aiConsent}
              onChange={(v) => toggleConsent("ai_memory", v)}
            />
            <Consent
              label="Quero receber comunicações do Serenar"
              hint="Promoções, novos rituais, mensagens de aniversário. Máximo 2 por mês."
              checked={marketingConsent}
              onChange={(v) => toggleConsent("marketing", v)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

const inp = "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-sage focus:ring-1 focus:ring-sage";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Consent({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 transition-colors hover:border-sage/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-border accent-[oklch(0.5_0.04_145)]"
      />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
    </label>
  );
}
