import { createFileRoute } from "@tanstack/react-router";
import AdminLeads from "@/components/admin/AdminLeads";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  ssr: false,
  component: AdminLeads,
});
