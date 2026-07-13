import { createFileRoute } from "@tanstack/react-router";
import AdminAppointments from "@/components/admin/AdminAppointments";

export const Route = createFileRoute("/_authenticated/admin/agendamentos")({
  ssr: false,
  component: AdminAppointments,
});
