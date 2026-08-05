import { createFileRoute } from "@tanstack/react-router";
import AdminFaq from "@/components/admin/AdminFaq";

export const Route = createFileRoute("/_authenticated/admin/faq")({
  ssr: false,
  component: AdminFaq,
});
