import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/conteudo")({
  ssr: false,
  component: AdminContent,
});

type Hero = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  cta_primary?: string;
  cta_secondary?: string;
};

type Contact = {
  email?: string;
  hours?: string;
  address?: string;
  whatsapp?: string;
  whatsapp_display?: string;
  instagram?: string;
  instagram_url?: string;
};

function AdminContent() {
  const [hero, setHero] = useState<Hero>({});
  const [contact, setContact] = useState<Contact>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .in("key", ["hero", "contact"]);
      (data ?? []).forEach((r) => {
        if (r.key === "hero") setHero((r.value as Hero) ?? {});
        if (r.key === "contact") setContact((r.value as Contact) ?? {});
      });
      setLoading(false);
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    const rows = [
      { key: "hero", value: hero, is_public: true },
      { key: "contact", value: contact, is_public: true },
    ];
    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Alterações salvas com sucesso.");
  }

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-2">CMS</p>
          <h1 className="font-serif text-4xl text-sage-deep">Conteúdo do site</h1>
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

      <Section title="Hero da home">
        <Field
          label="Eyebrow (linha pequena acima do título)"
          value={hero.eyebrow}
          onChange={(v) => setHero({ ...hero, eyebrow: v })}
        />
        <Field
          label="Título principal"
          value={hero.title}
          onChange={(v) => setHero({ ...hero, title: v })}
          textarea
        />
        <Field
          label="Subtítulo"
          value={hero.subtitle}
          onChange={(v) => setHero({ ...hero, subtitle: v })}
          textarea
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="CTA principal"
            value={hero.cta_primary}
            onChange={(v) => setHero({ ...hero, cta_primary: v })}
          />
          <Field
            label="CTA secundário"
            value={hero.cta_secondary}
            onChange={(v) => setHero({ ...hero, cta_secondary: v })}
          />
        </div>
      </Section>

      <Section title="Informações de contato">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Email"
            value={contact.email}
            onChange={(v) => setContact({ ...contact, email: v })}
          />
          <Field
            label="Endereço"
            value={contact.address}
            onChange={(v) => setContact({ ...contact, address: v })}
          />
          <Field
            label="Horário de atendimento"
            value={contact.hours}
            onChange={(v) => setContact({ ...contact, hours: v })}
          />
          <Field
            label="Link do WhatsApp (wa.me)"
            value={contact.whatsapp}
            onChange={(v) => setContact({ ...contact, whatsapp: v })}
          />
          <Field
            label="Texto do botão WhatsApp"
            value={contact.whatsapp_display}
            onChange={(v) => setContact({ ...contact, whatsapp_display: v })}
          />
          <Field
            label="Handle do Instagram"
            value={contact.instagram}
            onChange={(v) => setContact({ ...contact, instagram: v })}
          />
          <Field
            label="URL do Instagram"
            value={contact.instagram_url}
            onChange={(v) => setContact({ ...contact, instagram_url: v })}
          />
        </div>
      </Section>

      <Section title="SEO do site">
        <p className="text-sm text-muted-foreground">
          O SEO de cada página é gerenciado no painel dedicado, com prévias do Google e das redes
          sociais.
        </p>
        <Link to="/admin/seo" className="btn-serena-outline">
          Abrir painel de SEO
        </Link>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="mb-4 font-serif text-2xl text-sage-deep">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string;
  value?: string;
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
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
        />
      ) : (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
        />
      )}
    </label>
  );
}
