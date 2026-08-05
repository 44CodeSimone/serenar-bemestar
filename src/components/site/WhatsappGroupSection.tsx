import { MessageCircle } from "lucide-react";
import { useSiteSetting } from "@/lib/cms";

type WhatsappGroup = {
  active?: boolean;
  title?: string;
  description?: string;
  cta?: string;
  link?: string;
  show_on_home?: boolean;
  show_on_contact?: boolean;
};

export function WhatsappGroupSection({ surface }: { surface: "home" | "contact" }) {
  const { value } = useSiteSetting<WhatsappGroup>("whatsapp_group");
  if (!value) return null;
  if (!value.active) return null;
  if (!value.link || value.link.trim() === "") return null;
  if (surface === "home" && !value.show_on_home) return null;
  if (surface === "contact" && !value.show_on_contact) return null;

  return (
    <section className="container-narrow py-16 md:py-20">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-border bg-cream/60 p-10 text-center shadow-soft md:p-14">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush text-gold">
          <MessageCircle className="h-6 w-6" />
        </div>
        <h2 className="font-serif text-3xl text-sage-deep md:text-4xl">
          {value.title || "Entre no nosso grupo do WhatsApp"}
        </h2>
        {value.description && (
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">{value.description}</p>
        )}
        <a href={value.link} target="_blank" rel="noopener noreferrer" className="btn-serena mt-8">
          💬 {value.cta || "Entrar no grupo"}
        </a>
      </div>
    </section>
  );
}
