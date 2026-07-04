import { Link } from "@tanstack/react-router";
import { Menu, X, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import type { User as SUser } from "@supabase/supabase-js";

const NAV = [
  { to: "/", label: "Início" },
  { to: "/sobre", label: "Sobre" },
  { to: "/servicos", label: "Serviços" },
  { to: "/blog", label: "Blog" },
  { to: "/faq", label: "FAQ" },
  { to: "/contato", label: "Contato" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<SUser | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header
      className={
        "fixed inset-x-0 top-0 z-40 transition-all duration-500 " +
        (scrolled
          ? "bg-background/85 backdrop-blur-xl border-b border-border/60"
          : "bg-transparent")
      }
    >
      <div className="container-narrow flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Logo className="h-11 w-auto" />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[13px] tracking-[0.15em] uppercase text-foreground/70 transition-colors hover:text-sage-deep"
              activeProps={{ className: "text-sage-deep font-medium" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            to={user ? "/perfil" : "/auth"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-sage-deep transition-colors hover:bg-blush"
            aria-label={user ? "Minha conta" : "Entrar"}
          >
            <User className="h-4 w-4" />
          </Link>
          <Link to="/agendamento" className="btn-serena">
            Agendar
          </Link>
        </div>

        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-sage-deep lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden">
          <nav className="container-narrow flex flex-col gap-1 py-6">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="py-3 text-lg font-serif text-foreground/80"
                activeProps={{ className: "text-sage-deep" }}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3">
              <Link
                to={user ? "/perfil" : "/auth"}
                onClick={() => setOpen(false)}
                className="btn-serena-outline"
              >
                <User className="h-4 w-4" /> {user ? "Minha conta" : "Entrar"}
              </Link>
              <Link to="/agendamento" onClick={() => setOpen(false)} className="btn-serena">
                Agendar sessão
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
