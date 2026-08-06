import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RotateCcw, Save } from "lucide-react";
import {
  DEFAULT_SOCIAL_IMAGE,
  SEO_PAGE_DEFAULTS,
  SEO_PAGE_KEYS,
  absoluteSiteUrl,
  resolveSeoPage,
  type SeoPageInput,
  type SeoPageKey,
  type SeoPageOverride,
} from "@/lib/seo";
import { loadAdminSeoPages, restoreSeoPage, saveSeoPage } from "@/lib/seo.repository";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  ssr: false,
  component: AdminSeo,
});

type Feedback = { tone: "success" | "error"; text: string } | null;

function resolvedInput(page: SeoPageKey, override?: SeoPageOverride | null): SeoPageInput {
  const resolved = resolveSeoPage(page, override);
  return {
    title: resolved.title,
    description: resolved.description,
    socialImageUrl: resolved.socialImageUrl,
  };
}

function AdminSeo() {
  const [selectedPage, setSelectedPage] = useState<SeoPageKey>("home");
  const [overrides, setOverrides] = useState<Partial<Record<SeoPageKey, SeoPageOverride>>>({});
  const [draft, setDraft] = useState<SeoPageInput>(() => resolvedInput("home"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let active = true;
    void loadAdminSeoPages()
      .then((pages) => {
        if (!active) return;
        setOverrides(pages);
        setDraft(resolvedInput("home", pages.home));
      })
      .catch(() => {
        if (active) {
          setFeedback({ tone: "error", text: "Não foi possível carregar as configurações." });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const definition = SEO_PAGE_DEFAULTS[selectedPage];
  const isCustom = Boolean(overrides[selectedPage]);
  const canonical = absoluteSiteUrl(definition.path);
  const socialImage = draft.socialImageUrl || DEFAULT_SOCIAL_IMAGE;
  const formValid = useMemo(
    () =>
      draft.title.trim().length >= 10 &&
      draft.title.trim().length <= 70 &&
      draft.description.trim().length >= 30 &&
      draft.description.trim().length <= 180 &&
      (draft.socialImageUrl ?? "").length <= 500,
    [draft],
  );

  function selectPage(page: SeoPageKey) {
    setSelectedPage(page);
    setDraft(resolvedInput(page, overrides[page]));
    setFeedback(null);
  }

  async function save() {
    if (saving || !formValid) return;
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await saveSeoPage(selectedPage, draft);
      setOverrides((current) => ({ ...current, [selectedPage]: saved }));
      setDraft(saved);
      setFeedback({ tone: "success", text: "SEO da página salvo com sucesso." });
    } catch {
      setFeedback({ tone: "error", text: "Não foi possível salvar o SEO. Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefault() {
    if (saving || !isCustom) return;
    setSaving(true);
    setFeedback(null);
    try {
      await restoreSeoPage(selectedPage);
      setOverrides((current) => {
        const next = { ...current };
        delete next[selectedPage];
        return next;
      });
      setDraft(resolvedInput(selectedPage));
      setFeedback({ tone: "success", text: "Os valores padrão desta página foram restaurados." });
    } catch {
      setFeedback({
        tone: "error",
        text: "Não foi possível restaurar os valores padrão. Tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <p className="eyebrow mb-2">Visibilidade</p>
        <h1 className="font-serif text-4xl text-sage-deep">SEO Enterprise</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Personalize como cada página aparece no Google e nas redes sociais. URLs canônicas são
          calculadas automaticamente e não podem ser alteradas.
        </p>
      </div>

      {feedback && (
        <div
          role="status"
          className={
            "mb-6 rounded-xl border px-4 py-3 text-sm " +
            (feedback.tone === "success"
              ? "border-sage/40 bg-sage/10 text-sage-deep"
              : "border-destructive/40 bg-destructive/10 text-destructive")
          }
        >
          {feedback.text}
        </div>
      )}

      {loading ? (
        <div className="grid min-h-[40vh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-sage-deep" aria-label="Carregando SEO" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
          <nav
            aria-label="Páginas com SEO gerenciável"
            className="rounded-2xl border border-border bg-card p-3 shadow-soft"
          >
            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
              {SEO_PAGE_KEYS.map((page) => {
                const active = page === selectedPage;
                const customized = Boolean(overrides[page]);
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => selectPage(page)}
                    className={
                      "flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sage " +
                      (active
                        ? "bg-sage-deep text-primary-foreground"
                        : "text-foreground hover:bg-cream/70")
                    }
                    aria-current={active ? "page" : undefined}
                  >
                    <span>{SEO_PAGE_DEFAULTS[page].label}</span>
                    <span
                      className={
                        "h-2 w-2 rounded-full " +
                        (customized ? "bg-gold" : active ? "bg-primary-foreground/50" : "bg-border")
                      }
                      aria-label={customized ? "Personalizada" : "Usando padrão"}
                    />
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-soft md:p-6">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-2xl text-sage-deep">{definition.label}</h2>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                        (isCustom ? "bg-gold/15 text-gold" : "bg-sage/15 text-sage-deep")
                      }
                    >
                      {isCustom ? "Personalizado" : "Padrão do site"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{definition.path}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={restoreDefault}
                    disabled={saving || !isCustom}
                    className="btn-serena-outline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" /> Restaurar padrão
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !formValid}
                    className="btn-serena disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                <SeoField
                  id="seo-title"
                  label="Título SEO"
                  value={draft.title}
                  min={10}
                  max={70}
                  onChange={(title) => setDraft((current) => ({ ...current, title }))}
                />
                <SeoField
                  id="seo-description"
                  label="Descrição SEO"
                  value={draft.description}
                  min={30}
                  max={180}
                  textarea
                  onChange={(description) => setDraft((current) => ({ ...current, description }))}
                />
                <SeoField
                  id="seo-social-image"
                  label="Imagem social — URL HTTPS pública (opcional)"
                  value={draft.socialImageUrl ?? ""}
                  max={500}
                  inputMode="url"
                  placeholder={DEFAULT_SOCIAL_IMAGE}
                  onChange={(socialImageUrl) =>
                    setDraft((current) => ({ ...current, socialImageUrl }))
                  }
                />
                <label className="block" htmlFor="seo-canonical">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    URL canônica — calculada automaticamente
                  </span>
                  <div className="flex gap-2">
                    <input
                      id="seo-canonical"
                      value={canonical}
                      readOnly
                      className="min-w-0 flex-1 rounded-xl border border-border bg-cream/40 px-3 py-2 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-sage"
                    />
                    <a
                      href={canonical}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Abrir ${definition.label} em nova aba`}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-border text-sage-deep hover:bg-cream/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </label>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <p className="eyebrow mb-4">Prévia do Google</p>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="truncate text-xs text-sage-deep">{canonical}</p>
                  <h3 className="mt-1 line-clamp-1 text-xl text-[#1a0dab]">{draft.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {draft.description}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <p className="eyebrow mb-4">Prévia social</p>
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <img
                    src={socialImage}
                    alt="Prévia da imagem social"
                    className="aspect-[1.91/1] w-full bg-cream/40 object-cover"
                  />
                  <div className="p-4">
                    <p className="line-clamp-1 font-medium text-sage-deep">{draft.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {draft.description}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeoField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  textarea,
  inputMode,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max: number;
  textarea?: boolean;
  inputMode?: "url";
  placeholder?: string;
}) {
  const invalid = (min !== undefined && value.trim().length < min) || value.length > max;
  const inputClass =
    "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sage " +
    (invalid ? "border-destructive" : "border-border");

  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1 flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className={invalid ? "text-destructive" : ""}>
          {value.length}/{max}
        </span>
      </span>
      {textarea ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={min}
          maxLength={max}
          rows={4}
          aria-invalid={invalid}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={min}
          maxLength={max}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-invalid={invalid}
          className={inputClass}
        />
      )}
    </label>
  );
}
