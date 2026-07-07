import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Sparkles,
  Settings,
  MessageSquareHeart,
  Home,
  LogOut,
  FileText,
  Image as ImageIcon,
  Newspaper,
  MessageCircle,
  Search,
  Quote,
} from "lucide-react";
import { LeafMark } from "@/components/site/Logo";
import { supabase } from "@/integrations/supabase/client";

const ITEMS: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/conteudo", label: "Conteúdo do site", icon: FileText },
  { to: "/admin/imagens", label: "Imagens", icon: ImageIcon },
  { to: "/admin/servicos", label: "Serviços", icon: Sparkles },
  { to: "/admin/agendamentos", label: "Agendamentos", icon: CalendarCheck },
  { to: "/admin/leads", label: "Leads", icon: Users },
  { to: "/admin/blog", label: "Blog", icon: Newspaper },
  { to: "/admin/faq", label: "FAQ", icon: MessageSquareHeart },
  { to: "/admin/depoimentos", label: "Depoimentos", icon: Quote },
  { to: "/admin/seo", label: "SEO", icon: Search },
  { to: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-cream/40 md:flex md:flex-col">
      <div className="border-b border-border p-6">
        <Link to="/" className="flex items-center gap-2 text-sage-deep">
          <LeafMark className="h-6 w-6 text-gold" />
          <span className="font-serif text-2xl">Serenar</span>
        </Link>
        <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Painel administrativo
        </p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={item.to as any}
              className={
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors " +
                (active
                  ? "bg-sage-deep text-primary-foreground"
                  : "text-foreground/70 hover:bg-blush hover:text-sage-deep")
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-1 border-t border-border p-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-sage-deep"
        >
          <Home className="h-3.5 w-3.5" /> Voltar ao site
        </Link>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-sage-deep"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>
    </aside>
  );
}
