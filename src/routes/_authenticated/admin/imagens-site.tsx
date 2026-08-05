import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPTED_IMAGE_MIMES,
  IMAGE_BUCKET,
  MAX_IMAGE_MB,
  SIGNED_IMAGE_CACHE_TTL_MS,
  StorageCleanupPendingError,
  deleteSiteImage,
  signedUrl,
} from "@/lib/cms";
import {
  IMAGE_SLOTS,
  type ManagedImageRecord,
  type ImageSlot,
  setManagedImageCache,
} from "@/lib/managed-images";

export const Route = createFileRoute("/_authenticated/admin/imagens-site")({
  ssr: false,
  component: AdminSiteImages,
});

type SlotState = {
  image: ManagedImageRecord | null;
  loading: boolean;
  busy: boolean;
};

function AdminSiteImages() {
  const [state, setState] = useState<Record<string, SlotState>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function loadAll(showLoader = true) {
    if (showLoader) {
      const init: Record<string, SlotState> = {};
      IMAGE_SLOTS.forEach((s) => (init[s.key] = { image: null, loading: true, busy: false }));
      setState(init);
    }
    try {
      const { data, error } = await supabase
        .from("site_images")
        .select("id, storage_path, public_url, alt, tag, caption, created_at")
        .in(
          "tag",
          IMAGE_SLOTS.map((s) => s.key),
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const images = await Promise.all(
        ((data ?? []) as ManagedImageRecord[]).map(async (img) => ({
          ...img,
          public_url: await signedUrl(img.storage_path),
        })),
      );
      const map: Record<string, ManagedImageRecord> = {};
      images.forEach((img) => {
        if (!map[img.tag]) map[img.tag] = img;
      });
      const next: Record<string, SlotState> = {};
      IMAGE_SLOTS.forEach((s) => {
        next[s.key] = { image: map[s.key] ?? null, loading: false, busy: false };
      });
      setState(next);
    } catch {
      setMsg({ tone: "err", text: "Não foi possível carregar as imagens do site." });
      if (showLoader) {
        const failed: Record<string, SlotState> = {};
        IMAGE_SLOTS.forEach((s) => (failed[s.key] = { image: null, loading: false, busy: false }));
        setState(failed);
      }
    }
  }

  useEffect(() => {
    void loadAll();
    const refreshTimer = setInterval(() => void loadAll(false), SIGNED_IMAGE_CACHE_TTL_MS);
    return () => clearInterval(refreshTimer);
  }, []);

  function setSlot(key: string, patch: Partial<SlotState>) {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function replaceImage(slot: ImageSlot, file: File, alt: string, caption: string) {
    if (!ACCEPTED_IMAGE_MIMES.includes(file.type)) {
      setMsg({ tone: "err", text: "Formato não aceito. Use JPG, PNG ou WEBP." });
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setMsg({ tone: "err", text: `A imagem deve ter até ${MAX_IMAGE_MB} MB.` });
      return;
    }
    setSlot(slot.key, { busy: true });
    setMsg(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `slots/${slot.key}/${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error("Não foi possível enviar a imagem.");
      let ins;
      try {
        const url = await signedUrl(path);
        ins = await supabase
          .from("site_images")
          .insert({
            storage_path: path,
            // Required compatibility field; signed URLs are never persisted.
            public_url: "",
            alt: alt || slot.defaultAlt,
            tag: slot.key,
            caption: caption || null,
            mime: file.type,
            size_bytes: file.size,
          } as never)
          .select("id, storage_path, public_url, alt, tag, caption, created_at")
          .single();
        if (ins.error) throw ins.error;
        ins.data.public_url = url;
      } catch {
        const rollback = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
        if (rollback.error) {
          throw new Error("Falha ao concluir o upload e limpar o arquivo enviado.");
        }
        throw new Error("Não foi possível concluir o upload da imagem.");
      }
      setMsg({ tone: "ok", text: `Imagem atualizada: ${slot.label}.` });
      setManagedImageCache(slot.key, ins.data as ManagedImageRecord);
      setSlot(slot.key, { image: ins.data as ManagedImageRecord, busy: false });
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Falha ao enviar imagem." });
      setSlot(slot.key, { busy: false });
    }
  }

  async function removeImage(slot: ImageSlot, img: ManagedImageRecord) {
    if (!confirm(`Remover a imagem atual de "${slot.label}"? Voltará a exibir a padrão.`)) return;
    setSlot(slot.key, { busy: true });
    try {
      await deleteSiteImage(img);
      setMsg({ tone: "ok", text: "Imagem removida. Fallback padrão será exibido." });
      setManagedImageCache(slot.key, null);
      setSlot(slot.key, { image: null, busy: false });
    } catch (e) {
      if (e instanceof StorageCleanupPendingError) {
        await loadAll();
        setMsg({ tone: "err", text: e.message });
        return;
      }
      setMsg({ tone: "err", text: "Não foi possível remover a imagem." });
      setSlot(slot.key, { busy: false });
    }
  }

  async function saveMeta(slot: ImageSlot, img: ManagedImageRecord, alt: string, caption: string) {
    setSlot(slot.key, { busy: true });
    try {
      const url = await signedUrl(img.storage_path);
      const upd = await supabase
        .from("site_images")
        .update({ alt, caption: caption || null } as never)
        .eq("id", img.id)
        .select("id, storage_path, public_url, alt, tag, caption, created_at")
        .single();
      if (upd.error) throw upd.error;
      const updatedImage = {
        ...(upd.data as ManagedImageRecord),
        public_url: url,
      };
      setMsg({ tone: "ok", text: "Textos atualizados." });
      setManagedImageCache(slot.key, updatedImage);
      setSlot(slot.key, { image: updatedImage, busy: false });
    } catch {
      setMsg({ tone: "err", text: "Não foi possível salvar os textos." });
      setSlot(slot.key, { busy: false });
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6">
        <p className="eyebrow mb-2">CMS</p>
        <h1 className="font-serif text-4xl text-sage-deep">Imagens do site</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Substitua as imagens exibidas em cada seção do site. Quando nenhuma imagem estiver
          enviada, o site mantém a imagem padrão original. Formatos aceitos: JPG, PNG, WEBP (até{" "}
          {MAX_IMAGE_MB} MB).
        </p>
      </div>

      {msg && (
        <div
          className={
            "mb-6 rounded-xl border px-4 py-3 text-sm " +
            (msg.tone === "ok"
              ? "border-sage/40 bg-sage/10 text-sage-deep"
              : "border-destructive/40 bg-destructive/10 text-destructive")
          }
        >
          {msg.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {IMAGE_SLOTS.map((slot) => (
          <SlotCard
            key={slot.key}
            slot={slot}
            state={state[slot.key] ?? { image: null, loading: true, busy: false }}
            onUpload={(f, alt, cap) => replaceImage(slot, f, alt, cap)}
            onRemove={(img) => removeImage(slot, img)}
            onSaveMeta={(img, alt, cap) => saveMeta(slot, img, alt, cap)}
          />
        ))}
      </div>
    </div>
  );
}

function SlotCard({
  slot,
  state,
  onUpload,
  onRemove,
  onSaveMeta,
}: {
  slot: ImageSlot;
  state: SlotState;
  onUpload: (file: File, alt: string, caption: string) => void;
  onRemove: (img: ManagedImageRecord) => void;
  onSaveMeta: (img: ManagedImageRecord, alt: string, caption: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");

  useEffect(() => {
    setAlt(state.image?.alt ?? "");
    setCaption(state.image?.caption ?? "");
    // Reset local fields only when the selected image changes; metadata dependencies
    // would overwrite edits while the administrator is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.image?.id]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{slot.key}</p>
        <h2 className="font-serif text-xl text-sage-deep">{slot.label}</h2>
        {slot.description && (
          <p className="mt-1 text-xs text-muted-foreground">{slot.description}</p>
        )}
      </div>

      <div className="mb-4 aspect-video overflow-hidden rounded-xl bg-blush/30">
        {state.loading ? (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-sage-deep" />
          </div>
        ) : state.image ? (
          <img
            src={state.image.public_url}
            alt={state.image.alt ?? slot.defaultAlt}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
            Nenhuma imagem enviada.
            <br />O site está exibindo a imagem padrão.
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            Texto alternativo (alt)
          </label>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder={slot.defaultAlt}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
            Legenda (opcional)
          </label>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Descrição curta"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-sage"
          />
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_MIMES.join(",")}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f, alt, caption);
          if (fileRef.current) fileRef.current.value = "";
        }}
        className="hidden"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={state.busy}
          onClick={() => fileRef.current?.click()}
          className="btn-serena"
        >
          {state.busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Upload className="h-4 w-4" /> {state.image ? "Substituir" : "Enviar imagem"}
            </>
          )}
        </button>
        {state.image && (
          <>
            <button
              type="button"
              disabled={state.busy}
              onClick={() => onSaveMeta(state.image!, alt, caption)}
              className="btn-serena-outline"
            >
              Salvar textos
            </button>
            <button
              type="button"
              disabled={state.busy}
              onClick={() => onRemove(state.image!)}
              className="ml-auto inline-flex items-center gap-1 text-xs text-destructive hover:opacity-70"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </button>
          </>
        )}
      </div>
    </div>
  );
}
