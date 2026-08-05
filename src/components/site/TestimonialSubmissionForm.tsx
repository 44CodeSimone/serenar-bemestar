import { useRef, useState, type FormEvent } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { submitPublicTestimonial } from "@/lib/testimonials.repository";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
  type TurnstileWidgetState,
} from "@/components/shared/TurnstileWidget";

const INITIAL_FORM = {
  name: "",
  service: "",
  text: "",
  rating: 5,
  website: "",
};

type FieldErrors = Partial<Record<"name" | "service" | "text", string>>;

export function TestimonialSubmissionForm() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileAvailable, setTurnstileAvailable] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const turnstileWidgetRef = useRef<TurnstileWidgetHandle>(null);

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
    } else {
      setTurnstileError("Não foi possível concluir a verificação de segurança.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextFieldErrors: FieldErrors = {};
    const nameLength = form.name.trim().length;
    const serviceLength = form.service.trim().length;
    const textLength = form.text.trim().length;

    if (nameLength < 2) nextFieldErrors.name = "Informe seu nome com pelo menos 2 caracteres.";
    if (nameLength > 80) nextFieldErrors.name = "Seu nome deve ter no máximo 80 caracteres.";
    if (serviceLength > 100) {
      nextFieldErrors.service = "O serviço deve ter no máximo 100 caracteres.";
    }
    if (textLength < 30) {
      nextFieldErrors.text = "Conte um pouco mais: use pelo menos 30 caracteres.";
    }
    if (textLength > 320) {
      nextFieldErrors.text = "Seu depoimento deve ter no máximo 320 caracteres.";
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    if (!turnstileToken) {
      setTurnstileError("Confirme a verificação de segurança antes de enviar.");
      return;
    }

    setSubmitting(true);
    setSuccess(false);
    setError(null);

    try {
      await submitPublicTestimonial({
        name: form.name,
        service: form.service.trim() || null,
        text: form.text,
        rating: form.rating,
        turnstileToken,
        website: form.website,
      });
      resetTurnstile();
      setForm(INITIAL_FORM);
      setFieldErrors({});
      setSuccess(true);
    } catch {
      resetTurnstile();
      setError("Não foi possível enviar seu depoimento. Revise os dados e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-5xl border-y border-border/70 py-7 sm:mt-12 sm:py-10">
      <form
        noValidate
        onSubmit={submit}
        className="grid gap-6 sm:gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10"
      >
        <div className="flex flex-col justify-center lg:pr-2">
          <p className="eyebrow mb-2">Compartilhe sua experiência</p>
          <h3 className="max-w-md font-serif text-2xl leading-tight text-sage-deep sm:text-3xl lg:text-4xl">
            Como foi seu momento no Serenar?
          </h3>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground/75 sm:mt-4">
            Seu depoimento será revisado pela Mariah antes de ser publicado no site.
          </p>
          <p className="mt-3 max-w-sm border-l border-gold/50 pl-4 text-xs leading-relaxed text-muted-foreground sm:mt-5">
            Sua percepção ajuda outras pessoas a escolherem seu momento de cuidado com mais
            confiança.
          </p>

          <fieldset disabled={submitting} className="mt-5 space-y-2 sm:mt-7">
            <legend className="text-sm font-medium text-sage-deep">Sua avaliação *</legend>
            <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border/80 bg-card/70 p-1.5 shadow-sm">
              {[1, 2, 3, 4, 5].map((rating) => (
                <label
                  key={rating}
                  className={`group inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-all duration-200 hover:-translate-y-0.5 hover:bg-gold/10 focus-within:ring-2 focus-within:ring-sage/40 ${
                    form.rating === rating ? "bg-gold/15 shadow-sm" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="testimonial-rating"
                    value={rating}
                    checked={form.rating === rating}
                    onChange={() => setForm((current) => ({ ...current, rating }))}
                    className="sr-only"
                  />
                  <Star
                    className={`h-6 w-6 transition-all duration-200 group-hover:scale-110 ${
                      form.rating >= rating
                        ? "fill-gold text-gold"
                        : "text-muted-foreground/30 group-hover:text-gold/60"
                    }`}
                  />
                  <span className="sr-only">{rating} de 5 estrelas</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="space-y-3.5 rounded-[1.75rem] border border-border/70 bg-card/70 p-4 shadow-soft sm:p-6">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm sm:flex sm:flex-col">
              <span className="font-medium text-sage-deep">Seu nome *</span>
              <input
                required
                minLength={2}
                maxLength={80}
                value={form.name}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "testimonial-name-error" : undefined}
                onChange={(event) => {
                  setForm((current) => ({ ...current, name: event.target.value }));
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                }}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 outline-none transition-colors focus:border-sage"
              />
              {fieldErrors.name ? (
                <span id="testimonial-name-error" className="text-xs text-destructive">
                  {fieldErrors.name}
                </span>
              ) : null}
            </label>

            <label className="space-y-1.5 text-sm sm:flex sm:flex-col">
              <span className="font-medium text-sage-deep">Serviço realizado</span>
              <input
                maxLength={100}
                value={form.service}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.service)}
                aria-describedby={fieldErrors.service ? "testimonial-service-error" : undefined}
                onChange={(event) => {
                  setForm((current) => ({ ...current, service: event.target.value }));
                  setFieldErrors((current) => ({ ...current, service: undefined }));
                }}
                placeholder="Ex.: Massagem relaxante"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 outline-none transition-colors focus:border-sage"
              />
              {fieldErrors.service ? (
                <span id="testimonial-service-error" className="text-xs text-destructive">
                  {fieldErrors.service}
                </span>
              ) : null}
            </label>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-sage-deep">Seu depoimento *</span>
            <textarea
              required
              minLength={30}
              maxLength={320}
              rows={4}
              value={form.text}
              disabled={submitting}
              aria-invalid={Boolean(fieldErrors.text)}
              aria-describedby="testimonial-text-help testimonial-text-counter testimonial-text-error"
              onChange={(event) => {
                setForm((current) => ({ ...current, text: event.target.value }));
                setFieldErrors((current) => ({ ...current, text: undefined }));
              }}
              className="w-full resize-y rounded-xl border border-border bg-background px-4 py-2.5 leading-relaxed outline-none transition-colors focus:border-sage"
            />
            <span
              id="testimonial-text-help"
              className="block text-xs leading-relaxed text-muted-foreground/80"
            >
              Conte como foi sua experiência. Depoimentos curtos costumam proporcionar uma leitura
              mais agradável.
            </span>
            <span className="flex items-start justify-between gap-3">
              <span id="testimonial-text-error" className="text-xs text-destructive">
                {fieldErrors.text ?? ""}
              </span>
              <span
                id="testimonial-text-counter"
                className={`ml-auto shrink-0 text-xs tabular-nums ${
                  form.text.length >= 320
                    ? "text-destructive"
                    : form.text.length >= 256
                      ? "text-gold"
                      : "text-muted-foreground"
                }`}
              >
                {form.text.length} / 320
              </span>
            </span>
          </label>

          <div
            className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
            aria-hidden="true"
          >
            <label>
              Site
              <input
                name="website"
                value={form.website}
                tabIndex={-1}
                autoComplete="off"
                onChange={(event) =>
                  setForm((current) => ({ ...current, website: event.target.value }))
                }
              />
            </label>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {success ? (
            <p role="status" className="flex items-center gap-2 text-sm text-sage-deep">
              <Check className="h-4 w-4" /> Obrigada! Seu depoimento foi enviado para revisão.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="flex min-h-[72px] flex-col justify-center gap-1.5">
              <TurnstileWidget
                ref={turnstileWidgetRef}
                action="testimonial"
                onTokenChange={(token) => setTurnstileToken(token ?? "")}
                onAvailabilityChange={handleTurnstileAvailability}
                onStateChange={handleTurnstileState}
              />
              {turnstileError ? (
                <p role="alert" className="text-xs leading-relaxed text-destructive">
                  {turnstileError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={submitting || !turnstileAvailable || !turnstileToken}
              className="btn-serena w-full sm:mb-1 sm:w-auto"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? "Enviando…" : "Enviar depoimento"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
