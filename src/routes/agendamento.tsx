import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Check, Loader2 } from "lucide-react";
import { SITE } from "@/lib/site-config";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ service: z.string().optional() });

export const Route = createFileRoute("/agendamento")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Agendamento — Reserve sua sessão | Serenar" },
      {
        name: "description",
        content: "Reserve seu horário no Serenar. Formulário rápido — confirmação pelo WhatsApp com a Mariah.",
      },
    ],
  }),
  component: Agendamento,
});

const formSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(100),
  phone: z.string().trim().min(8, "Telefone inválido").max(30),
  email: z.string().trim().email("Email inválido").max(200).optional().or(z.literal("")),
  service: z.string().min(1, "Selecione um serviço"),
  preferred_date: z.string().optional(),
  preferred_time: z.string().max(20).optional(),
  notes: z.string().max(600).optional(),
});

function Agendamento() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    service: search.service || "",
    preferred_date: "",
    preferred_time: "",
    notes: "",
  });

  function upd<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || null,
        service: form.service,
        preferred_date: form.preferred_date || null,
        preferred_time: form.preferred_time || null,
        notes: form.notes || null,
      });
      if (error) throw error;
      setDone(true);
      setTimeout(() => window.open(SITE.whatsapp.link, "_blank", "noopener,noreferrer"), 800);
    } catch (err) {
      console.error(err);
      setErrors({ _: "Não conseguimos enviar. Tente novamente ou fale no WhatsApp." });
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <section className="container-narrow py-24">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-border bg-cream/60 p-12 text-center shadow-soft">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-sage-deep text-primary-foreground">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="mt-6 font-serif text-4xl text-sage-deep">Pedido recebido</h1>
          <p className="mt-4 text-muted-foreground">
            Obrigada, {form.full_name.split(" ")[0]}. Estamos te redirecionando para o WhatsApp
            para confirmar seu horário com a Mariah.
          </p>
          <div className="mt-8">
            <a href={SITE.whatsapp.link} target="_blank" rel="noopener noreferrer" className="btn-serena">
              Abrir WhatsApp
            </a>
          </div>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-6 text-sm text-muted-foreground hover:text-sage-deep"
          >
            Voltar ao início
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="container-narrow py-16 md:py-24">
      <div className="mx-auto max-w-2xl">
        <p className="eyebrow mb-3">Agendamento</p>
        <h1 className="display-serif text-5xl">
          Reserve seu <span className="italic text-sage">momento</span>
        </h1>
        <p className="mt-4 text-muted-foreground">
          Preencha os campos abaixo. A confirmação acontece pelo WhatsApp com a Mariah,
          para garantir o melhor horário para você.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-5 rounded-[2rem] border border-border bg-card p-8 shadow-soft md:p-10">
          <Field label="Nome completo *" error={errors.full_name}>
            <input value={form.full_name} onChange={(e) => upd("full_name", e.target.value)} className={input} />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Telefone / WhatsApp *" error={errors.phone}>
              <input value={form.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="(49) 9 9999-9999" className={input} />
            </Field>
            <Field label="Email (opcional)" error={errors.email}>
              <input value={form.email} onChange={(e) => upd("email", e.target.value)} type="email" className={input} />
            </Field>
          </div>
          <Field label="Serviço desejado *" error={errors.service}>
            <select value={form.service} onChange={(e) => upd("service", e.target.value)} className={input}>
              <option value="">Selecione um ritual…</option>
              {SERVICES.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name} — {s.duration}</option>
              ))}
            </select>
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Data preferida">
              <input value={form.preferred_date} onChange={(e) => upd("preferred_date", e.target.value)} type="date" className={input} />
            </Field>
            <Field label="Horário preferido">
              <input value={form.preferred_time} onChange={(e) => upd("preferred_time", e.target.value)} type="time" className={input} />
            </Field>
          </div>
          <Field label="Alguma observação?">
            <textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} rows={4} className={input + " resize-none"} placeholder="Alergias, gestação, dores específicas, primeira vez…" />
          </Field>

          {errors._ && <p className="text-sm text-destructive">{errors._}</p>}

          <div className="flex flex-col-reverse items-center justify-between gap-4 pt-2 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Ao enviar, você concorda com nossa política de privacidade (LGPD).
            </p>
            <button type="submit" disabled={loading} className="btn-serena min-w-40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar pedido"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

const input = "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-sage focus:ring-1 focus:ring-sage";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </label>
  );
}
