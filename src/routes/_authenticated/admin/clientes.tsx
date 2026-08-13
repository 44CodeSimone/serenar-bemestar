import { createFileRoute } from "@tanstack/react-router";
import AdminClients from "@/components/admin/AdminClients";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  ssr: false,
  component: AdminClients,
});
