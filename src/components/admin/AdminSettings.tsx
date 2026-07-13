import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = { key: string; value: Record<string, unknown> };

const SECTIONS = [
  {
    key: "contact",
    title: "Contato",
    fields: [
      { key: "whatsapp", label: "WhatsApp (com DDI)" },
      { key: "whatsapp_display", label: "WhatsApp (display)" },
      { key: "instagram", label: "Instagram (@handle)" },
      { key: "instagram_url", label: "URL do Instagram" },
      { key: "email", label: "E-mail" },
      { key: "address", label: "Endereço" },
      { key: "hours", label: "Horários", type: "textarea" },
    ],
  },
  {
    key: "hero",
    title: "Hero da Home",
    fields: [
      { key: "eyebrow", label: "Sobrelinha" },
      { key: "title", label: "Título principal", type: "textarea" },
      { key: "subtitle", label: "Subtítulo", type: "textarea" },
      { key: "cta_primary", label: "CTA principal" },
      { key: "cta_secondary", label: "CTA secundário" },
    ],
  },
  {
    key: "whatsapp_messages",
    title: "Mensagens pré-preenchidas do WhatsApp",
    fields: [
      { key: "default", label: "Padrão (botão flutuante)", type: "textarea" },
      { key: "booking", label: "Após agendamento", type: "textarea" },
      { key: "from_ai", label: "Após conversa com Serená", type: "textarea" },
    ],
  },
  {
    key: "seo",
    title: "SEO global",
    fields: [
      { key: "title", label: "Título" },
      { key: "description", label: "Descrição", type: "textarea" },
    ],
  },
];

export default function AdminSettings() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("site_settings").select("key, value");
    const map: Record<string, Row> = {};
    (data ?? []).forEach((r) => {
      map[r.key] = { key: r.key, value: (r.value ?? {}) as Record<string, unknown> };
    });
    SECTIONS.forEach((s) => {
      if (!map[s.key]) map[s.key] = { key: s.key, value: {} };
    });
    setRows(map);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function edit(sectionKey: string, field: string, val: string) {
    setRows((prev) => ({
      ...prev,
      [sectionKey]: { key: sectionKey, value: { ...prev[sectionKey].value, [field]: val } },
    }));
  }

  async function saveAll() {
    setSaving(true);
    setSavedMsg(null);
    for (const s of SECTIONS) {
      await supabase.from("site_settings").upsert({ key: s.key, value: rows[s.key].value as never, is_public: true });
    }
    setSaving(false);
    setSavedMsg("Configurações salvas.");
    setTimeout(() => setSavedMsg(null), 2500);
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-2">Ajustes</p>
          <h1 className="font-serif text-4xl text-sage-deep">Configurações do site</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Editando aqui você atualiza os textos padrão exibidos no site.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedMsg && <span className="text-xs text-sage-deep">{savedMsg}</span>}
          <button onClick={saveAll} disabled={saving} className="btn-serena">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Salvar tudo</>}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage-deep" />
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.key} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="mb-4 font-serif text-2xl text-sage-deep">{s.title}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {s.fields.map((f) => {
                  const val = String((rows[s.key]?.value?.[f.key] as string) ?? "");
                  const cls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage";
                  return (
                    <label key={f.key} className={f.type === "textarea" ? "md:col-span-2" : ""}>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}</span>
                      {f.type === "textarea" ? (
                        <textarea value={val} onChange={(e) => edit(s.key, f.key, e.target.value)} rows={3} className={"mt-1 " + cls} />
                      ) : (
                        <input value={val} onChange={(e) => edit(s.key, f.key, e.target.value)} className={"mt-1 " + cls} />
                      )}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
