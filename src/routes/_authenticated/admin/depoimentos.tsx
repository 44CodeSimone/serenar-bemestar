import { createFileRoute } from "@tanstack/react-router";
import AdminTestimonials from "@/components/admin/AdminTestimonials";

export const Route = createFileRoute("/_authenticated/admin/depoimentos")({
  ssr: false,
  component: AdminTestimonials,
});
