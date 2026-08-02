import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/whatsapp")({
  ssr: false,
  component: AdminWhatsapp,
});

type Group = {
  active: boolean;
  title: string;
  description: string;
  cta: string;
  link: string;
  show_on_home: boolean;
  show_on_contact: boolean;
};

const DEFAULTS: Group = {
  active: false,
  title: "Entre no nosso grupo do WhatsApp",
  description: "Receba dicas de autocuidado, novidades e horários especiais direto no seu celular.",
  cta: "Entrar no grupo",
  link: "",
  show_on_home: true,
  show_on_contact: true,
};

function AdminWhatsapp() {
  const [group, setGroup] = useState<Group>(DEFAULTS);
  const [waLink, setWaLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", ["whatsapp_group", "contact"]);
      (data ?? []).forEach((r) => {
        if (r.key === "whatsapp_group") setGroup({ ...DEFAULTS, ...(r.value as Partial<Group>) });
        if (r.key === "contact") setWaLink((r.value as { whatsapp?: string })?.whatsapp ?? "");
      });
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    const contactRow = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "contact")
      .maybeSingle();
    const currentContact = (contactRow.data?.value as Record<string, unknown>) ?? {};
    const { error } = await supabase.from("site_settings").upsert(
      [
        { key: "whatsapp_group", value: group, is_public: true },
        { key: "contact", value: { ...currentContact, whatsapp: waLink }, is_public: true },
      ],
      { onConflict: "key" },
    );
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Configurações do WhatsApp salvas.");
  }

  if (loading)
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
      </div>
    );

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-2">Integrações</p>
          <h1 className="font-serif text-4xl text-sage-deep">WhatsApp</h1>
        </div>
        <button onClick={save} disabled={saving} className="btn-serena">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" /> Salvar
            </>
          )}
        </button>
      </div>
      {msg && <p className="mb-6 rounded-xl bg-blush px-4 py-2 text-sm text-sage-deep">{msg}</p>}

      <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="mb-4 font-serif text-2xl text-sage-deep">WhatsApp principal</h2>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Link direto (wa.me/...) usado em todos os botões do site
          </span>
          <input
            value={waLink}
            onChange={(e) => setWaLink(e.target.value)}
            placeholder="https://wa.me/5549998177652?text=..."
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="mb-1 font-serif text-2xl text-sage-deep">Grupo do WhatsApp</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Se o link do grupo estiver vazio ou a seção estiver desativada, o botão não aparece no
          site.
        </p>
        <label className="mb-4 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={group.active}
            onChange={(e) => setGroup({ ...group, active: e.target.checked })}
          />
          Ativar seção
        </label>
        <div className="grid gap-4">
          <Field
            label="Título"
            value={group.title}
            onChange={(v) => setGroup({ ...group, title: v })}
          />
          <Field
            label="Descrição"
            value={group.description}
            onChange={(v) => setGroup({ ...group, description: v })}
            textarea
          />
          <Field
            label="Texto do botão"
            value={group.cta}
            onChange={(v) => setGroup({ ...group, cta: v })}
          />
          <Field
            label="Link de convite do grupo (chat.whatsapp.com/...)"
            value={group.link}
            onChange={(v) => setGroup({ ...group, link: v })}
          />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={group.show_on_home}
                onChange={(e) => setGroup({ ...group, show_on_home: e.target.checked })}
              />
              Mostrar na Home
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={group.show_on_contact}
                onChange={(e) => setGroup({ ...group, show_on_contact: e.target.checked })}
              />
              Mostrar na página Contato
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
        />
      )}
    </label>
  );
}
