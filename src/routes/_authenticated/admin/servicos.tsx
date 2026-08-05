import { createFileRoute } from "@tanstack/react-router";
import AdminServicos from "@/components/admin/AdminServicos";

export const Route = createFileRoute("/_authenticated/admin/servicos")({
  ssr: false,
  component: AdminServicos,
});
