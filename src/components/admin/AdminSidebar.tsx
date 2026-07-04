import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Sparkles,
  Settings,
  MessageSquareHeart,
  Home,
} from "lucide-react";
import { LeafMark } from "@/components/site/Logo";

const ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/agendamentos", label: "Agendamentos", icon: CalendarCheck },
  { to: "/admin/leads", label: "Leads", icon: Users },
  { to: "/admin/servicos", label: "Serviços", icon: Sparkles },
  { to: "/admin/faq", label: "FAQ", icon: MessageSquareHeart },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
      <nav className="flex-1 space-y-1 p-3">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
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
      <div className="border-t border-border p-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-sage-deep"
        >
          <Home className="h-3.5 w-3.5" /> Voltar ao site
        </Link>
      </div>
    </aside>
  );
}
