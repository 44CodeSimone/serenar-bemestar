import { createFileRoute } from "@tanstack/react-router";
import AdminAgenda from "@/components/admin/AdminAgenda";

export const Route = createFileRoute("/_authenticated/admin/agenda")({
  ssr: false,
  component: AdminAgenda,
});
