import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Check, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { listPublicServices, type PublicService } from "@/lib/services.repository";
import { createPrebooking } from "@/lib/calendar-slots.repository";
import { listPublicCalendarSlotsFn } from "@/lib/calendar-slots.functions";
import { SITE } from "@/lib/site-config";
import { createSeoHead } from "@/lib/seo";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
  type TurnstileWidgetState,
} from "@/components/shared/TurnstileWidget";

const searchSchema = z.object({ service: z.string().optional() });

export const Route = createFileRoute("/agendamento")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () =>
    createSeoHead({
      title: "Agendamento — Reserve sua sessão | Serenar",
      description:
        "Solicite seu horário de massoterapia e bem-estar no Serenar em Urubici. A confirmação do pré-agendamento é feita pela Mariah.",
      path: "/agendamento",
    }),
  component: Agendamento,
});

const formSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(100),
  phone: z.string().trim().min(8, "Telefone inválido").max(30),
  email: z.string().trim().email("Email inválido").max(200).optional().or(z.literal("")),
  service: z.string().min(1, "Selecione um serviço"),
  preferred_date: z.string().optional(),
  preferred_time: z.string().min(1, "Selecione um hor?rio"),
  notes: z.string().max(600).optional(),
});

function Agendamento() {
  const search = Route.useSearch();
  const initialServiceSearchRef = useRef(search.service);
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
    website: "",
  });
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileAvailable, setTurnstileAvailable] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const turnstileWidgetRef = useRef<TurnstileWidgetHandle>(null);

  const fetchPublicSlots = useServerFn(listPublicCalendarSlotsFn);

  /* ── Load services and calendar slots ──────────────── */
  const [services, setServices] = useState<PublicService[]>([]);
  const [calendarSlots, setCalendarSlots] = useState<Awaited<ReturnType<typeof fetchPublicSlots>>>(
    [],
  );
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [servicesData, slotsData] = await Promise.all([
          listPublicServices(),
          fetchPublicSlots(),
        ]);
        if (!cancelled) {
          setServices(servicesData);
          setCalendarSlots(slotsData);
          setForm((current) => {
            const incomingService = initialServiceSearchRef.current;
            if (!incomingService || current.service !== incomingService) return current;

            const matchedService = servicesData.find(
              (service) => service.id === incomingService || service.slug === incomingService,
            );

            return matchedService && matchedService.id !== current.service
              ? { ...current, service: matchedService.id }
              : current;
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load booking data:", err);
          setServicesError("Não foi possível carregar as informações. Tente recarregar a página.");
        }
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetTurnstile() {
    setTurnstileToken("");
    turnstileWidgetRef.current?.reset();
  }

  function handleTurnstileAvailability(available: boolean) {
    setTurnstileAvailable(available);

    if (!available) {
      setTurnstileToken("");
      setTurnstileError("A verificação de segurança não está disponível no momento.");
    }
  }

  function handleTurnstileState(state: TurnstileWidgetState) {
    if (state === "ready") {
      setTurnstileError(null);
    } else if (state === "expired") {
      setTurnstileError("A verificação expirou. Confirme novamente para continuar.");
    } else if (state === "initialization-error") {
      setTurnstileError("Não foi possível iniciar a verificação de segurança.");
    } else {
      setTurnstileError("Não foi possível concluir a verificação de segurança.");
    }
  }

  const availableDates = useMemo(() => {
    return Array.from(new Set(calendarSlots.map((s) => s.slot_date))).sort();
  }, [calendarSlots]);

  const slotsForSelectedDate = useMemo(() => {
    if (!form.preferred_date) return [];
    return calendarSlots.filter((s) => s.slot_date === form.preferred_date);
  }, [calendarSlots, form.preferred_date]);

  function upd<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  function handleDateChange(dateStr: string) {
    setForm((prev) => ({
      ...prev,
      preferred_date: dateStr,
      preferred_time: "",
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        errs[String(i.path[0])] = i.message;
      });
      setErrors(errs);
      return;
    }

    if (!turnstileToken) {
      setTurnstileError("Confirme a verificação de segurança antes de enviar.");
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await createPrebooking({
        calendarSlotId: form.preferred_time,
        fullName: form.full_name,
        phone: form.phone,
        email: form.email || undefined,
        serviceId: form.service,
        notes: form.notes || undefined,
        turnstileToken,
        website: form.website,
      });
      resetTurnstile();
      setDone(true);
      setTimeout(() => window.open(SITE.whatsapp.link, "_blank", "noopener,noreferrer"), 800);
    } catch (err) {
      resetTurnstile();
      console.error(err);

      const message =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof err.message === "string"
          ? err.message
          : "";

      if (message.includes("Horário indisponível")) {
        try {
          const refreshedSlots = await fetchPublicSlots();
          setCalendarSlots(refreshedSlots);
        } catch (refreshError) {
          console.error("Failed to refresh calendar slots:", refreshError);
        }

        setForm((prev) => ({ ...prev, preferred_time: "" }));
        setErrors({
          preferred_time:
            "Este horário acabou de ser reservado por outra pessoa. Escolha outro horário disponível.",
        });
      } else if (message.includes("telefone brasileiro")) {
        setErrors({ phone: "Informe um telefone brasileiro válido com DDD." });
      } else if (message.includes("validar o envio")) {
        setTurnstileError(
          "Não foi possível validar o envio. Faça a verificação novamente e tente de novo.",
        );
      } else {
        setErrors({
          _: "Não conseguimos enviar. Tente novamente ou fale no WhatsApp.",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const selectedService = services.find((service) => service.id === form.service);
  const selectedSlot = calendarSlots.find((slot) => slot.id === form.preferred_time);

  if (done) {
    return (
      <section className="container-narrow py-24">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-border bg-cream/60 p-12 text-center shadow-soft">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-sage-deep text-primary-foreground">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="mt-6 font-serif text-4xl text-sage-deep">Pedido recebido</h1>
          <p className="mt-4 text-muted-foreground">
            Obrigada, {form.full_name.split(" ")[0]}. Esta é uma solicitação de pré-agendamento e
            ainda aguarda confirmação da Serenar.
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left text-sm">
            <p className="font-medium text-sage-deep">Resumo da solicitação</p>
            <dl className="mt-3 space-y-2 text-foreground/80">
              <div className="flex justify-between gap-4">
                <dt>Cliente</dt>
                <dd className="text-right font-medium">{form.full_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Serviço</dt>
                <dd className="text-right font-medium">
                  {selectedService?.name ?? "Serviço solicitado"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Data</dt>
                <dd className="text-right font-medium">
                  {form.preferred_date ? formatDateLabel(form.preferred_date) : "Não informada"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Horário</dt>
                <dd className="text-right font-medium">
                  {selectedSlot ? formatTimeLabel(selectedSlot) : "Não informado"}
                </dd>
              </div>
            </dl>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            A Serenar entrará em contato para confirmar. Não considere o horário confirmado antes
            desse contato.
          </p>
          <div className="mt-8">
            <a
              href={SITE.whatsapp.link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-serena"
            >
              Falar com a Serenar no WhatsApp
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

  if (servicesLoading) {
    return (
      <section className="container-narrow py-24">
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando informações…</span>
        </div>
      </section>
    );
  }

  if (servicesError) {
    return (
      <section className="container-narrow py-24">
        <div className="mx-auto max-w-lg rounded-[2rem] border border-destructive/30 bg-card p-10 text-center shadow-soft">
          <p className="text-sm text-destructive">{servicesError}</p>
          <button onClick={() => window.location.reload()} className="btn-serena mt-6">
            Tentar novamente
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
          Preencha os campos abaixo. A confirmação acontece pelo WhatsApp com a Mariah, para
          garantir o melhor horário para você.
        </p>

        <form
          onSubmit={submit}
          className="mt-10 space-y-5 rounded-[2rem] border border-border bg-card p-8 shadow-soft md:p-10"
        >
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label htmlFor="company-website">Site da empresa</label>
            <input
              id="company-website"
              name="company_website"
              value={form.website}
              onChange={(e) => upd("website", e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          <Field label="Nome completo *" error={errors.full_name}>
            <input
              value={form.full_name}
              onChange={(e) => upd("full_name", e.target.value)}
              className={input}
            />
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Telefone / WhatsApp *" error={errors.phone}>
              <input
                value={form.phone}
                onChange={(e) => upd("phone", e.target.value)}
                placeholder="(49) 9 9999-9999"
                className={input}
              />
            </Field>
            <Field label="Email (opcional)" error={errors.email}>
              <input
                value={form.email}
                onChange={(e) => upd("email", e.target.value)}
                type="email"
                className={input}
              />
            </Field>
          </div>
          <Field label="Serviço desejado *" error={errors.service}>
            <select
              value={form.service}
              onChange={(e) => upd("service", e.target.value)}
              className={input}
            >
              <option value="">Selecione um ritual…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.duration ? ` — ${s.duration}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Data preferida">
              <select
                value={form.preferred_date}
                onChange={(e) => handleDateChange(e.target.value)}
                className={input}
                disabled={availableDates.length === 0}
              >
                <option value="">
                  {availableDates.length === 0 ? "Nenhuma data disponível" : "Selecione uma data…"}
                </option>
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {formatDateLabel(d)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Horário preferido">
              <select
                value={form.preferred_time}
                onChange={(e) => upd("preferred_time", e.target.value)}
                className={input}
                disabled={
                  availableDates.length === 0 ||
                  !form.preferred_date ||
                  slotsForSelectedDate.length === 0
                }
              >
                <option value="">
                  {availableDates.length === 0
                    ? "Nenhum horário disponível"
                    : !form.preferred_date
                      ? "Selecione a data primeiro…"
                      : slotsForSelectedDate.length === 0
                        ? "Nenhum horário disponível"
                        : "Selecione um horário…"}
                </option>
                {slotsForSelectedDate.map((slot) => {
                  return (
                    <option key={slot.id} value={slot.id}>
                      {formatTimeLabel(slot)}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>
          {availableDates.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Nenhum horário pré-definido disponível no momento.
            </p>
          )}
          <Field label="Alguma observação?">
            <textarea
              value={form.notes}
              onChange={(e) => upd("notes", e.target.value)}
              rows={4}
              className={input + " resize-none"}
              placeholder="Alergias, gestação, dores específicas, primeira vez…"
            />
          </Field>

          {errors._ && <p className="text-sm text-destructive">{errors._}</p>}

          <div className="space-y-2">
            <TurnstileWidget
              ref={turnstileWidgetRef}
              action="prebooking"
              onTokenChange={(token) => setTurnstileToken(token ?? "")}
              onAvailabilityChange={handleTurnstileAvailability}
              onStateChange={handleTurnstileState}
            />
            {turnstileError && (
              <p role="alert" className="text-sm text-destructive">
                {turnstileError}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse items-center justify-between gap-4 pt-2 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Ao enviar, você concorda com nossa política de privacidade (LGPD).
            </p>
            <button
              type="submit"
              disabled={loading || !turnstileAvailable || !turnstileToken}
              className="btn-serena min-w-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar pedido"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

const input =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-sage focus:ring-1 focus:ring-sage";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </label>
  );
}

function formatDateLabel(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeLabel(slot: { start_time: string; end_time: string | null }): string {
  const start = slot.start_time.slice(0, 5);
  if (slot.end_time) {
    const end = slot.end_time.slice(0, 5);
    return `${start} às ${end}`;
  }
  return start;
}
